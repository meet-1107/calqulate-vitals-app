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

## Today Intelligence — the free hook

[`src/lib/today.ts`](src/lib/today.ts) is the daily briefing, and it is the
first thing on the home screen: GLP-1 activity, expected hunger and energy,
a protein target, a hydration target, a workout window, the Metabolic Score,
and the day's mission points.

It is free and it has value *before* the user logs anything, which is what makes
it a reason to open the app each morning rather than a chore to feed. Every
field is derived and can explain itself: protein is 1 g per lb of lean mass
(falling back to 1.6 g/kg of body weight), hydration is half an ounce per pound,
and hunger and energy follow the dose cycle. The workout window reflects when
the user actually trains once there are three activity logs, because the session
someone will really do beats the theoretically optimal one.

## Weekly report — the shareable artifact

[`app/report.tsx`](app/report.tsx) renders a card and captures it as a PNG for
the OS share sheet, so it lands in a story or a doctor's inbox as an image, not
a link that needs an account.

**On the comparison line.** A claim like "better than 93% of similar users"
needs a cohort we do not have; inventing a percentile and printing it on
something people post publicly is fabricating a statistic. The card compares
against **published clinical-trial figures** instead and names the source on its
face — "ahead of the STEP-1 average" is a claim with a citation behind it. When
real cohort data exists, the shape in
[`weeklyReport.ts`](src/lib/weeklyReport.ts) is ready for it.

Fat and muscle are split from the week's actual weight change by the model's
lean-loss fraction, so the parts always sum to the whole. Sharing is disabled
until there is enough logged for the card to say anything true.

## Predicting physiology, not the scale

A user cannot control tomorrow's weight — water, glycogen and sodium move it a
pound either way regardless of what they do. Predicting it means being wrong
about something they check every morning.

So the headline is **Tomorrow's Body Outlook** ([`outlook.ts`](src/lib/outlook.ts)):
fat-loss efficiency, muscle preservation, recovery, hunger, each with a
confidence. These are mechanisms the user controls and the model can actually
predict. The scale number still appears, deliberately demoted to a reference
line that says day-to-day movement is mostly water.

**Ranked levers** replace generic advice. Each is re-scored through the
composition engine, so the ordering is modelled rather than asserted, and a
lever already at target is *dropped entirely* — nothing makes advice feel more
automated than being told to eat more protein when you already hit your protein
goal. Those show as "Already strong" instead.

**Evidence ratings** ([`stats.ts`](src/lib/stats.ts)) are 1–4 stars from two
sources: the user's own history, and clinical support for the lever itself.
There is deliberately **no "similar users" source** — that needs a cohort we do
not have, and a star for evidence that does not exist is a fabrication. The
type is there for when it becomes real.

## Real statistics

Confidence is shown as a number, so it is computed as one: Pearson r, a t-test
on that correlation, and a two-tailed p-value from the Student-t distribution
via the regularized incomplete beta function. Verified against published
critical values (t=2.228, df=10 → p=0.0500).

The consequence that matters: **r = 0.4 scores 75% confidence at n = 10 but 97%
at n = 60.** A hand-picked number would have got that backwards.

## What your best weeks had in common

[`bodyModel.ts`](src/lib/bodyModel.ts) ranks the user's weeks by fat-loss
efficiency and reports the conditions that co-occurred in the top third — but
only when a trait is *also meaningfully rarer in the other weeks*, since a trait
present in every week explains nothing. This is a description of their history,
not a causal claim, and the copy says so.

**Your Body Model** shows completeness across six dimensions (protein
sensitivity, exercise response, sleep, hydration, medication timing, plateau
behaviour), each with what is still needed. Capped below 100 — a model of a
living person is never finished.

## Body Intelligence™ — progressive disclosure

The ladder, in [`src/lib/intelligence.ts`](src/lib/intelligence.ts):

```
Week 1  Observation    what you did
Week 2  Patterns       what tends to go with what
Week 3  Prediction     what tomorrow probably looks like   ← free
Week 4+ Optimization   what changes it                     ← Decision Engine, paid
```

**Stages advance on days elapsed AND data sufficiency, never days alone.**
Announcing "we understand your metabolism" on day 14 to someone who logged four
times would be a lie, and the first prediction would embarrass itself. A user
short on data is told exactly what is missing instead. Verified: a 30-day
account with two weigh-ins stays at Observation and reports "1 more weigh-in".

**Patterns** ([`patterns.ts`](src/lib/patterns.ts)) obey three rules, because a
confident pattern drawn from six days is a lie that happens to be well
formatted: a minimum of 10 paired observations, a minimum effect size, and
copy that says "tracks with" rather than "causes". Each card shows its own
sample size and r.

**The prediction is free** ([`prediction.ts`](src/lib/prediction.ts)) — a
least-squares fit with a real interval from residual spread, floored at ±0.9 lb
because water and glycogen swing a pound either way no matter what. Thin or
noisy data widens the interval and drops confidence, which is correct even
though it makes the feature look weaker.

**The Decision Engine is what's paid for.** It refuses to invent a satisfying
number: one day of extra protein moves the scale by hundredths of a pound, so it
says so, and leads with the composition shift instead — the effect that is
actually real. When a lever is already at target it says that too.

## Tomorrow Simulator™

[`src/lib/tomorrow.ts`](src/lib/tomorrow.ts) answers "what happens if…" instead
of "here is what happened". It shows tomorrow's score if you coast, then what
each choice would make it.

**The numbers are exact, not estimated.** Each figure is the real
`computeScore` run over hypothetical logs dated tomorrow, so a promised +20 is
precisely what the user gets by doing it. This is verified — a simulator that
mispredicts its own app is worse than none, because the user finds out. Choices
stack, and the stack is re-scored rather than summed, since the score caps at
100 and components saturate.

## The habit loop

[`src/lib/journey.ts`](src/lib/journey.ts) holds three things:

**Progressive unlock.** The first fortnight reveals something new most days —
score, trend, medication curve, coach, weekly report, body composition,
simulator. Unlocks gate on *days elapsed*, not logging volume, so missing a day
never costs ground that cannot be recovered. Home surfaces the day's reveal.

**Metabolic Streak.** Consecutive days where the score beat the day before —
chasing improvement rather than attendance. A logging streak only proves the
user opened the app.

**Accumulated history.** [`/journey`](app/journey.tsx) is the diary: day count,
weigh-ins, doses, meals, photos, milestones, and what was actually lost. None of
it is computed cleverly — it is a count of what the user did, which is precisely
why it is worth keeping.

Milestones are expressed physically, picking the *smallest* familiar object that
still gives a comprehensible count: "48 sticks of butter" is a picture, "2 house
bricks" is a shrug.

## Body Composition Engine™

[`src/lib/composition.ts`](src/lib/composition.ts) estimates how a weight change
splits into fat and lean tissue. Three layers, in order of authority:

**1. Physiology.** The baseline is Forbes' rule — the leaner you already are, the
more of any loss comes from lean tissue. It is a published relationship rather
than a tuned constant, so it anchors everything else:

```
ΔFFM / ΔWeight ≈ 10.4 / (10.4 + FatMass_kg)
```

**2. Behaviour.** Protein, resistance training, sleep, hydration, loss rate, age
and medication coverage modulate that baseline through the **Muscle Preservation
Index** (weights sum to exactly 100). Behaviour moves the split a long way but
cannot escape physiology, so the result stays bounded at 3–55% lean.

**3. Energy conservation.** A kg of fat carries ~7700 kcal; a kg of lean tissue
~1400, because lean mass is mostly water. When intake is known the partition is
*solved* rather than estimated, and that path is weighted higher:

```
7 · deficit = ΔFat · 7700 + ΔLean · 1400
```

The engine reports **confidence, not certainty**. It rises with observed inputs
and weigh-in depth, and is **capped at Moderate whenever body fat is a
population prior rather than a measurement** — the Forbes baseline sits under
every other number, so claiming "High" off an assumed starting point would be
fake precision.

[`/composition`](app/composition.tsx) shows the split, the MPI breakdown, the
"why", the single highest-value change, and a **digital twin**: stack levers
("30 g more protein", "two resistance sessions") and watch the partition move.

`leanLossFraction` now delegates here, so the coach, the weekly report and the
home screen can never disagree about the same number.

## Personal Coach

[`src/lib/coach.ts`](src/lib/coach.ts) watches the dashboard and says one thing,
in priority order — muscle loss first, then losing-too-fast, plateau, gaining,
slipping habits, and only then praise. A coach that congratulates you while you
are losing muscle is worse than no coach, so the ordering is the design.

It drives both the headline on the home screen and the coloured card under the
score: green when on track, amber to watch, red to act. Every insight carries a
concrete action that routes straight into quick-add.

Two rules worth knowing: habits are only judged when there *is* habit data
(logging nothing but weight means a low score through absence, not slipping),
and plateau detection reuses the shared detector in `insights.ts` so the coach
and the Progress screen can never disagree.

## Weight units

**Pounds are canonical.** Every stored weight — logs, start, goal, body
composition — is in lb; kg is a display conversion applied on the way out and
reversed on input ([`src/lib/units.ts`](src/lib/units.ts)). Storing display-unit
numbers would corrupt history the moment someone switched units: a 183 logged as
lb would later read as 183 kg. Switching units now changes only what is
rendered.

Default is lb for a US-first audience; the toggle lives in Settings and on the
goal screen.

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
