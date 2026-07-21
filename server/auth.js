/**
 * Admin authentication.
 *
 * Identity comes from Supabase Auth — the same `auth.users` table the mobile
 * app signs in against. There is no separate admin password any more.
 *
 * Login is two checks, in order:
 *   1. `signInWithPassword` — is this a real account with this password? (401)
 *   2. Is it an admin? `profiles.is_admin = true`, or the email is listed in
 *      the ADMIN_EMAILS allowlist. (403)
 *
 * The session itself is unchanged: an HMAC-signed cookie holding
 * `base64url(payload).base64url(hmac)` where the HMAC is SHA-256 over the
 * payload keyed with SESSION_SECRET. Forging one without the secret is not
 * feasible, and the payload carries its own expiry so an old cookie cannot be
 * replayed forever. It now carries the authenticated admin's Supabase user id
 * alongside their email, so the audit trail names a real person.
 */

const crypto = require('crypto');
const { getAuthClient } = require('./supabase');
const db = require('./db');

const COOKIE = 'calq_session';
const TTL_MS = 12 * 60 * 60 * 1000;

const secret = () => process.env.SESSION_SECRET || '';

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

/** Length-independent, timing-safe string equality. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  // Hash first so differing lengths cannot short-circuit or throw.
  const ha = crypto.createHash('sha256').update(ba).digest();
  const hb = crypto.createHash('sha256').update(bb).digest();
  return crypto.timingSafeEqual(ha, hb) && ba.length === bb.length;
}

function createSession({ id, email }) {
  const payload = b64url(JSON.stringify({ id, email, exp: Date.now() + TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

function readSession(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac || !safeEqual(mac, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function currentAdmin(req) {
  return readSession(parseCookies(req.headers.cookie)[COOKIE]);
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: TTL_MS,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** ADMIN_EMAILS as a lowercase set. Blank entries are ignored. */
function adminAllowlist() {
  return new Set(
    String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Verify an email/password pair against Supabase Auth and decide whether the
 * account may use the admin panel.
 *
 * Returns `{ ok: true, admin }` or `{ ok: false, status, error }` — the caller
 * turns that into a response. 401 means "not a valid account"; 403 means "valid
 * account, but not an admin". Those are deliberately distinct: a non-admin who
 * typed their own correct password should not be told it was wrong.
 */
async function authenticateAdmin(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { ok: false, status: 400, error: 'email_and_password_required' };
  }

  const client = getAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password: String(password),
  });

  if (error || !data?.user) {
    return { ok: false, status: 401, error: 'invalid_credentials' };
  }

  const user = data.user;
  // Drop the user session immediately — this server never acts as the user.
  try {
    await client.auth.signOut();
  } catch {
    /* best effort; the client is thrown away regardless */
  }

  const profile = await db.getProfileById(user.id);
  const allowlisted = adminAllowlist().has(String(user.email || cleanEmail).toLowerCase());
  const isAdmin = Boolean(profile?.is_admin);

  if (!isAdmin && !allowlisted) {
    return { ok: false, status: 403, error: 'not_an_admin' };
  }

  /**
   * Bootstrap: an owner who put themselves in ADMIN_EMAILS becomes a real admin
   * on first login. Only the service role can write `is_admin` (the
   * `protect_privileged_columns` trigger pins it for everyone else), so this is
   * how you get an admin without opening the SQL editor.
   */
  let promoted = false;
  if (!isAdmin && allowlisted && profile) {
    await db.setProfileAdmin(user.id, true);
    promoted = true;
    await db.audit(cleanEmail, 'admin.promote', user.id, {
      reason: 'email listed in ADMIN_EMAILS',
    });
  }

  return {
    ok: true,
    admin: { id: user.id, email: user.email || cleanEmail },
    promoted,
    viaAllowlist: allowlisted && !isAdmin,
    // No profile row yet means the signup trigger has not run for this account;
    // the allowlist still lets them in, but nothing was promoted.
    profileMissing: !profile,
  };
}

function requireAuth(req, res, next) {
  const admin = currentAdmin(req);
  if (!admin) return res.status(401).json({ error: 'unauthorized' });
  req.admin = admin;
  next();
}

module.exports = {
  COOKIE,
  createSession,
  currentAdmin,
  setSessionCookie,
  clearSessionCookie,
  authenticateAdmin,
  adminAllowlist,
  requireAuth,
  safeEqual,
};
