# Calqulate admin server

Backend and web admin panel for the Calqulate GLP-1 companion app.
Node 20 + Express, **Supabase Postgres** for storage, **Supabase Auth** for admin
sign-in, and a server-served vanilla HTML/CSS/JS panel — no build step, no
bundler, no CDN.

It does four jobs:

1. **Receives RevenueCat webhooks** and keeps `subscriptions` and
   `profiles.is_pro` in Supabase in step with who actually paid.
2. **Answers the mobile app** — device (FCM token) registration and an
   entitlement check.
3. **Sends push notifications** through FCM HTTP v1 (JWT minted with Node's
   `crypto`, no `firebase-admin`).
4. **Serves an admin panel** for users, subscriptions, feature flags, support and
   audit history.

There is no local database. Every read and write goes to your Supabase project.

---

## Setup, click by click

You need two things from Supabase and one long random string. Do them in order.

### 1. Create the schema

1. Go to <https://supabase.com/dashboard> and open your project (or **New
   project** if you have not made one — pick a region near your users and save
   the database password somewhere safe).
2. In the left sidebar click **SQL Editor**, then **New query**.
3. Open `supabase/schema.sql` from this repo, copy the whole file, paste it into
   the editor, and click **Run** (bottom right). It is safe to re-run.
4. You should see "Success. No rows returned". That created `profiles`, `logs`,
   `devices`, `subscriptions`, `webhook_events`, `feature_flags`,
   `notifications`, `support_tickets` and `audit_logs`, plus their row-level
   security policies.

### 2. Copy the two Supabase values

1. Still in the dashboard, click the **gear icon → Project Settings** at the
   bottom of the left sidebar.
2. Click **API** in the settings menu.
3. Under **Project URL**, copy the URL (looks like
   `https://abcdefghijklmnop.supabase.co`). That is `SUPABASE_URL`.
4. Under **Project API keys**, find the row labelled **`service_role`** and click
   **Reveal**, then copy it. That is `SUPABASE_SERVICE_ROLE_KEY`.

> **The `service_role` key is not the `anon` key.** `anon` is the one the mobile
> app ships with, and row-level security protects it. `service_role` bypasses
> row-level security entirely — it can read and write every row for every user,
> and it is the only credential allowed to set `is_pro`. Put it in `server/.env`
> and nowhere else: never in the app, never in a browser, never committed. If it
> leaks, come back to this page and use **Reset service role key**.

### 3. Create your admin account

The panel signs you in with a real Calqulate account, so you need one:

1. Sign up in the mobile app with the email you want to administer from — or, in
   the dashboard, **Authentication → Users → Add user → Create new user** (tick
   "Auto Confirm User" so you can sign in immediately).
2. Put that email in `ADMIN_EMAILS` in `.env`.
3. The first time you sign in to the panel, the server sets
   `profiles.is_admin = true` on that account for you and records it in
   `audit_logs`. No SQL required.

To add more admins later, append their emails to `ADMIN_EMAILS` (comma
separated) and restart, or flip `profiles.is_admin` yourself in the dashboard's
**Table Editor**.

### 4. Run it

```bash
cd server
npm install
cp .env.example .env       # then edit: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
                           # ADMIN_EMAILS, SESSION_SECRET
npm start                  # or: npm run dev  (node --watch)
```

Open <http://localhost:4000>, and sign in with your Calqulate email and password.

A brand-new project is empty, and that is fine — every page renders real empty
states ("No users match these filters", "Nothing sent yet") rather than
pretending. Nothing is seeded.

If `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are missing the server still
boots and serves the login page, but every data request answers
`503 {"error":"supabase_not_configured"}` with a sentence telling you what to
set. Fill them in and restart.

---

## Environment variables

Every variable the server reads. Nothing else is consulted.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `PORT` | no | `4000` | HTTP port for the API and panel. |
| `SUPABASE_URL` | **yes** | — | Project URL. Dashboard → Project Settings → API → Project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | — | Dashboard → Project Settings → API → Project API keys → `service_role` → Reveal. Bypasses RLS. **Server only.** |
| `ADMIN_EMAILS` | no* | — | Comma-separated allowlist. Anyone here may sign in and is promoted to `profiles.is_admin` on first login. *Required unless someone already has `is_admin = true`.* |
| `SESSION_SECRET` | **yes** | — | HMAC key for the session cookie. Rotating it signs everyone out. |
| `REVENUECAT_WEBHOOK_AUTH` | **yes** | — | Shared secret compared against the webhook's `Authorization` header. Unset ⇒ the webhook rejects everything (fail closed). |
| `REVENUECAT_API_KEY` | no | — | v2 REST secret key. Lets manual Pro grants/revokes reach RevenueCat. |
| `REVENUECAT_PROJECT_ID` | no | — | RevenueCat project id (`proj…`), required alongside the API key. |
| `REVENUECAT_ENTITLEMENT_ID` | no | `pro` | Entitlement that unlocks Pro. Matches `ENTITLEMENT` in `src/lib/billing.ts`. |
| `FIREBASE_PROJECT_ID` | no | — | FCM project. |
| `FIREBASE_CLIENT_EMAIL` | no | — | Service-account email. |
| `FIREBASE_PRIVATE_KEY` | no | — | Service-account PEM, one line with `\n` escapes, quoted. |

If the RevenueCat API key is missing, grant/revoke still works but only updates
Supabase, and the panel says so in the toast. If the Firebase values are missing,
sends are recorded as **dry runs** instead of crashing.

---

## Admin login

`POST /api/login` with `{ email, password }`:

1. The pair is checked with Supabase Auth's `signInWithPassword`.
   Wrong password or unknown account → **401 `invalid_credentials`**.
2. The account must then be an admin: `profiles.is_admin = true`, or its email is
   in `ADMIN_EMAILS`. A real account that is neither → **403 `not_an_admin`**.
   (403, not 401 — someone who typed their own correct password should not be
   told it was wrong.)
3. Allowlisted-but-not-yet-admin accounts get `is_admin = true` written by the
   service role, and an `admin.promote` row in `audit_logs`.
4. On success you get the `calq_session` cookie: HttpOnly, SameSite=Lax,
   12-hour expiry, `base64url(payload).base64url(hmac-sha256(payload))` keyed
   with `SESSION_SECRET`. The payload carries the admin's Supabase user id and
   email, so the audit trail names a person.

The user session Supabase hands back at step 1 is discarded immediately — this
server never acts on a user's behalf.

---

## Pointing RevenueCat at the webhook

1. RevenueCat dashboard → your project → **Integrations → Webhooks → Add**.
2. **Webhook URL**: `https://your-host/webhooks/revenuecat`
   (locally, expose port 4000 with a tunnel — RevenueCat cannot reach `localhost`).
3. **Authorization header value**: paste exactly the same string you put in
   `REVENUECAT_WEBHOOK_AUTH`. RevenueCat sends it verbatim; the server does a
   constant-time compare and returns 401 on a mismatch.
4. **Event types**: send everything. The handler acts on `INITIAL_PURCHASE`,
   `RENEWAL`, `TRIAL_STARTED`, `TRIAL_CONVERTED`, `CANCELLATION`, `EXPIRATION`,
   `BILLING_ISSUE`, `PRODUCT_CHANGE`, `UNCANCELLATION`, `NON_RENEWING_PURCHASE`
   and `TRANSFER`, and acknowledges everything else with a 200 so RevenueCat
   stops retrying.

Notes on behaviour:

- **Idempotent.** Every delivery is inserted into `webhook_events`, whose
  `event_id` is `UNIQUE`. A replay hits the unique violation and returns
  `200 {"ok":true,"duplicate":true}` without touching subscriptions again.
- **Matched to a profile by id, then email.** RevenueCat's `app_user_id` is the
  Supabase auth uid once a user has signed in. If it is not a uuid (or does not
  exist), the `$email` subscriber attribute is tried. If neither matches, the
  subscription row is still stored with `app_user_id` set and `user_id` null, the
  response says `matched_profile: false`, and it links itself up on a later
  event.
- **Cancellation ≠ loss of access.** `CANCELLATION` and `BILLING_ISSUE` mark the
  subscription but keep Pro until `expires_at` passes, which is how RevenueCat
  models auto-renew-off and grace periods. Only `EXPIRATION` revokes immediately.
- **Pro is recomputed, not assigned.** After every event, `profiles.is_pro` is
  derived from *all* of that user's subscription rows: any row in a granting
  status (`active`, `trialing`, `cancelled`, `billing_issue`) that has not
  expired. `profiles.pro_expires_at` is the furthest expiry, or `NULL` for a
  lifetime grant.

Verify with curl (replace the uuid with a real `profiles.id`):

```bash
curl -X POST http://localhost:4000/webhooks/revenuecat \
  -H 'Authorization: <REVENUECAT_WEBHOOK_AUTH>' \
  -H 'content-type: application/json' \
  -d '{"event":{"id":"evt-1","type":"INITIAL_PURCHASE",
       "app_user_id":"00000000-0000-0000-0000-000000000000",
       "product_id":"calqulate_pro_yearly","store":"APP_STORE","period_type":"NORMAL",
       "purchased_at_ms":1784600000000,"expiration_at_ms":1816136000000,
       "entitlement_ids":["pro"]}}'
```

---

## Firebase service-account values

1. Firebase console → **Project settings → Service accounts**.
2. **Generate new private key** — a JSON file downloads.
3. Map it into `.env`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the literal `\n` escapes and wrap
     the whole value in double quotes)
4. Make sure the **Firebase Cloud Messaging API (V1)** is enabled for the project.

`fcm.js` mints an RS256 JWT for the `firebase.messaging` scope, exchanges it at
`https://oauth2.googleapis.com/token`, caches the access token until a minute
before expiry, and POSTs to
`https://fcm.googleapis.com/v1/projects/{project}/messages:send`. Tokens that come
back `UNREGISTERED` or `INVALID_ARGUMENT` are deleted from `devices`.

---

## API surface

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/login` | none | Admin sign-in (Supabase Auth + admin check) |
| `POST` | `/api/devices/register` | none | App: `{ email \| userId, token, platform }` → upsert `devices` |
| `POST` | `/api/entitlement` | none | App: `{ email \| userId }` → `{ isPro, expiresAt }` |
| `POST` | `/webhooks/revenuecat` | shared secret | RevenueCat events (auth header, raw body) |
| `POST`/`GET` | `/auth/logout` · `/auth/me` | cookie | Session teardown / who am I |
| `GET` | `/api/overview` | cookie | Stat tiles, 30-day signups, recent activity |
| `GET` | `/api/users` | cookie | Search / filter / paginate |
| `GET` | `/api/users.csv` | cookie | CSV export honouring the same filters |
| `GET` | `/api/users/:id` | cookie | Profile + subscriptions + devices + tickets + events |
| `POST` | `/api/users/:id/pro` | cookie | Grant or revoke Pro (`{grant, days, reason}`) |
| `GET` | `/api/subscriptions` | cookie | List + status/product rollups + MRR/ARR |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/feature-flags[/:key]` | cookie | Flag CRUD |
| `GET`/`POST` | `/api/notifications` | cookie | Send history / send push |
| `GET`/`PATCH` | `/api/support-tickets[/:id]` | cookie | List / change status (`open` \| `resolved`) |
| `GET` | `/api/audit-logs` | cookie | Paginated audit trail |
| `GET` | `/api/settings` | cookie | Integration status and row counts |
| `GET` | `/healthz` | none | Liveness + whether Supabase is configured |

The two app-facing endpoints identify a single user and return only that user's
data — a boolean and a timestamp for `/api/entitlement`, `{ok:true}` for
`/api/devices/register`. An unrecognised email or id gets a plain
`404 {"error":"user_not_found"}`.

---

## Files

```
server/
  server.js          Express wiring, session routes, panel serving, error shape
  supabase.js        the one service-role client (server-only) + config guard
  db.js              every Supabase query; row mappers; Pro recomputation; audit
  auth.js            Supabase-Auth admin login + HMAC-signed session cookie
  revenuecat.js      webhook handler + v2 REST grant/revoke
  fcm.js             FCM HTTP v1 with a hand-minted service-account JWT
  api.js             the /api routes (public router + protected router)
  public/login.html  login page
  public/app.html    the admin panel
```

Two shape notes, because the panel UI predates Supabase and was left untouched:
Postgres returns ISO-8601 timestamps but the panel does arithmetic on epoch
millis, so `db.js` converts on the way out; and `profiles` has no `platform` or
`last_active_at` column, so both are derived from the user's most recently seen
device (falling back to `profiles.updated_at`).

---

## Not production-ready yet

This is a working internal tool, not a hardened service. Before real traffic:

- **Roles and 2FA.** Admin is a single boolean. There is no read-only vs.
  billing-write split, no session revocation list, and no second factor. Supabase
  Auth supports MFA — wire it into `/api/login`.
- **Rate limiting and brute-force protection.** `/api/login`, `/api/entitlement`
  and `/api/devices/register` are unthrottled and unauthenticated. Add per-IP and
  per-account limits with lockout/backoff before this is public.
- **The app-facing endpoints trust their input.** `/api/entitlement` will tell
  anyone who knows an email whether that account is Pro. It should require the
  caller's Supabase JWT and read the uid from it rather than the body.
- **Stronger webhook verification.** The shared-secret header is what RevenueCat
  offers, but the endpoint should also be IP-restricted, size-capped at the
  proxy, and `webhook_events` should be pruned on a schedule.
- **HTTPS and cookie hardening.** The session cookie only sets `secure` when
  `NODE_ENV=production`. Terminate TLS, set HSTS, add CSRF protection for the
  state-changing `/api` routes (they are same-site JSON today, which is not the
  same as CSRF-proof).
- **Query efficiency.** PostgREST has no `GROUP BY`, so the rollups and the
  "active in 7 days" count fetch capped row sets and aggregate in JS. Past a few
  thousand rows these want Postgres views or RPC functions.
- **Background job for push.** Sends are done inline in the request. A few
  thousand tokens will time out the HTTP request; move it to a queue with retries
  and per-token result recording.
- **Observability.** Structured logs, error reporting, and alerting on webhook
  failures — right now a repeated 500 on the webhook is only visible in stdout.
- **Data protection.** These rows are health-adjacent (medication and dose). Add
  a retention policy, deletion/export endpoints for GDPR and CCPA requests, and
  PII redaction in the audit log.
- **Tests.** There are none checked in. The webhook state machine and the Pro
  recomputation in particular deserve unit tests against a stubbed client.
