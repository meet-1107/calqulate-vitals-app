# Setting up Calqulate end to end

Everything you need to do, in the order to do it. Steps 1-3 get the app running
with real accounts and real data storage. Steps 4-7 add push, payments, and the
admin panel. Step 8 is how to prove it all works.

Budget about 2 hours for steps 1-3, and a day for the rest (most of it waiting
on store approvals).

---

## 1. Supabase — accounts and data storage

**a. Create the project.** Go to [supabase.com](https://supabase.com) → New
project. Pick a region close to your users (US East for a US launch). Save the
database password somewhere safe; you will not be shown it again.

**b. Create the tables.** Open **SQL Editor → New query**, paste the entire
contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This
creates every table, turns on Row Level Security, and adds the trigger that
makes a profile row whenever someone signs up.

Before running it, change the email near the bottom to yours:

```sql
update public.profiles
   set is_admin = true
 where email in ('you@yourdomain.com');
```

You will re-run just that one statement **after** you have signed up in the app —
it can only promote an account that already exists.

**c. Configure auth.** Go to **Authentication → Providers → Email**. Make sure
Email is enabled.

- **For testing, turn OFF "Confirm email"** so you can sign up and get straight
  into the app. Turn it back on before you launch.
- Go to **Authentication → URL Configuration** and add `calqulate://reset-password`
  to the redirect allowlist, so "Forgot password" works.

**d. Get your keys.** **Project Settings → API**. You need two values:

| Value | Where it goes | Secret? |
|---|---|---|
| Project URL | app `.env` and `server/.env` | No |
| `anon` `public` key | app `.env` | No — RLS protects the data |
| `service_role` key | `server/.env` **only** | **Yes. Never in the app.** |

The `service_role` key bypasses every security rule. If it ends up in the mobile
app it is in the hands of anyone who downloads it.

---

## 2. App environment

Copy the template and fill it in:

```bash
cp .env.example .env
```

At minimum, set these three so accounts and sync work:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_ADMIN_EMAILS=you@yourdomain.com
```

`EXPO_PUBLIC_ADMIN_EMAILS` is what gives your account full access to every
premium feature in the app without paying, so you can test the paid surfaces.

Leave the RevenueCat keys blank for now.

---

## 3. Run it

```bash
npm install
npm start
```

Press `a` for Android, `i` for iOS, `w` for web.

**What works in Expo Go:** accounts, sign-in, all logging, the Metabolic Score,
charts, sync to Supabase, and the whole UI.

**What needs a development build:** push notifications and real payments. Both
are native modules that Expo Go cannot load — the app detects this and degrades
quietly rather than crashing.

To make a development build:

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

Install the resulting APK on your phone, then `npm start` and scan the QR code.

---

## 3b. App icon

The logo inside the app is drawn as vector ([`src/components/Logo.tsx`](src/components/Logo.tsx)),
so it is already on the splash, the welcome screen, and the home top bar with no
files needed. The **store icon** must be a raster PNG, so drop your two images in:

| File | Size | What it is |
|---|---|---|
| `assets/icon.png` | 1024×1024 | Your second image — the icon-only mark |
| `assets/adaptive-icon.png` | 1024×1024 | Same mark, with the artwork inside the middle 66% (Android crops it to a circle on some launchers) |
| `assets/splash-icon.png` | 512×512 | The icon mark again, transparent background |

Then add them to `app.json` inside the `expo` block:

```json
"icon": "./assets/icon.png",
"android": { "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#FFF8E1" } }
```

Keep the full lockup (the first image, with the wordmark) for your store listing
and website — it is too detailed to read at icon size.

---

## 4. Firebase — push notifications

**a.** Create a project at [console.firebase.google.com](https://console.firebase.google.com).

**b. Add an Android app.** Package name must be exactly `com.calqulate.app`
(from `app.json`). Download `google-services.json` and put it in the project
root, next to `package.json`.

**c. Add an iOS app.** Bundle ID `com.calqulate.app`. Download
`GoogleService-Info.plist` into the project root. For iOS you also need an APNs
key: Apple Developer → Keys → new key with "Apple Push Notifications service",
then upload the `.p8` to **Firebase → Project Settings → Cloud Messaging**.

Both files are gitignored — they are per-project config, not secrets, but they
should not go in a public repo.

**d. For the server to send pushes**, go to **Project Settings → Service
accounts → Generate new private key**. That JSON gives you three values for
`server/.env`: `project_id`, `client_email`, and `private_key`.

Then rebuild: `eas build --profile development --platform android`.

---

## 5. RevenueCat — payments

**a.** Create a project at [app.revenuecat.com](https://app.revenuecat.com).

**b. Create the entitlement.** Call it exactly **`pro`** (lowercase). The app
checks for this string; a different name silently unlocks nothing.

**c. Create the products** in App Store Connect and Google Play Console first,
then attach them in RevenueCat:

| Product ID | Type |
|---|---|
| `calqulate_vitals_monthly` | Auto-renewing, monthly, $9.99, 7-day free trial |
| `calqulate_vitals_yearly` | Auto-renewing, yearly, $79.99, 7-day free trial |

You only set the US price. Both stores convert to local currency automatically —
this is why prices are never hardcoded in the app.

**d. Create an Offering** called `default`, add both products as packages, and
attach them to the `pro` entitlement.

**e. Get the public SDK keys.** Project Settings → API keys → **public**
app-specific keys, one per platform. Put them in the app `.env`:

```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...
```

**f. Set up the webhook.** Project Settings → Integrations → Webhooks:

- **URL:** `https://your-server.com/webhooks/revenuecat`
- **Authorization header:** invent a long random string. Put the *same* string
  in `server/.env` as `REVENUECAT_WEBHOOK_AUTH`. The server rejects any request
  that does not match, which is what stops someone forging a "this user paid"
  event.

This webhook is what actually grants access. The app's own `isPro` flag is just
a cache — the server recomputes the truth from RevenueCat and writes it to
`profiles.is_pro`.

---

## 6. The server and admin panel

See [`server/README.md`](server/README.md) for the full env table. In short:

```bash
cd server
cp .env.example .env     # fill in Supabase URL, service_role key, admin emails,
                         # the webhook secret, and the Firebase service account
npm install
npm start
```

Open `http://localhost:4000` and sign in with your admin account — the same
email and password you use in the mobile app. Non-admin accounts are rejected.

**To deploy it** (needed before RevenueCat can reach the webhook), any Node host
works — Railway, Render, Fly.io, or a $6 VPS. Set the same environment variables
there, and use the deployed URL in RevenueCat's webhook settings. RevenueCat
will not post to `localhost`.

---

## 7. App Store and Play Store

Nothing here is optional if you want real money.

- **Google Play:** create the app, fill in the store listing, upload a signed
  build to internal testing, create the two subscription products, and add
  yourself as a **licence tester** (Play Console → Settings → Licence testing) so
  your purchases are free and instant.
- **App Store:** create the app in App Store Connect, create the two auto-renewing
  subscriptions in a subscription group, fill in the paid-apps agreement and
  banking details, and make a **Sandbox tester** account for test purchases.
- Both stores require a **privacy policy URL** and, for a health app, a clear
  statement that you are not providing medical advice.

---

## 8. Testing it end to end

Work through this list once everything above is set up. Each step tells you
where to look to confirm it actually worked.

**Accounts**
1. Sign up with a brand-new email → you land on the medication screen.
2. In Supabase → **Table Editor → profiles**, a row exists with that email.
3. Force-quit and reopen → you go straight to the dashboard, still signed in.
4. Sign out, sign in again → your data is still there.
5. Wrong password → a readable error, not a crash.

**Data sync**
6. Log a weight, a meal, and a dose.
7. Supabase → **logs** table shows three rows with your `user_id`.
8. Sign in with the same account on a second device → the same entries appear.

**Metabolic Score**
9. The home screen shows a score and "+N points available today".
10. Log water → the score goes up and the water action disappears.
11. Open the score screen → the breakdown adds up to the total shown.

**Admin access**
12. Sign in with your admin email → the Profile tab shows an ADMIN badge and
    every premium feature is unlocked.
13. Sign in with a non-admin account → premium cards show locked with the yellow
    Vitals badge.
14. Open the admin panel in a browser, sign in with the admin account → the
    dashboard loads and your test users are listed.
15. Try the admin panel with a non-admin account → rejected.

**Payments** (development build + store test account required)
16. Tap a locked feature → the paywall opens with real store prices, in your
    local currency.
17. Buy with a sandbox/licence-test account → premium unlocks.
18. RevenueCat dashboard shows the purchase.
19. Your server logs show the webhook arriving; Supabase → `profiles.is_pro`
    flips to `true`; the `subscriptions` table has a row.
20. Force-quit and reopen the app → still premium (it re-checks on launch).
21. Cancel the sandbox subscription → access remains until the expiry date, then
    stops. This is intentional.

**Push**
22. Allow notifications during onboarding.
23. Supabase → `devices` table has your FCM token.
24. Admin panel → Notifications → send to all → it arrives on your phone.
25. Set an injection day, then check that the local reminder fires on that day.

---

## Before you launch

- Turn **email confirmation back on** in Supabase.
- Rotate anything you pasted into a chat window or committed by accident —
  especially the `service_role` key and the webhook secret.
- Confirm `.env`, `google-services.json`, and `GoogleService-Info.plist` are
  **not** in git: `git status --ignored`.
- Put the server behind HTTPS. The webhook secret travels in a header; over
  plain HTTP it is readable in transit.
- Add rate limiting to the server (see the "not production-ready" list in
  `server/README.md`).
- Get the medical disclaimer reviewed. The app estimates medication levels and
  scores habits; it must not read as diagnosis or dosing advice, and the
  Metabolic Score is not a clinical measure.
