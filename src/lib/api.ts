/**
 * Thin client for the Calqulate backend (`server/`).
 *
 * Every call is best-effort: the app is fully usable offline, so a failed
 * request degrades a feature rather than breaking a screen. Nothing here throws
 * at the call site.
 */

const BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

async function post<T>(path: string, body: unknown): Promise<T | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Hands this device's FCM token to the backend so campaigns can reach it. */
export function registerDevice(input: {
  email: string;
  token: string;
  platform: string;
}) {
  return post<{ ok: boolean }>('/api/devices/register', input);
}

/**
 * Authoritative entitlement check. `profile.isPro` is only a cached mirror —
 * anything that costs money should confirm against this before unlocking.
 */
export function fetchEntitlement(email: string) {
  return post<{ isPro: boolean; expiresAt: number | null }>('/api/entitlement', { email });
}
