/**
 * RevenueCat integration: the inbound webhook and the outbound v2 REST calls
 * used when an admin grants or revokes Pro by hand.
 *
 * RevenueCat is the source of truth for entitlements (see src/lib/billing.ts) —
 * this server mirrors what it is told into Supabase so the app and the panel
 * agree on who has Pro.
 */

const crypto = require('crypto');
const db = require('./db');
const { safeEqual } = require('./auth');

/**
 * Event type → subscription status.
 * CANCELLATION and BILLING_ISSUE deliberately keep access: the user retains
 * Pro until `expires_at` passes. Only EXPIRATION revokes immediately.
 */
const STATUS_BY_TYPE = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  UNCANCELLATION: 'active',
  PRODUCT_CHANGE: 'active',
  TRIAL_CONVERTED: 'active',
  NON_RENEWING_PURCHASE: 'active',
  TRIAL_STARTED: 'trialing',
  CANCELLATION: 'cancelled',
  BILLING_ISSUE: 'billing_issue',
  EXPIRATION: 'expired',
};

/** Recognised but intentionally not acted on — ack so RevenueCat stops retrying. */
const NO_OP_TYPES = new Set([
  'TEST',
  'SUBSCRIBER_ALIAS',
  'SUBSCRIPTION_PAUSED',
  'SUBSCRIPTION_EXTENDED',
  'INVOICE_ISSUANCE',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'REFUND_REVERSED',
]);

const newId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

/** RevenueCat sends epoch millis; normalise "missing" and 0 to null. */
const ms = (value) => (typeof value === 'number' && value > 0 ? value : null);

/** RevenueCat's reserved `$email` subscriber attribute, when the app set it. */
const emailOf = (event) => event?.subscriber_attributes?.$email?.value || null;

/**
 * Resolve `app_user_id` to a Supabase profile.
 *
 * RevenueCat's app user id is the Supabase auth uid once a user has signed in,
 * so try that first; fall back to the `$email` attribute for purchases made
 * before sign-in. A miss is normal, not an error — the subscription row is
 * still written with `app_user_id` set and `user_id` null, and it links itself
 * up on the next event once the ids match.
 */
async function resolveProfile(appUserId, event) {
  return db.findProfile(appUserId, emailOf(event));
}

/**
 * Express handler. Mounted with `express.raw` so `req.body` is the untouched
 * Buffer — the auth header is checked before we spend anything on parsing.
 */
async function webhookHandler(req, res) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  // Fail closed: an unconfigured secret must not mean "allow everyone".
  if (!expected || !safeEqual(req.headers.authorization || '', expected)) {
    return res.status(401).json({ error: 'invalid_authorization' });
  }

  let envelope;
  try {
    envelope = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body));
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  const event = envelope?.event;
  if (!event || typeof event.type !== 'string' || typeof event.id !== 'string') {
    return res.status(400).json({ error: 'missing_event' });
  }

  try {
    return await handleEvent(event, envelope, res);
  } catch (err) {
    console.error('[webhook]', err);
    // 5xx tells RevenueCat to retry, which is what we want for a transient
    // Supabase failure — the event id keeps the retry idempotent.
    return res.status(err.status === 503 ? 503 : 500).json({
      error: err.code || 'webhook_failed',
      message: err.message,
    });
  }
}

async function handleEvent(event, envelope, res) {
  const appUserId = event.app_user_id || event.original_app_user_id;

  /**
   * Idempotency guard. `webhook_events.event_id` is UNIQUE, so a second
   * delivery of the same event is rejected by Postgres and we stop here —
   * RevenueCat retries aggressively and replays must not double-apply.
   */
  const fresh = await db.recordWebhookEvent(event, envelope);
  if (!fresh) {
    return res.status(200).json({ ok: true, duplicate: true, event_id: event.id });
  }

  if (event.type === 'TRANSFER') {
    const touched = await applyTransfer(event);
    await db.audit('revenuecat', 'webhook.TRANSFER', event.id, { users: touched });
    return res.status(200).json({ ok: true, handled: true, users: touched });
  }

  const status = STATUS_BY_TYPE[event.type];
  if (!status) {
    // Recognised-but-ignored and genuinely unknown types both ack with 200.
    await db.audit('revenuecat', `webhook.${event.type}`, event.id, {
      handled: false,
      known: NO_OP_TYPES.has(event.type),
    });
    return res.status(200).json({ ok: true, handled: false, type: event.type });
  }

  if (!appUserId) return res.status(400).json({ error: 'missing_app_user_id' });

  const profile = await resolveProfile(appUserId, event);

  await db.upsertSubscription({
    userId: profile ? profile.id : null,
    appUserId,
    productId: event.new_product_id || event.product_id || null,
    store: event.store || null,
    status,
    periodType: event.period_type || null,
    purchasedAt: ms(event.purchased_at_ms),
    expiresAt: ms(event.expiration_at_ms) || ms(event.grace_period_expiration_at_ms),
    eventId: event.id,
  });

  if (!profile) {
    // No Supabase account matches yet (purchase before signup, or a RevenueCat
    // anonymous id). The row is stored and will attach on a later event.
    await db.audit('revenuecat', `webhook.${event.type}`, appUserId, {
      event_id: event.id,
      status,
      matched_profile: false,
    });
    return res.status(200).json({
      ok: true,
      handled: true,
      type: event.type,
      app_user_id: appUserId,
      matched_profile: false,
    });
  }

  const pro = await db.recomputeProStatus(profile.id);
  await db.audit('revenuecat', `webhook.${event.type}`, profile.id, {
    event_id: event.id,
    product_id: event.product_id,
    status,
    is_pro: pro.isPro,
  });

  return res.status(200).json({
    ok: true,
    handled: true,
    type: event.type,
    app_user_id: appUserId,
    user_id: profile.id,
    is_pro: pro.isPro,
    pro_expires_at: pro.expiresAt,
  });
}

/**
 * TRANSFER carries no product; it reports that entitlements moved between
 * app_user_ids (e.g. anonymous → signed-in). Reassign the subscription rows and
 * recompute both sides so the old account loses Pro and the new one gains it.
 */
async function applyTransfer(event) {
  const from = event.transferred_from || [];
  const to = event.transferred_to || [];
  const target = to[0];
  if (!target) return [];

  const targetProfile = await resolveProfile(target, event);
  const touched = [];

  for (const source of from) {
    const sourceProfile = await db.findProfile(source, null);
    await db.reassignSubscriptions(source, targetProfile ? targetProfile.id : null, target);
    if (sourceProfile && sourceProfile.id !== targetProfile?.id) {
      await db.recomputeProStatus(sourceProfile.id);
      touched.push(sourceProfile.id);
    }
  }

  if (targetProfile) {
    await db.recomputeProStatus(targetProfile.id);
    touched.push(targetProfile.id);
  }
  return [...new Set(touched)];
}

// --- Outbound v2 REST -------------------------------------------------------

const restConfigured = () =>
  Boolean(process.env.REVENUECAT_API_KEY && process.env.REVENUECAT_PROJECT_ID);

async function revenueCatRequest(pathname, options = {}) {
  const res = await fetch(`https://api.revenuecat.com/v2${pathname}`, {
    ...options,
    headers: {
      authorization: `Bearer ${process.env.REVENUECAT_API_KEY}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`RevenueCat ${res.status}: ${json.message || JSON.stringify(json)}`);
  return json;
}

/**
 * Grant or revoke the `pro` entitlement upstream so the change reaches the
 * device on next refresh. Returns `{ synced:false, reason }` when no API key is
 * configured — the caller still updates Supabase and tells the admin.
 */
async function setEntitlement(appUserId, grant, { expiresAt } = {}) {
  if (!restConfigured()) return { synced: false, reason: 'revenuecat-api-key-not-configured' };

  const project = encodeURIComponent(process.env.REVENUECAT_PROJECT_ID);
  const customer = encodeURIComponent(appUserId);
  const entitlement = encodeURIComponent(db.ENTITLEMENT);

  if (grant) {
    await revenueCatRequest(`/projects/${project}/customers/${customer}/entitlements/actions/grant`, {
      method: 'POST',
      body: JSON.stringify({
        entitlement_id: db.ENTITLEMENT,
        end_time_ms: expiresAt || undefined,
      }),
    });
  } else {
    await revenueCatRequest(
      `/projects/${project}/customers/${customer}/entitlements/${entitlement}/actions/revoke`,
      { method: 'POST' }
    );
  }
  return { synced: true };
}

module.exports = { webhookHandler, setEntitlement, restConfigured, STATUS_BY_TYPE, newId };
