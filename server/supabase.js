/**
 * The one place a Supabase client is created.
 *
 * SECURITY — SERVICE ROLE KEY, SERVER ONLY.
 * `SUPABASE_SERVICE_ROLE_KEY` bypasses every row-level-security policy in
 * `supabase/schema.sql`. That is exactly why this admin server can read all
 * profiles and why it is the only thing allowed to write `profiles.is_pro`.
 * It is also why the key must NEVER be sent to a browser, bundled into the
 * React Native app, logged, or returned from an API response. Nothing in
 * `public/` imports this module; it is required only by server-side code.
 * If it ever leaks, rotate it immediately in
 * Supabase Dashboard → Project Settings → API → "Reset service role key".
 */

const { createClient } = require('@supabase/supabase-js');

let client = null;
let cacheKey = '';

/** True when both credentials are present. Used by /api/settings and the boot warning. */
function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Thrown (not crashed on) when the server runs without credentials, so a fresh
 * clone boots, serves /login, and explains itself instead of stack-tracing.
 */
class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env ' +
        '(Supabase Dashboard → Project Settings → API) and restart the server.'
    );
    this.name = 'SupabaseNotConfiguredError';
    this.code = 'supabase_not_configured';
    this.status = 503;
  }
}

/**
 * Lazily built so `require('./db')` never throws at import time — the client is
 * only needed when a request actually touches data.
 */
function getClient() {
  if (!isConfigured()) throw new SupabaseNotConfiguredError();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key2 = `${url}|${key}`;
  if (client && cacheKey === key2) return client;

  client = createClient(url, key, {
    auth: {
      // A server has no browser storage and no user session to refresh; the
      // service role key is the credential on every request.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { 'x-application-name': 'calqulate-admin-server' } },
  });
  cacheKey = key2;
  return client;
}

/**
 * A SEPARATE client used only for `signInWithPassword` during admin login.
 *
 * It must not be the shared one: on a successful sign-in supabase-js caches the
 * returned user session in memory and starts sending that user's access token
 * on every subsequent request — which would silently downgrade the data client
 * from service-role (bypasses RLS) to that one user's permissions. Keeping a
 * throwaway instance for auth means the data client's Authorization header
 * always stays the service role key.
 */
function getAuthClient() {
  if (!isConfigured()) throw new SupabaseNotConfiguredError();
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Turns a PostgREST error into something an admin can act on. */
function raise(error, context) {
  if (!error) return;
  const err = new Error(`${context}: ${error.message || 'unknown Supabase error'}`);
  err.code = error.code || 'supabase_error';
  err.details = error.details;
  err.status = 502;
  throw err;
}

module.exports = { getClient, getAuthClient, isConfigured, raise, SupabaseNotConfiguredError };
