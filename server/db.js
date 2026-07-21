/**
 * Data layer — Supabase Postgres.
 *
 * Every read and write in this server goes through here, against the tables
 * defined in `supabase/schema.sql`: profiles, logs, devices, subscriptions,
 * webhook_events, feature_flags, notifications, support_tickets, audit_logs.
 * There is no local database any more.
 *
 * Two shape notes, because the admin panel UI was written against the old
 * SQLite schema and is deliberately left untouched:
 *
 *   * Postgres returns ISO-8601 strings for `timestamptz`; the panel's
 *     `fmtDate`/`fmtAgo` helpers do arithmetic on epoch millis. Every row that
 *     leaves this module is therefore passed through a mapper that converts
 *     timestamps to millis (and back to ISO on the way in).
 *   * `profiles` has no `platform` or `last_active_at` column. Both are derived:
 *     platform from the user's most recently seen device, last-active from the
 *     later of that device's `last_seen_at` and the profile's `updated_at`.
 */

const { getClient, raise } = require('./supabase');

/** Entitlement that unlocks Pro. Mirrors ENTITLEMENT in src/lib/billing.ts. */
const ENTITLEMENT = process.env.REVENUECAT_ENTITLEMENT_ID || 'pro';

/**
 * Statuses that still grant Pro while the period has not lapsed.
 * `cancelled` matters: RevenueCat's CANCELLATION means auto-renew was turned
 * off, not that access ended — the user keeps Pro until `expires_at`.
 * `billing_issue` is the grace period, same reasoning.
 */
const ACTIVE_STATUSES = ['active', 'trialing', 'cancelled', 'billing_issue'];

/** Store list prices, used for the revenue rollups on the panel. */
const PRODUCT_PRICES = {
  calqulate_pro_monthly: { usd: 9.99, months: 1 },
  calqulate_pro_yearly: { usd: 79.99, months: 12 },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

/** ISO timestamp → epoch millis (null-safe). */
const toMs = (value) => {
  if (value === null || value === undefined) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/** Epoch millis → ISO timestamp (null-safe). */
const toIso = (ms) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null);

const sb = () => getClient();

/** Postgres unique-violation. Used for webhook idempotency. */
const isUniqueViolation = (error) => error && error.code === '23505';

// --- Row mappers ------------------------------------------------------------

/**
 * `profiles` row → the `user` object the panel expects.
 * `extra` carries the derived platform / last-active values computed from
 * `devices`, which the caller fetches in one batched query per page.
 */
function mapProfile(row, extra = {}) {
  if (!row) return null;
  const updatedAt = toMs(row.updated_at);
  const deviceSeen = extra.lastSeenAt ?? null;
  return {
    id: row.id,
    email: row.email || null,
    name: row.name || null,
    created_at: toMs(row.created_at),
    updated_at: updatedAt,
    is_pro: row.is_pro ? 1 : 0,
    pro_expires_at: toMs(row.pro_expires_at),
    is_admin: row.is_admin ? 1 : 0,
    medication: row.medication || null,
    dose_mg: row.dose_mg === null || row.dose_mg === undefined ? null : Number(row.dose_mg),
    // `goals` is a jsonb column, handed through as a parsed object.
    goals: row.goals || null,
    units: row.units || null,
    onboarded: row.onboarded ? 1 : 0,
    platform: extra.platform || null,
    last_active_at: Math.max(deviceSeen || 0, updatedAt || 0) || null,
  };
}

function mapSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    app_user_id: row.app_user_id,
    product_id: row.product_id,
    store: row.store,
    status: row.status,
    period_type: row.period_type,
    purchased_at: toMs(row.purchased_at),
    expires_at: toMs(row.expires_at),
    revenuecat_event_id: row.revenuecat_event_id,
    created_at: toMs(row.created_at),
  };
}

const mapDevice = (row) => ({
  id: row.id,
  user_id: row.user_id,
  fcm_token: row.fcm_token,
  platform: row.platform,
  created_at: toMs(row.created_at),
  last_seen_at: toMs(row.last_seen_at),
});

const mapFlag = (row) => ({
  key: row.key,
  description: row.description,
  enabled: row.enabled ? 1 : 0,
  rollout_percent: row.rollout_percent,
  updated_at: toMs(row.updated_at),
});

const mapNotification = (row) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  audience: row.audience,
  sent_count: row.sent_count,
  dry_run: row.dry_run ? 1 : 0,
  created_at: toMs(row.created_at),
});

const mapTicket = (row) => ({
  id: row.id,
  user_id: row.user_id,
  subject: row.subject,
  body: row.body,
  status: row.status,
  created_at: toMs(row.created_at),
});

/** The panel renders `meta_json` verbatim, so the jsonb column is stringified. */
const mapAuditLog = (row) => ({
  id: row.id,
  actor: row.actor,
  action: row.action,
  target: row.target,
  meta_json: row.meta ? JSON.stringify(row.meta) : null,
  created_at: toMs(row.created_at),
});

/** The panel's user drawer calls this list "events" and reads `.type`. */
const mapWebhookEvent = (row) => ({
  event_id: row.event_id,
  type: row.event_type,
  app_user_id: row.app_user_id,
  received_at: toMs(row.received_at),
});

// --- Audit ------------------------------------------------------------------

/**
 * Append to `audit_logs`. Deliberately never throws: an audit write failing
 * must not turn a successful admin action or webhook into a 500.
 */
async function audit(actor, action, target, meta) {
  try {
    const { error } = await sb()
      .from('audit_logs')
      .insert({ actor, action, target: target ?? null, meta: meta ?? null });
    if (error) console.error('[audit] write failed:', error.message);
  } catch (err) {
    console.error('[audit] write failed:', err.message);
  }
}

// --- Profiles ---------------------------------------------------------------

async function getProfileById(id) {
  if (!isUuid(id)) return null;
  const { data, error } = await sb().from('profiles').select('*').eq('id', id).maybeSingle();
  raise(error, 'profiles.select');
  return data || null;
}

async function getProfileByEmail(email) {
  if (!email) return null;
  const { data, error } = await sb()
    .from('profiles')
    .select('*')
    .ilike('email', String(email))
    .limit(1);
  raise(error, 'profiles.select by email');
  return (data && data[0]) || null;
}

/**
 * RevenueCat's `app_user_id` is the Supabase auth uid for signed-in users, but
 * can be an anonymous id for a purchase made before sign-in. Try the id first,
 * then the `$email` subscriber attribute.
 */
async function findProfile(appUserId, email) {
  return (await getProfileById(appUserId)) || (await getProfileByEmail(email));
}

async function setProfileAdmin(id, isAdmin) {
  const { error } = await sb().from('profiles').update({ is_admin: isAdmin }).eq('id', id);
  raise(error, 'profiles.update is_admin');
}

/** Devices for a set of user ids, reduced to `{ platform, lastSeenAt }` per user. */
async function deviceSummary(userIds) {
  const out = new Map();
  const ids = [...new Set(userIds.filter(isUuid))];
  if (ids.length === 0) return out;

  const { data, error } = await sb()
    .from('devices')
    .select('user_id, platform, last_seen_at')
    .in('user_id', ids)
    .order('last_seen_at', { ascending: false });
  raise(error, 'devices.select');

  for (const row of data || []) {
    // Rows arrive newest-first, so the first one wins for `platform`.
    if (!out.has(row.user_id)) {
      out.set(row.user_id, { platform: row.platform || null, lastSeenAt: toMs(row.last_seen_at) });
    }
  }
  return out;
}

/**
 * Users list with search / filter / pagination.
 *
 * Filters that need another table (`trialing`, `platform`) are resolved to a
 * user-id set first and then applied with `.in()`, because PostgREST has no
 * correlated subqueries.
 */
async function listUsers({ q, status, platform, medication, page, pageSize, limit }) {
  const client = sb();
  let restrictIds = null;

  const intersect = (ids) => {
    const next = new Set(ids);
    restrictIds = restrictIds === null ? next : new Set([...restrictIds].filter((id) => next.has(id)));
  };

  if (status === 'trialing') {
    const { data, error } = await client
      .from('subscriptions')
      .select('user_id')
      .eq('status', 'trialing')
      .not('user_id', 'is', null)
      .limit(5000);
    raise(error, 'subscriptions.select trialing');
    intersect((data || []).map((r) => r.user_id));
  }

  if (platform === 'ios' || platform === 'android') {
    const { data, error } = await client
      .from('devices')
      .select('user_id')
      .eq('platform', platform)
      .limit(5000);
    raise(error, 'devices.select by platform');
    intersect((data || []).map((r) => r.user_id));
  }

  // An empty restriction set means "nothing can match" — short-circuit rather
  // than sending `.in('id', [])`, which PostgREST treats inconsistently.
  if (restrictIds && restrictIds.size === 0) {
    return { total: 0, users: [] };
  }

  const build = () => {
    let query = client.from('profiles').select('*', { count: 'exact' });
    if (restrictIds) query = query.in('id', [...restrictIds]);
    if (q) {
      const like = `%${q.replace(/[%,]/g, '')}%`;
      const clauses = [`email.ilike.${like}`, `name.ilike.${like}`];
      // `id` is a uuid: an exact match is the only thing Postgres will accept.
      if (isUuid(q)) clauses.push(`id.eq.${q}`);
      query = query.or(clauses.join(','));
    }
    if (status === 'pro') query = query.eq('is_pro', true);
    if (status === 'free') query = query.eq('is_pro', false);
    if (status === 'expiring') {
      query = query
        .eq('is_pro', true)
        .not('pro_expires_at', 'is', null)
        .lt('pro_expires_at', toIso(Date.now() + 14 * 86400000));
    }
    if (medication) query = query.eq('medication', medication);
    return query.order('created_at', { ascending: false });
  };

  let query = build();
  if (limit) query = query.limit(limit);
  else query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  raise(error, 'profiles.select list');

  const rows = data || [];
  const summary = await deviceSummary(rows.map((r) => r.id));
  return {
    total: count || 0,
    users: rows.map((row) => mapProfile(row, summary.get(row.id) || {})),
  };
}

async function getUserDetail(id) {
  const profile = await getProfileById(id);
  if (!profile) return null;
  const client = sb();

  const [subs, devices, tickets, activity, events] = await Promise.all([
    client.from('subscriptions').select('*').eq('user_id', id).order('purchased_at', { ascending: false, nullsFirst: false }),
    client.from('devices').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    client.from('support_tickets').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    client.from('audit_logs').select('*').eq('target', id).order('created_at', { ascending: false }).limit(25),
    client.from('webhook_events').select('*').eq('app_user_id', id).order('received_at', { ascending: false }).limit(25),
  ]);
  raise(subs.error, 'subscriptions.select for user');
  raise(devices.error, 'devices.select for user');
  raise(tickets.error, 'support_tickets.select for user');
  raise(activity.error, 'audit_logs.select for user');
  raise(events.error, 'webhook_events.select for user');

  const summary = await deviceSummary([id]);
  return {
    user: mapProfile(profile, summary.get(id) || {}),
    subscriptions: (subs.data || []).map(mapSubscription),
    devices: (devices.data || []).map(mapDevice),
    tickets: (tickets.data || []).map(mapTicket),
    activity: (activity.data || []).map(mapAuditLog),
    events: (events.data || []).map(mapWebhookEvent),
  };
}

// --- Subscriptions ----------------------------------------------------------

async function subscriptionsForUser(userId) {
  const { data, error } = await sb()
    .from('subscriptions')
    .select('status, expires_at')
    .eq('user_id', userId);
  raise(error, 'subscriptions.select for recompute');
  return data || [];
}

/**
 * Recompute `profiles.is_pro` / `pro_expires_at` from ALL of the user's
 * subscription rows.
 *
 * Never trust a single event: a user can hold several products across stores
 * (an old monthly plus a new yearly, or a transfer from another account). Pro
 * is granted when ANY row is in a status that still grants access and has not
 * expired; `expires_at IS NULL` means a lifetime / non-consumable grant. The
 * stored expiry is the furthest one out, which is what the app shows as
 * "renews on".
 *
 * Note: `supabase/schema.sql` has no `entitlement_ids` column, so the
 * entitlement filter the SQLite version applied is not possible here — the
 * webhook only ever writes rows for subscriptions it was told about, and
 * status + expiry is what decides access.
 */
async function recomputeProStatus(userId, now = Date.now()) {
  const rows = await subscriptionsForUser(userId);

  const granting = rows.filter((row) => {
    if (!ACTIVE_STATUSES.includes(row.status)) return false;
    const expires = toMs(row.expires_at);
    return expires === null || expires > now;
  });

  const isPro = granting.length > 0;
  const lifetime = granting.some((row) => toMs(row.expires_at) === null);
  const expiresAt =
    !isPro || lifetime ? null : Math.max(...granting.map((row) => toMs(row.expires_at)));

  const { error } = await sb()
    .from('profiles')
    .update({ is_pro: isPro, pro_expires_at: toIso(expiresAt) })
    .eq('id', userId);
  raise(error, 'profiles.update is_pro');

  return { isPro, expiresAt };
}

async function listSubscriptions({ status, store, page, pageSize }) {
  const client = sb();
  let query = client.from('subscriptions').select('*', { count: 'exact' });
  if (status && status !== 'all') query = query.eq('status', status);
  if (store && store !== 'all') query = query.eq('store', store);

  const { data, error, count } = await query
    .order('purchased_at', { ascending: false, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  raise(error, 'subscriptions.select list');

  const rows = (data || []).map(mapSubscription);

  // Attach the customer's name/email for the table's first column.
  const ids = [...new Set(rows.map((r) => r.user_id).filter(isUuid))];
  const byId = new Map();
  if (ids.length) {
    const profiles = await client.from('profiles').select('id, email, name').in('id', ids);
    raise(profiles.error, 'profiles.select for subscriptions');
    for (const p of profiles.data || []) byId.set(p.id, p);
  }
  for (const row of rows) {
    const profile = byId.get(row.user_id);
    row.email = profile?.email || null;
    row.name = profile?.name || null;
  }

  return { total: count || 0, subscriptions: rows };
}

/**
 * Newest subscription per user id, for the "Plan" column on the users list.
 * Ordered by expiry so "newest" means "furthest out", matching the old query.
 */
async function latestSubscriptionByUser(userIds) {
  const out = new Map();
  const ids = [...new Set(userIds.filter(isUuid))];
  if (ids.length === 0) return out;

  const { data, error } = await sb()
    .from('subscriptions')
    .select('user_id, status, product_id, expires_at')
    .in('user_id', ids)
    .order('expires_at', { ascending: false, nullsFirst: true });
  raise(error, 'subscriptions.select latest');

  for (const row of data || []) {
    if (!out.has(row.user_id)) out.set(row.user_id, row);
  }
  return out;
}

/**
 * Status counts and product rollups for the subscriptions page. Grouping is
 * done in JS because PostgREST has no GROUP BY; the row cap keeps a runaway
 * table from turning this into a full download.
 */
async function subscriptionRollups() {
  const { data, error } = await sb()
    .from('subscriptions')
    .select('status, product_id, store, expires_at')
    .limit(10000);
  raise(error, 'subscriptions.select rollups');

  const rows = data || [];
  const statusCounts = new Map();
  const productCounts = new Map();

  for (const row of rows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) || 0) + 1);
    if (!ACTIVE_STATUSES.includes(row.status)) continue;
    const key = `${row.product_id || ''}|${row.store || ''}`;
    const entry = productCounts.get(key) || { product_id: row.product_id, store: row.store, count: 0 };
    entry.count += 1;
    productCounts.set(key, entry);
  }

  return {
    byStatus: [...statusCounts].map(([status, count]) => ({ status, count })),
    byProduct: [...productCounts.values()].sort((a, b) => b.count - a.count),
    rows,
  };
}

/** One row per (user, product, store); later events update it in place. */
async function upsertSubscription({ userId, appUserId, productId, store, status, periodType, purchasedAt, expiresAt, eventId }) {
  const client = sb();
  let find = client.from('subscriptions').select('id').eq('app_user_id', appUserId).limit(1);
  find = productId === null ? find.is('product_id', null) : find.eq('product_id', productId);
  find = store === null ? find.is('store', null) : find.eq('store', store);

  const { data: existing, error: findError } = await find;
  raise(findError, 'subscriptions.select existing');

  const patch = {
    user_id: userId,
    app_user_id: appUserId,
    product_id: productId,
    store,
    status,
    period_type: periodType,
    expires_at: toIso(expiresAt),
    revenuecat_event_id: eventId,
  };
  if (purchasedAt) patch.purchased_at = toIso(purchasedAt);

  if (existing && existing[0]) {
    const { error } = await client.from('subscriptions').update(patch).eq('id', existing[0].id);
    raise(error, 'subscriptions.update');
    return existing[0].id;
  }

  const { data, error } = await client
    .from('subscriptions')
    .insert({ ...patch, purchased_at: toIso(purchasedAt) })
    .select('id')
    .single();
  raise(error, 'subscriptions.insert');
  return data.id;
}

/** Manual comp row written when an admin grants Pro from the panel. */
async function upsertManualSubscription(userId, expiresAt) {
  const client = sb();
  const { data: existing, error: findError } = await client
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('store', 'MANUAL')
    .limit(1);
  raise(findError, 'subscriptions.select manual');

  if (existing && existing[0]) {
    const { error } = await client
      .from('subscriptions')
      .update({ status: 'active', expires_at: toIso(expiresAt) })
      .eq('id', existing[0].id);
    raise(error, 'subscriptions.update manual');
    return existing[0].id;
  }

  const { data, error } = await client
    .from('subscriptions')
    .insert({
      user_id: userId,
      app_user_id: userId,
      product_id: 'admin_comp',
      store: 'MANUAL',
      status: 'active',
      period_type: 'PROMOTIONAL',
      purchased_at: new Date().toISOString(),
      expires_at: toIso(expiresAt),
      revenuecat_event_id: `manual_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    })
    .select('id')
    .single();
  raise(error, 'subscriptions.insert manual');
  return data.id;
}

async function expireSubscriptions(userId) {
  const { error } = await sb()
    .from('subscriptions')
    .update({ status: 'expired', expires_at: new Date().toISOString() })
    .eq('user_id', userId);
  raise(error, 'subscriptions.expire');
}

/** Reassign rows when RevenueCat reports a TRANSFER between app_user_ids. */
async function reassignSubscriptions(fromAppUserId, toUserId, toAppUserId) {
  const { error } = await sb()
    .from('subscriptions')
    .update({ user_id: toUserId, app_user_id: toAppUserId })
    .eq('app_user_id', fromAppUserId);
  raise(error, 'subscriptions.reassign');
}

// --- Webhook events ---------------------------------------------------------

/**
 * Idempotency guard. `webhook_events.event_id` is UNIQUE, so a duplicate insert
 * raises 23505 — RevenueCat retries aggressively and replays must not
 * double-apply. Returns false when the event was already recorded.
 */
async function recordWebhookEvent(event, payload) {
  const { error } = await sb().from('webhook_events').insert({
    event_id: event.id,
    event_type: event.type,
    app_user_id: event.app_user_id || event.original_app_user_id || null,
    payload,
  });
  if (isUniqueViolation(error)) return false;
  raise(error, 'webhook_events.insert');
  return true;
}

// --- Devices ----------------------------------------------------------------

/** Upsert on the unique `fcm_token`, so re-registering the same device is a no-op. */
async function registerDevice(userId, token, platform) {
  const { error } = await sb()
    .from('devices')
    .upsert(
      { user_id: userId, fcm_token: token, platform, last_seen_at: new Date().toISOString() },
      { onConflict: 'fcm_token' }
    );
  raise(error, 'devices.upsert');
}

async function deleteDeviceTokens(tokens) {
  if (!tokens.length) return;
  const { error } = await sb().from('devices').delete().in('fcm_token', tokens);
  raise(error, 'devices.delete');
}

async function tokensForUserIds(userIds) {
  const ids = [...new Set(userIds.filter(isUuid))].slice(0, 500);
  if (ids.length === 0) return [];
  const { data, error } = await sb().from('devices').select('fcm_token').in('user_id', ids);
  raise(error, 'devices.select tokens');
  return (data || []).map((r) => r.fcm_token);
}

async function allDeviceTokens() {
  const { data, error } = await sb().from('devices').select('fcm_token').limit(10000);
  raise(error, 'devices.select tokens');
  return (data || []).map((r) => r.fcm_token);
}

// --- Feature flags ----------------------------------------------------------

async function listFlags() {
  const { data, error } = await sb().from('feature_flags').select('*').order('key');
  raise(error, 'feature_flags.select');
  return (data || []).map(mapFlag);
}

async function getFlag(key) {
  const { data, error } = await sb().from('feature_flags').select('*').eq('key', key).maybeSingle();
  raise(error, 'feature_flags.select one');
  return data ? mapFlag(data) : null;
}

async function insertFlag({ key, description, enabled, rollout }) {
  const { data, error } = await sb()
    .from('feature_flags')
    .insert({ key, description, enabled, rollout_percent: rollout })
    .select('*')
    .single();
  if (isUniqueViolation(error)) return null;
  raise(error, 'feature_flags.insert');
  return mapFlag(data);
}

async function updateFlag(key, patch) {
  const { data, error } = await sb()
    .from('feature_flags')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select('*')
    .maybeSingle();
  raise(error, 'feature_flags.update');
  return data ? mapFlag(data) : null;
}

async function deleteFlag(key) {
  const { data, error } = await sb().from('feature_flags').delete().eq('key', key).select('key');
  raise(error, 'feature_flags.delete');
  return (data || []).length > 0;
}

// --- Notifications ----------------------------------------------------------

async function listNotifications() {
  const { data, error } = await sb()
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  raise(error, 'notifications.select');
  return (data || []).map(mapNotification);
}

async function insertNotification({ title, body, audience, sentCount, dryRun }) {
  const { data, error } = await sb()
    .from('notifications')
    .insert({ title, body, audience, sent_count: sentCount, dry_run: dryRun })
    .select('*')
    .single();
  raise(error, 'notifications.insert');
  return mapNotification(data);
}

// --- Support tickets --------------------------------------------------------

async function listTickets({ status, page, pageSize }) {
  const client = sb();
  let query = client.from('support_tickets').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  raise(error, 'support_tickets.select');

  const tickets = (data || []).map(mapTicket);
  const ids = [...new Set(tickets.map((t) => t.user_id).filter(isUuid))];
  if (ids.length) {
    const profiles = await client.from('profiles').select('id, email, name, is_pro').in('id', ids);
    raise(profiles.error, 'profiles.select for tickets');
    const byId = new Map((profiles.data || []).map((p) => [p.id, p]));
    for (const ticket of tickets) {
      const profile = byId.get(ticket.user_id);
      ticket.email = profile?.email || null;
      ticket.name = profile?.name || null;
      ticket.is_pro = profile?.is_pro ? 1 : 0;
    }
  }
  return { total: count || 0, tickets };
}

async function updateTicketStatus(id, status) {
  if (!isUuid(id)) return null;
  const { data, error } = await sb()
    .from('support_tickets')
    .update({ status })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  raise(error, 'support_tickets.update');
  return data ? mapTicket(data) : null;
}

// --- Audit logs -------------------------------------------------------------

async function listAuditLogs({ actor, page, pageSize }) {
  let query = sb().from('audit_logs').select('*', { count: 'exact' });
  if (actor) query = query.eq('actor', actor);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  raise(error, 'audit_logs.select');
  return { total: count || 0, logs: (data || []).map(mapAuditLog) };
}

// --- Overview / counts ------------------------------------------------------

async function countRows(table, apply) {
  let query = sb().from(table).select('*', { count: 'exact', head: true });
  if (apply) query = apply(query);
  const { error, count } = await query;
  raise(error, `${table}.count`);
  return count || 0;
}

/**
 * "Active in the last 7 days" = distinct users who logged something. `logs` is
 * the only table that records real app usage; the row cap keeps this bounded.
 */
async function activeUserCount(sinceMs) {
  const { data, error } = await sb()
    .from('logs')
    .select('user_id')
    .gt('logged_at', toIso(sinceMs))
    .is('deleted_at', null)
    .limit(10000);
  raise(error, 'logs.select active');
  return new Set((data || []).map((r) => r.user_id)).size;
}

/** Signups per calendar day over the last 30 days, grouped in JS. */
async function signupsByDay(sinceMs) {
  const { data, error } = await sb()
    .from('profiles')
    .select('created_at')
    .gt('created_at', toIso(sinceMs))
    .order('created_at')
    .limit(10000);
  raise(error, 'profiles.select signups');

  const counts = new Map();
  for (const row of data || []) {
    const day = String(row.created_at).slice(0, 10);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  return [...counts].map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));
}

async function recentAuditLogs(limit = 12) {
  const { data, error } = await sb()
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  raise(error, 'audit_logs.select recent');
  return (data || []).map(mapAuditLog);
}

/** Paying (non-trial, unexpired) rows, used for the MRR estimate. */
async function payingSubscriptions(now = Date.now()) {
  const { data, error } = await sb()
    .from('subscriptions')
    .select('product_id, status, expires_at')
    .in('status', ACTIVE_STATUSES.filter((s) => s !== 'trialing'))
    .limit(10000);
  raise(error, 'subscriptions.select paying');
  return (data || []).filter((row) => {
    const expires = toMs(row.expires_at);
    return expires === null || expires > now;
  });
}

module.exports = {
  ENTITLEMENT,
  ACTIVE_STATUSES,
  PRODUCT_PRICES,
  isUuid,
  toMs,
  toIso,
  audit,
  // profiles
  getProfileById,
  getProfileByEmail,
  findProfile,
  setProfileAdmin,
  listUsers,
  getUserDetail,
  mapProfile,
  // subscriptions
  recomputeProStatus,
  listSubscriptions,
  latestSubscriptionByUser,
  subscriptionRollups,
  upsertSubscription,
  upsertManualSubscription,
  expireSubscriptions,
  reassignSubscriptions,
  payingSubscriptions,
  // webhook events
  recordWebhookEvent,
  // devices
  registerDevice,
  deleteDeviceTokens,
  tokensForUserIds,
  allDeviceTokens,
  // flags
  listFlags,
  getFlag,
  insertFlag,
  updateFlag,
  deleteFlag,
  // notifications
  listNotifications,
  insertNotification,
  // support
  listTickets,
  updateTicketStatus,
  // audit + overview
  listAuditLogs,
  countRows,
  activeUserCount,
  signupsByDay,
  recentAuditLogs,
};
