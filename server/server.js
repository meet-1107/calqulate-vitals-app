/**
 * Calqulate admin server — REST API, RevenueCat webhook, and the admin panel.
 *
 * Storage is Supabase Postgres (see supabase.js / db.js); admin identity is
 * Supabase Auth (see auth.js). Nothing is stored on this box.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const auth = require('./auth');
const { router: api, publicRouter } = require('./api');
const { webhookHandler } = require('./revenuecat');
const supabase = require('./supabase');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.disable('x-powered-by');
// `req.ip` is recorded in the audit log; behind a proxy the header is the truth.
app.set('trust proxy', true);

/**
 * Mounted before the JSON parser and exempt from session auth: the shared
 * secret is checked against the untouched request body/headers, so the route
 * needs the raw Buffer rather than a parsed object.
 */
app.post('/webhooks/revenuecat', express.raw({ type: '*/*', limit: '512kb' }), webhookHandler);

app.use(express.json({ limit: '256kb' }));

app.get('/healthz', (req, res) =>
  res.json({ ok: true, uptime: Math.round(process.uptime()), supabase: supabase.isConfigured() })
);

// --- Panel session ----------------------------------------------------------

/**
 * Login and the two app-facing endpoints sit under /api but before the session
 * guard. Everything registered after `requireAuth` needs a valid cookie.
 */
app.use('/api', publicRouter);

app.post('/auth/logout', (req, res) => {
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/auth/me', (req, res) => {
  const admin = auth.currentAdmin(req);
  if (!admin) return res.status(401).json({ error: 'unauthorized' });
  res.json({ admin: admin.email, id: admin.id, expiresAt: admin.exp });
});

app.use('/api', auth.requireAuth, api);

// --- Panel UI ---------------------------------------------------------------

app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));

app.get('/', (req, res) => {
  if (!auth.currentAdmin(req)) return res.redirect('/login');
  res.sendFile(path.join(PUBLIC_DIR, 'app.html'));
});

app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

/**
 * One JSON shape for every failure. A missing Supabase config is a 503 with a
 * sentence an operator can act on, not a stack trace — the panel surfaces
 * `message` directly in its error banner.
 */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  if (status >= 500 && err.code !== 'supabase_not_configured') console.error('[error]', err);
  res.status(status).json({
    error: err.code || 'internal_error',
    message: status === 500 ? 'Something went wrong on the server.' : err.message,
  });
});

if (!process.env.SESSION_SECRET) {
  console.warn('[warn] SESSION_SECRET is not set — copy .env.example to .env before using this.');
}
if (!supabase.isConfigured()) {
  console.warn(
    '[warn] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — the panel will load but every\n' +
      '       data request returns 503 "Supabase is not configured". Fill them in from\n' +
      '       Supabase Dashboard → Project Settings → API, then restart.'
  );
}
if (!process.env.ADMIN_EMAILS) {
  console.warn(
    '[warn] ADMIN_EMAILS is empty — only accounts already flagged profiles.is_admin can sign in.'
  );
}
if (!process.env.REVENUECAT_WEBHOOK_AUTH) {
  console.warn('[warn] REVENUECAT_WEBHOOK_AUTH is not set — the webhook will reject every request.');
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[calqulate] admin panel  http://localhost:${PORT}/`);
    console.log(`[calqulate] webhook      POST http://localhost:${PORT}/webhooks/revenuecat`);
  });
}

module.exports = app;
