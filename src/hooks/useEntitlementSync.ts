import { useEffect } from 'react';
import { identify, refreshEntitlement } from '../lib/billing';
import { fetchEntitlement } from '../lib/api';
import { useProfile } from '../store/profile';

/**
 * Re-checks Pro on launch.
 *
 * RevenueCat is asked first (it knows about renewals, refunds, and expiries
 * that happened while the app was closed); the backend is the fallback when the
 * native SDK is unavailable. Either way `profile.isPro` is only a cache — it is
 * refreshed here so a lapsed subscriber stops seeing paid surfaces.
 */
export function useEntitlementSync() {
  const { ready, profile, patchProfile } = useProfile();
  const { signedIn, email, isPro } = profile;

  useEffect(() => {
    if (!ready || !signedIn || !email) return;
    let cancelled = false;

    (async () => {
      await identify(email);

      const fromStore = await refreshEntitlement();
      const active = fromStore ?? (await fetchEntitlement(email))?.isPro ?? null;

      if (!cancelled && active != null && active !== isPro) {
        patchProfile({ isPro: active });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs on sign-in and on cold start, not on every entitlement flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn, email]);
}
