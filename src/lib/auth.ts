/**
 * Authentication — Supabase Auth.
 *
 * Every function returns a discriminated result rather than throwing, so screens
 * can render an error inline instead of wrapping calls in try/catch.
 *
 * When Supabase is not configured the app falls back to a local-only session so
 * the whole product remains testable before any backend exists. `local: true`
 * marks that case — nothing syncs, and the UI says so.
 */

import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { isAdminEmail, supabase } from './supabase';

export type Session = {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  local: boolean;
};

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; error: string; needsConfirmation?: boolean };

const nameFromEmail = (email: string) => {
  const handle = email.split('@')[0] ?? 'there';
  return handle.charAt(0).toUpperCase() + handle.slice(1);
};

const localSession = (email: string, name?: string): Session => ({
  userId: `local-${email.trim().toLowerCase()}`,
  email: email.trim(),
  name: name?.trim() || nameFromEmail(email),
  isAdmin: isAdminEmail(email),
  local: true,
});

/** Supabase error messages are terse; make the common ones human. */
function humanize(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password combination is not right.';
  if (m.includes('email not confirmed')) return 'Check your inbox and confirm your email first.';
  if (m.includes('already registered')) return 'An account with this email already exists. Try signing in.';
  if (m.includes('password should be')) return 'Passwords need to be at least 6 characters.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'No connection. Check your internet and try again.';
  return message;
}

export async function signUp(email: string, password: string, name?: string): Promise<AuthResult> {
  if (!supabase) return { ok: true, session: localSession(email, name) };

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name?.trim() || nameFromEmail(email) } },
  });

  if (error) return { ok: false, error: humanize(error.message) };

  // With email confirmation enabled there is a user but no session yet.
  if (!data.session) {
    return {
      ok: false,
      error: 'Almost there — confirm your email, then sign in.',
      needsConfirmation: true,
    };
  }

  return { ok: true, session: await hydrate(data.user!.id, data.user!.email!, name) };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: true, session: localSession(email) };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true, session: await hydrate(data.user.id, data.user.email!) };
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export async function sendPasswordReset(email: string): Promise<AuthResult | { ok: true }> {
  if (!supabase) return { ok: true };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: 'calqulate://reset-password',
  });
  return error ? { ok: false, error: humanize(error.message) } : { ok: true };
}

/**
 * Google sign-in, through Supabase OAuth.
 *
 * Uses the browser flow rather than a native Google SDK: it needs no extra
 * native module, works in a development build and a store build alike, and
 * Supabase already brokers the token exchange. Supabase returns an authorise
 * URL, the system browser handles consent, and the callback comes back to the
 * app's own scheme carrying the session.
 *
 * Requires Google to be enabled in Supabase (Authentication -> Providers) and
 * the redirect URL added to the allow-list. Without that the provider returns
 * an error, which is surfaced rather than swallowed.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!supabase) {
    return { ok: false, error: 'Connect Supabase before using Google sign-in.' };
  }

  try {
    const redirectTo = makeRedirectUri({ scheme: 'calqulate', path: 'auth-callback' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      return { ok: false, error: humanize(error?.message ?? 'Google sign-in is unavailable.') };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      // Dismissing the browser is a choice, not a failure worth shouting about.
      return { ok: false, error: '' };
    }

    // Supabase returns the tokens in the URL fragment.
    const fragment = result.url.split('#')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) {
      return { ok: false, error: 'Google did not return a session. Please try again.' };
    }

    const { data: session, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (sessionError || !session.user) {
      return { ok: false, error: humanize(sessionError?.message ?? 'Could not start your session.') };
    }

    return { ok: true, session: await hydrate(session.user.id, session.user.email!) };
  } catch {
    return { ok: false, error: 'Google sign-in could not complete. Check your connection.' };
  }
}

/** Restores a session on cold start, or null when signed out. */
export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return hydrate(user.id, user.email!);
}

/**
 * Reads the profile row that the `on_auth_user_created` trigger made, so the
 * session carries the authoritative admin flag rather than the client's guess.
 */
async function hydrate(userId: string, email: string, fallbackName?: string): Promise<Session> {
  const guess: Session = {
    userId,
    email,
    name: fallbackName?.trim() || nameFromEmail(email),
    isAdmin: isAdminEmail(email),
    local: false,
  };
  if (!supabase) return guess;

  const { data } = await supabase
    .from('profiles')
    .select('name, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (!data) return guess;
  return {
    ...guess,
    name: data.name || guess.name,
    isAdmin: data.is_admin || guess.isAdmin,
  };
}
