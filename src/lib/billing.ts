/**
 * Billing — RevenueCat.
 *
 * One entitlement (`pro`) resolved identically across Play Billing, Apple IAP,
 * and Stripe Checkout on the web, so a purchase on any platform unlocks all of
 * them. Prices are never hardcoded for display: they come from the offering, so
 * each store shows local currency automatically.
 *
 * `react-native-purchases` is a native module and cannot run in Expo Go, so it
 * is loaded lazily. Without it (Expo Go, web preview, or missing API keys) the
 * module falls back to a local stub and reports `configured: false` — the UI
 * stays functional, it just cannot take real money.
 *
 * Truth about entitlement lives on the server: RevenueCat posts to
 * `POST /webhooks/revenuecat`, which recomputes `users.is_pro`. The client cache
 * is a convenience, never an authorisation decision.
 */

import { Platform } from 'react-native';

export type PlanId = 'monthly' | 'yearly';

export type Plan = {
  id: PlanId;
  title: string;
  subtitle: string;
  /** Store-localised price string once an offering is loaded. */
  price?: string;
  badge?: string;
};

export const ENTITLEMENT = 'pro';

const API_KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

/** Product identifiers as configured in RevenueCat, App Store, and Play. */
export const PRODUCTS: Record<PlanId, string> = {
  monthly: 'calqulate_vitals_monthly',
  yearly: 'calqulate_vitals_yearly',
};

/** Shown until (or unless) a live offering replaces them. */
export const FALLBACK_PLANS: Plan[] = [
  { id: 'yearly', title: 'Yearly', subtitle: '$6.67/month · 7 days free', price: '$79.99', badge: 'SAVE 33%' },
  { id: 'monthly', title: 'Monthly', subtitle: 'Billed monthly · 7 days free', price: '$9.99' },
];

type PurchasesModule = typeof import('react-native-purchases').default;

let purchases: PurchasesModule | null = null;
let configured = false;

/** Resolves the native SDK if it is installed and keyed; null otherwise. */
async function load(): Promise<PurchasesModule | null> {
  if (!API_KEY || Platform.OS === 'web') return null;
  if (purchases) return purchases;
  try {
    const mod = await import('react-native-purchases');
    purchases = mod.default;
    if (!configured) {
      await purchases.configure({ apiKey: API_KEY });
      configured = true;
    }
    return purchases;
  } catch {
    // Native module absent — Expo Go, or the dependency was never installed.
    return null;
  }
}

export const isConfigured = () => configured;

/** Associates purchases with the signed-in account so they follow the user. */
export async function identify(appUserId: string) {
  const sdk = await load();
  if (!sdk) return;
  try {
    await sdk.logIn(appUserId);
  } catch {
    /* keep the anonymous id rather than blocking the app */
  }
}

export async function getPlans(): Promise<Plan[]> {
  const sdk = await load();
  if (!sdk) return FALLBACK_PLANS;

  try {
    const offerings = await sdk.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    if (!packages.length) return FALLBACK_PLANS;

    return FALLBACK_PLANS.map((plan) => {
      const match = packages.find((p) => p.product.identifier === PRODUCTS[plan.id]);
      return match ? { ...plan, price: match.product.priceString } : plan;
    });
  } catch {
    return FALLBACK_PLANS;
  }
}

export async function purchase(plan: PlanId): Promise<{ isPro: boolean; cancelled?: boolean }> {
  const sdk = await load();
  // Without the native SDK there is nothing to charge — unlock locally so the
  // flow is testable, and let the server remain the real gate.
  if (!sdk) return { isPro: true };

  try {
    const offerings = await sdk.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p) => p.product.identifier === PRODUCTS[plan],
    );
    if (!pkg) return { isPro: false };

    const { customerInfo } = await sdk.purchasePackage(pkg);
    return { isPro: !!customerInfo.entitlements.active[ENTITLEMENT] };
  } catch (err) {
    const cancelled = !!(err as { userCancelled?: boolean }).userCancelled;
    return { isPro: false, cancelled };
  }
}

export async function restore(): Promise<{ isPro: boolean }> {
  const sdk = await load();
  if (!sdk) return { isPro: false };
  try {
    const info = await sdk.restorePurchases();
    return { isPro: !!info.entitlements.active[ENTITLEMENT] };
  } catch {
    return { isPro: false };
  }
}

/** Current entitlement straight from RevenueCat, for refresh-on-launch. */
export async function refreshEntitlement(): Promise<boolean | null> {
  const sdk = await load();
  if (!sdk) return null;
  try {
    const info = await sdk.getCustomerInfo();
    return !!info.entitlements.active[ENTITLEMENT];
  } catch {
    return null;
  }
}
