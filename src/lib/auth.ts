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
