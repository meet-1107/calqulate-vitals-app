/**
 * Admin REST API.
 *
 * Two routers live here:
 *   * `publicRouter` — login, plus the two endpoints the mobile app calls
 *     (device registration and entitlement lookup). Mounted at /api WITHOUT the
 *     session guard.
 *   * `router` — everything else, mounted behind `requireAuth`.
 *
 * All queries go through `db.js` (Supabase). Every handler is wrapped in
 * `wrap()` so a rejected promise reaches the Express error handler as a clean
 * JSON error instead of an unhandled rejection.
 */

const express = require('express');
const db = require('./db');
const auth = require('./auth');
const { setEntitlement, restConfigured } = require('./revenuecat');
const { isConfigured: supabaseConfigured } = require('./supabase');
const fcm = require('./fcm');

const router = express.Router();
const publicRouter = express.Router();

const DAY = 86400000;
const USER_STATUSES = ['all', 'pro', 'free', 'trialing', 'expiring'];
const AUDIENCES = ['all', 'pro', 'free', 'trialing', 'selected'];
/** `support_tickets.status` has a CHECK constraint of exactly these two. */
const TICKET_STATUSES = ['open', 'resolved'];

/** Express 4 does not catch rejected promises from handlers; this does. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function pagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(query.pageSize, 10) || 25));
  return { page, pageSize };
}

const asString = (value, max = 200) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

function userFilters(query) {
  return {
    q: asString(query.q, 120),
    status: USER_STATUSES.includes(query.status) ? query.status : 'all',
    platform: query.platform === 'ios' || query.platform === 'android' ? query.platform : null,
    medication: asString(query.medication, 40),
  };
}

// ===========================================================================
// Public routes (no session cookie required)
// ===========================================================================

/**
 * Admin sign-in. Verified against Supabase Auth, then checked for admin rights.
 * 401 = bad credentials. 403 = real account that is not an admin.
 */
publicRouter.post(
  '/login',
  wrap(async (req, res) => {
    const { email, password } = req.body || {};
    const result = await auth.authenticateAdmin(email, password);

    if (!result.ok) {
      if (result.status === 403) {
        await db.audit(String(email || '').toLowerCase(), 'admin.login_denied', null, {
          reason: 'not_an_admin',
        });
      }
      return res.status(result.status).json({ error: result.error });
    }

    auth.setSessionCookie(res, auth.createSession(result.admin));
    await db.audit(result.admin.email, 'admin.login', result.admin.id, {
      ip: req.ip,
      promoted: result.promoted,
    });
    res.json({ ok: true, admin: result.admin.email, promoted: result.promoted });
  })
);

/**
 * Called by the mobile app after it gets an FCM token.
 * Identifies the user by Supabase uid or email; returns 404 when neither
 * matches so a typo cannot enumerate accounts or dump an error.
 */
publicRouter.post(
  '/devices/register',
  wrap(async (req, res) => {
    const token = asString(req.body?.token, 4096);
    const platform = asString(req.body?.platform, 20).toLowerCase();
    if (!token) return res.status(400).json({ error: 'token_required' });
    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({ error: 'invalid_platform' });
    }

    const profile = await identify(req.body);
    if (!profile) return res.status(404).json({ error: 'user_not_found' });

    await db.registerDevice(profile.id, token, platform);
    // Deliberately minimal: no other user's data, and nothing about this user
    // beyond confirming the write.
    res.json({ ok: true });
  })
);

/** Entitlement check for the app: only the boolean and the expiry, nothing else. */
publicRouter.post(
  '/entitlement',
  wrap(async (req, res) => {
    const profile = await identify(req.body);
    if (!profile) return res.status(404).json({ error: 'user_not_found' });
    res.json({
      isPro: Boolean(profile.is_pro),
      expiresAt: db.toMs(profile.pro_expires_at),
    });
  })
);

/** `{ userId }` first, then `{ email }`. Returns the raw profile row or null. */
async function identify(body) {
  const userId = asString(body?.userId, 60);
  const email = asString(body?.email, 320);
  if (userId) {
    const byId = await db.getProfileById(userId);
    if (byId) return byId;
  }
  if (email) return db.getProfileByEmail(email);
  return null;
}

// ===========================================================================
// Protected routes
// ===========================================================================

// --- Overview ---------------------------------------------------------------

router.get(
  '/overview',
  wrap(async (req, res) => {
    const now = Date.now();

    const [totalUsers, activePro, trials, signups7d, openTickets, active7d, byDay, recentActivity, paying] =
      await Promise.all([
        db.countRows('profiles'),
        db.countRows('profiles', (q) => q.eq('is_pro', true)),
        db.countRows('subscriptions', (q) => q.eq('status', 'trialing')),
        db.countRows('profiles', (q) => q.gt('created_at', db.toIso(now - 7 * DAY))),
        db.countRows('support_tickets', (q) => q.neq('status', 'resolved')),
        db.activeUserCount(now - 7 * DAY),
        db.signupsByDay(now - 30 * DAY),
        db.recentAuditLogs(12),
        db.payingSubscriptions(now),
      ]);

    // MRR estimate: normalise every paying (non-trial) subscription to a
    // monthly figure using the store list price. Trials contribute nothing
    // until they convert, which is what "estimate" means here.
    let mrr = 0;
    for (const row of paying) {
      const price = db.PRODUCT_PRICES[row.product_id];
      if (price) mrr += price.usd / price.months;
    }

    res.json({
      stats: {
        totalUsers,
        activePro,
        trials,
        mrr: Math.round(mrr * 100) / 100,
        signups7d,
        active7d,
        openTickets,
        conversion: totalUsers ? Math.round((activePro / totalUsers) * 1000) / 10 : 0,
      },
      signupsByDay: byDay,
      recentActivity,
    });
  })
);

// --- Users ------------------------------------------------------------------

router.get(
  '/users',
  wrap(async (req, res) => {
    const { page, pageSize } = pagination(req.query);
    const { total, users } = await db.listUsers({ ...userFilters(req.query), page, pageSize });

    // Latest subscription status per listed user, for the "Plan" column.
    const latest = await db.latestSubscriptionByUser(users.map((u) => u.id));
    for (const user of users) {
      const sub = latest.get(user.id);
      user.sub_status = sub?.status || null;
      user.product_id = sub?.product_id || null;
    }

    res.json({ page, pageSize, total, pages: Math.ceil(total / pageSize) || 1, users });
  })
);

router.get(
  '/users.csv',
  wrap(async (req, res) => {
    const { users } = await db.listUsers({ ...userFilters(req.query), page: 1, pageSize: 100, limit: 5000 });

    const columns = [
      'id', 'email', 'name', 'created_at', 'is_pro', 'pro_expires_at',
      'medication', 'dose_mg', 'platform', 'last_active_at',
    ];
    const escape = (value) => {
      if (value === null || value === undefined) return '';
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [
      columns.join(','),
      ...users.map((row) => columns.map((c) => escape(row[c])).join(',')),
    ].join('\n');

    await db.audit(req.admin.email, 'users.export_csv', null, { count: users.length });
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="calqulate-users-${Date.now()}.csv"`);
    res.send(csv);
  })
);

router.get(
  '/users/:id',
  wrap(async (req, res) => {
    const detail = await db.getUserDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'not_found' });
    res.json(detail);
  })
);

/** Manual Pro grant/revoke. Supabase is always updated; RevenueCat only when configured. */
router.post(
  '/users/:id/pro',
  wrap(async (req, res) => {
    const profile = await db.getProfileById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'not_found' });

    const grant = req.body?.grant === true;
    const days = Math.min(3650, Math.max(1, parseInt(req.body?.days, 10) || 30));
    const reason = asString(req.body?.reason, 280) || 'manual admin action';
    const expiresAt = grant ? Date.now() + days * DAY : null;

    let sync = { synced: false, reason: 'revenuecat-api-key-not-configured' };
    let syncError = null;
    try {
      sync = await setEntitlement(profile.id, grant, { expiresAt });
    } catch (err) {
      syncError = err.message;
    }

    if (grant) {
      // Represent the comp as a real subscription row so recomputeProStatus,
      // the users list and the revenue rollups all see it consistently.
      await db.upsertManualSubscription(profile.id, expiresAt);
    } else {
      await db.expireSubscriptions(profile.id);
    }
    await db.recomputeProStatus(profile.id);
    await db.audit(req.admin.email, grant ? 'user.grant_pro' : 'user.revoke_pro', profile.id, {
      reason,
      days: grant ? days : undefined,
      revenuecat_synced: sync.synced,
      revenuecat_error: syncError,
    });

    const updated = await db.getProfileById(profile.id);
    res.json({
      user: db.mapProfile(updated),
      revenuecat: {
        synced: sync.synced,
        reason: syncError || sync.reason,
        message: sync.synced
          ? 'Entitlement updated in RevenueCat.'
          : syncError
            ? `Updated in Supabase only — RevenueCat call failed: ${syncError}`
            : 'Updated in Supabase only — set REVENUECAT_API_KEY and REVENUECAT_PROJECT_ID to sync entitlements upstream.',
      },
    });
  })
);

// --- Subscriptions ----------------------------------------------------------

router.get(
  '/subscriptions',
  wrap(async (req, res) => {
    const { page, pageSize } = pagination(req.query);
    const status = asString(req.query.status, 30);
    const store = asString(req.query.store, 30);

    const [list, rollups] = await Promise.all([
      db.listSubscriptions({ status, store, page, pageSize }),
      db.subscriptionRollups(),
    ]);

    let mrr = 0;
    for (const row of rollups.byProduct) {
      const price = db.PRODUCT_PRICES[row.product_id];
      if (!price) continue;
      mrr += (price.usd / price.months) * row.count;
    }

    res.json({
      page,
      pageSize,
      total: list.total,
      pages: Math.ceil(list.total / pageSize) || 1,
      subscriptions: list.subscriptions,
      rollups: {
        byStatus: rollups.byStatus,
        byProduct: rollups.byProduct,
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 12 * 100) / 100,
      },
    });
  })
);

// --- Feature flags ----------------------------------------------------------

router.get(
  '/feature-flags',
  wrap(async (req, res) => {
    res.json({ flags: await db.listFlags() });
  })
);

router.post(
  '/feature-flags',
  wrap(async (req, res) => {
    const key = asString(req.body?.key, 60).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key) return res.status(400).json({ error: 'key_required' });

    const flag = await db.insertFlag({
      key,
      description: asString(req.body?.description, 240),
      enabled: Boolean(req.body?.enabled),
      rollout: Math.min(100, Math.max(0, parseInt(req.body?.rollout_percent, 10) || 0)),
    });
    if (!flag) return res.status(409).json({ error: 'key_exists' });

    await db.audit(req.admin.email, 'flag.create', key, {
      enabled: Boolean(flag.enabled),
      rollout: flag.rollout_percent,
    });
    res.status(201).json({ flag });
  })
);

router.patch(
  '/feature-flags/:key',
  wrap(async (req, res) => {
    const existing = await db.getFlag(req.params.key);
    if (!existing) return res.status(404).json({ error: 'not_found' });

    const patch = {};
    if (typeof req.body?.enabled === 'boolean') patch.enabled = req.body.enabled;
    if (req.body?.rollout_percent !== undefined) {
      patch.rollout_percent = Math.min(100, Math.max(0, parseInt(req.body.rollout_percent, 10) || 0));
    }
    if (req.body?.description !== undefined) patch.description = asString(req.body.description, 240);

    const flag = await db.updateFlag(existing.key, patch);
    if (!flag) return res.status(404).json({ error: 'not_found' });

    await db.audit(req.admin.email, 'flag.update', flag.key, {
      enabled: Boolean(flag.enabled),
      rollout: flag.rollout_percent,
    });
    res.json({ flag });
  })
);

router.delete(
  '/feature-flags/:key',
  wrap(async (req, res) => {
    const removed = await db.deleteFlag(req.params.key);
    if (!removed) return res.status(404).json({ error: 'not_found' });
    await db.audit(req.admin.email, 'flag.delete', req.params.key, null);
    res.json({ ok: true });
  })
);

// --- Notifications ----------------------------------------------------------

/** Resolve an audience selector to the device tokens it covers. */
async function tokensForAudience(audience, userIds) {
  if (audience === 'selected') {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    return db.tokensForUserIds(userIds.map(String));
  }
  if (audience === 'all') return db.allDeviceTokens();

  const status = audience === 'trialing' ? 'trialing' : audience; // 'pro' | 'free'
  const { users } = await db.listUsers({
    q: '',
    status,
    platform: null,
    medication: '',
    page: 1,
    pageSize: 100,
    limit: 5000,
  });
  return db.tokensForUserIds(users.map((u) => u.id));
}

router.get(
  '/notifications',
  wrap(async (req, res) => {
    res.json({
      notifications: await db.listNotifications(),
      fcmConfigured: fcm.isConfigured(),
    });
  })
);

router.post(
  '/notifications',
  wrap(async (req, res) => {
    const title = asString(req.body?.title, 80);
    const body = asString(req.body?.body, 300);
    const audience = AUDIENCES.includes(req.body?.audience) ? req.body.audience : 'all';
    if (!title || !body) return res.status(400).json({ error: 'title_and_body_required' });

    const tokens = await tokensForAudience(audience, req.body?.userIds);
    let result;
    try {
      result = await fcm.sendToTokens(tokens, { title, body });
    } catch (err) {
      return res.status(502).json({ error: 'fcm_send_failed', message: err.message });
    }

    // Prune tokens FCM told us are dead so future sends stay clean.
    if (result.deadTokens.length > 0) await db.deleteDeviceTokens(result.deadTokens);

    const notification = await db.insertNotification({
      title,
      body,
      audience,
      sentCount: result.sent,
      dryRun: result.dryRun,
    });
    await db.audit(req.admin.email, 'notification.send', notification.id, {
      audience,
      targeted: tokens.length,
      sent: result.sent,
      dryRun: result.dryRun,
    });

    res.status(201).json({
      notification,
      targeted: tokens.length,
      sent: result.sent,
      failed: result.failed,
      droppedTokens: result.deadTokens.length,
      dryRun: result.dryRun,
      message: result.dryRun
        ? `Dry run — Firebase is not configured, so nothing was delivered. ${tokens.length} device(s) would have been targeted.`
        : `Delivered to ${result.sent} of ${tokens.length} device(s).`,
    });
  })
);

// --- Support ----------------------------------------------------------------

router.get(
  '/support-tickets',
  wrap(async (req, res) => {
    const { page, pageSize } = pagination(req.query);
    const status = asString(req.query.status, 30) || null;
    const { total, tickets } = await db.listTickets({ status, page, pageSize });
    res.json({ page, pageSize, total, pages: Math.ceil(total / pageSize) || 1, tickets });
  })
);

router.patch(
  '/support-tickets/:id',
  wrap(async (req, res) => {
    const status = req.body?.status;
    if (!TICKET_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid_status' });

    const ticket = await db.updateTicketStatus(req.params.id, status);
    if (!ticket) return res.status(404).json({ error: 'not_found' });
    await db.audit(req.admin.email, 'ticket.status', req.params.id, { status });
    res.json({ ticket });
  })
);

// --- Audit logs & settings --------------------------------------------------

router.get(
  '/audit-logs',
  wrap(async (req, res) => {
    const { page, pageSize } = pagination(req.query);
    const actor = asString(req.query.actor, 120);
    const { total, logs } = await db.listAuditLogs({ actor, page, pageSize });
    res.json({ page, pageSize, total, pages: Math.ceil(total / pageSize) || 1, logs });
  })
);

router.get(
  '/settings',
  wrap(async (req, res) => {
    const [users, subscriptions, devices, events] = await Promise.all([
      db.countRows('profiles'),
      db.countRows('subscriptions'),
      db.countRows('devices'),
      db.countRows('webhook_events'),
    ]);

    res.json({
      admin: req.admin.email,
      node: process.version,
      integrations: {
        revenueCatWebhook: Boolean(process.env.REVENUECAT_WEBHOOK_AUTH),
        revenueCatApi: restConfigured(),
        firebase: fcm.isConfigured(),
        supabase: supabaseConfigured(),
      },
      counts: { users, subscriptions, devices, events },
    });
  })
);

module.exports = { router, publicRouter };
