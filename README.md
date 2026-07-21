# Calqulate

A GLP-1 health companion — React Native (Expo SDK 57, expo-router).

```bash
npm install
cp .env.example .env   # add your Supabase URL + anon key
npm start              # then press a / i / w
```

**New here? Read [SETUP.md](SETUP.md)** — it is the ordered, click-by-click
checklist for Supabase, Firebase, RevenueCat, the stores, and an end-to-end test
plan. Without a `.env` the app still runs, storing everything on-device.

## Calqulate Metabolic Score™

The signature feature. A 0-100 daily score for how well today's habits support
metabolism and GLP-1 treatment — and, more importantly, a score the user can
*read*. Every component publishes its weight, what it earned, and the exact
action worth the rest:

```
Medication  25   Protein  20   Hydration  15   Weight check  10
Activity    10   Sleep    10   Symptoms    5   Consistency    5
```

The weights live in one place, [`src/lib/score.ts`](src/lib/score.ts), and total
exactly 100. Medication scores off the PK model rather than a checkbox, so it
reflects how much drug is actually working; full marks at 70% of steady state so
someone mid-titration isn't permanently penalised. Consistency is yesterday's
point, which is why "points available today" is usually 95, not 100. Dose
prompts only appear when a dose is genuinely due.

The home screen leads with the score and the top three actions; [`/score`](app/score.tsx)
shows the full breakdown, the action list, and a 30-day trend.

## What's here

**Onboarding** — splash → welcome → reason → account → medication → dose →
injection day → weights → permissions → premium preview. One decision per screen,
tap-once cards advance automatically, wheel pickers for doses and weights.

**Home** — the hero card answers "how am I doing today?" in one glance:
medication level, weight trend, hydration, protein, next injection. Below it:
habit checklist, coach line, quick-log row, recent trend chart.

**Tabs** — Home · Progress · (+ FAB) · Medication · Profile. The FAB opens a
quick-add sheet for weight, meal, water, symptoms, dose, photo.

**Medication level** — [`src/lib/pk.ts`](src/lib/pk.ts) is a one-compartment PK
model with first-order absorption, summed over logged doses and normalised
against the steady-state peak for the current dose. It drives the "% active"
number everywhere and the Pro forecast curve (dashed = projection). It is an
educational estimate, not a clinical measurement — the UI says so.

## Structure

```
app/                 routes (expo-router, file-based)
  onboarding/        the 8-step setup flow
  (tabs)/            home · progress · medication · profile
  score.tsx          Metabolic Score breakdown
  quick-add.tsx      FAB sheet (modal)
  paywall.tsx        Vitals (modal) · plans.tsx comparison table
src/
  theme/             tokens + light/dark provider
  components/        Screen, Card, Button, OptionCard, WheelPicker, charts, Pro
  lib/               score, pk, insights, entitlements, billing, notifications
  hooks/             notification + entitlement sync
  store/             persisted app state (AsyncStorage)
server/              Express API, RevenueCat webhook, FCM, admin panel
```

## Free vs Vitals

[`src/lib/entitlements.ts`](src/lib/entitlements.ts) is the single source of
truth for the tier split — the paywall, the comparison table at
[`/plans`](app/plans.tsx), and every `<ProGate>` read from it, so a feature can
never be Pro in one place and free in another. Free enforces a 90-day history
window; the premium plan is branded **Calqulate Vitals**.

Gate a surface by wrapping it:

```tsx
<ProGate feature="glp1.muscle-guard">
  <Card>…</Card>
</ProGate>
```

Locked cards show the feature's own promise rather than a generic upsell, and
deep-link the paywall to that feature.

## Payments — RevenueCat

[`src/lib/billing.ts`](src/lib/billing.ts) wraps `react-native-purchases`. One
entitlement (`pro`) across Play Billing, Apple IAP, and Stripe Checkout, so a
purchase on any platform unlocks all of them. Prices come from the offering, so
each store shows local currency — nothing is hardcoded for display.

The SDK is loaded lazily: in Expo Go or on web it falls back to a local stub, so
the flow stays testable without a dev build. Set the public keys in `.env`
(`EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`) and build with EAS to take
real money.

**The client is not the gate.** `profile.isPro` is a cache. RevenueCat posts to
`POST /webhooks/revenuecat` on the server, which recomputes entitlement from all
of a user's subscription rows; [`useEntitlementSync`](src/hooks/useEntitlementSync.ts)
re-checks on every cold start so a lapsed subscriber stops seeing paid surfaces.

## Push — Firebase Cloud Messaging

[`src/lib/notifications.ts`](src/lib/notifications.ts) splits the two channels
deliberately:

- **Remote (FCM)** — anything the backend decides: admin-panel campaigns, weekly
  insights, subscription notices. The device token is registered and sent to
  `POST /api/devices/register`.
- **Local** — dose day, weigh-in, hydration, morning protein. These are pure
  functions of on-device data, so they fire with no network and no server cost.
  `syncReminders` cancels and rebuilds the whole schedule, which keeps it
  idempotent on every settings change.

Requires a development build — remote push does not work in Expo Go, where
registration returns null instead of throwing. Drop `google-services.json` and
`GoogleService-Info.plist` at the project root before `eas build`; both are
gitignored and referenced from `app.json`.

## Backend — [`server/`](server/)

Express + SQLite + a zero-build admin panel. Run it with `cd server && npm install && npm start`.
It provides the RevenueCat webhook (idempotent, recomputes `is_pro` from all
subscription rows), the admin REST API, FCM sending over HTTP v1, and the admin
dashboard: Overview, Users, Subscriptions, Notifications, Feature Flags, Support,
Audit Logs, Settings. See [`server/README.md`](server/README.md) for env vars and
setup.

## Data — Supabase

[`supabase/schema.sql`](supabase/schema.sql) is the whole backend data model:
`profiles`, `logs`, `devices`, `subscriptions`, `webhook_events`, plus the admin
tables. Run it once in the Supabase SQL editor.

Two rules are enforced in Postgres rather than in the app, because the app can
be modified by anyone who downloads it:

- **RLS on every table** — a user can only read and write rows where
  `auth.uid()` matches. The anon key being public does not matter.
- **A trigger pins `is_pro`, `pro_expires_at`, and `is_admin`** on any write that
  is not from the service role. A user cannot grant themselves premium by
  editing their own profile row; only the RevenueCat webhook can.

The client is local-first: [`src/store/profile.tsx`](src/store/profile.tsx) writes
to AsyncStorage immediately and mirrors to Postgres in the background, so logging
is instant and works offline. On sign-in, [`syncWithRemote`](src/store/profile.tsx)
unions local and remote entries by id — nothing logged offline is lost, nothing
from another device is dropped. Deletes are soft, so undo works across devices.

Auth is Supabase email/password ([`src/lib/auth.ts`](src/lib/auth.ts)) with
sessions in SecureStore rather than AsyncStorage, since a refresh token is a
bearer credential. Accounts listed in `EXPO_PUBLIC_ADMIN_EMAILS` get every
premium surface unlocked in-app for testing; real authority is
`profiles.is_admin`.

## Not built yet

Progress photos (camera permission is described but not requested), health-data
sync, the protein-lookup feature the free tier caps at 3/day, body-composition
input, journal/achievements screens, and multi-medication tracking. The premium
surfaces that exist are real gates around real (if simple) analysis; the
copy promises more analysis than currently ships — `glp1.plateau-cause` and
`autopilot.adaptive-plan` have no implementation behind them yet.

## Design system

Tokens in [`src/theme/index.ts`](src/theme/index.ts). The brand palette is a
clinical teal-green primary (`#0F9F73`) with a warm yellow accent (`#D9A400`)
reserved exclusively for Vitals, so the two colours never compete for meaning.
20–24px card radii, 48px minimum touch targets, 300–400ms motion. Light and dark
are separately chosen colour sets, not an automatic inversion — the dark steps
are lighter and less saturated so they hold contrast on a near-black surface.
