# Plan: authentication, user accounts and plans

**Status:** decisions answered (2026-10-30), waiting for the go-ahead. Nothing is implemented.
Prices and provider behaviour below are as of 2026-10-30. Re-check them before acting on them.
**Scope:** API (`apps/api`), mobile app (`apps/mobile`) and Supabase setup.

## Goal

Every person signs in and gets their own account: their own food log, their own daily
targets, and a **plan** (`basic` or `premium`) that future features can check. Today there is
one shared food log that everyone using the app sees and edits.

Payments for premium are **out of scope**. This plan only stores which plan a user is on, so
features can be gated on it later.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Who runs sign-in? | **Supabase Auth.** Supabase handles the Google and Apple sign-in, issues and refreshes tokens, and keeps the sign-in records. Our API only verifies Supabase's tokens; profiles, plans, targets and food logs stay in our Postgres on Railway |
| 2 | Sign-in methods | **Google, Apple, and email with a one-time code** (no passwords; added 2026-10-30). Apple's rule 4.8 requires a privacy-focused option such as Sign in with Apple whenever Google is offered |
| 3 | The current shared food log | **Given to the owner's account.** A one-off script assigns every existing entry to your user once you've signed in |
| 4 | Do food search and food details need sign-in? | **Yes, every endpoint except health.** It also keeps the food database from being scraped |
| 5 | Guest mode (using the app without an account) | **No.** A synced food log is account-based, which Apple's rules allow |

## Architecture

```
                 ┌──────────── sign in, refresh tokens ────────────┐
                 │                                                 ▼
  Mobile app ────┤                                        Supabase Auth
  (supabase-js)  │                                        (Google, Apple, sessions)
                 │                                                 │ publishes signing keys (JWKS)
                 └── API calls + "Authorization: Bearer <Supabase access token>" ──▶ Nora API ◀──┘
                                                                              │
                                                                              ▼
                                                        Postgres on Railway: users (profile, plan,
                                                        targets), food log, foods
```

- **Supabase is used for authentication only.** We don't use Supabase's database for app data.
- **Two user records, one id.** The Supabase user's id (a UUID, the token's `sub`) **is** our
  `users.id`. Sign-in data lives in Supabase (`auth.users`); everything about the person as a
  Nora user lives in our database.
- **The API creates the user row on first sight.** The first request with a valid token
  creates the `users` row from the token's email and name. There is no separate sign-up step.
- **Two Supabase projects**, matching our two environments: `nora-development` and
  `nora-production`. Each has its own users, keys and settings.

### Cost

| Plan | Price | Includes | Catch |
|---|---|---|---|
| Free | $0 | 50,000 monthly active users, 2 active projects, Google/Apple included | **A project pauses after 1 week of inactivity**, and while paused nobody can sign in |
| Pro | $25/month | 100,000 monthly active users, then $0.00325 per user | No pausing |

**Decision: both projects start on the Free plan.** Moving to Pro is decided later, based on
how many users the app has.

- **Development:** Free. If it pauses after a quiet week, unpause it in the dashboard.
- **Production:** Free for now. The Free plan's 50,000 monthly active users is far beyond what
  the app needs at launch. The real risk is **pausing**: a paused production project locks
  every user out until it's unpaused by hand.
  - Check Supabase's current rule for what counts as activity; regular sign-ins and token
    refreshes from real users may be enough.
  - Watch the project's usage page and Supabase's emails.
  - Unpause straight away if it happens.
- **When to revisit** (any of these):
  - the production project pauses even once while people use the app;
  - monthly active users approach the free limit;
  - Pro features are needed (no pausing, backups and support).
  At that point Pro is $25/month and takes the cheapest production setup from ~$5–10/month
  (Railway alone) to ~$30–35/month.

## How sign-in works

### Google (works in Expo Go, on simulator and physical phone)

This is Supabase's OAuth flow through the system browser. No native module is involved, so it
runs in Expo Go now and in store builds later:

1. `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })`
   returns Supabase's sign-in URL.
   - `redirectTo` comes from `Linking.createURL('auth/callback')`: `noraainutrition://auth/callback`
     in builds, `exp://…/--/auth/callback` in Expo Go.
2. `WebBrowser.openAuthSessionAsync(url, redirectTo)` opens the browser sheet. The user picks a
   Google account.
3. Google returns to **Supabase's** callback (`https://<project>.supabase.co/auth/v1/callback`).
   Supabase verifies Google's answer, creates or finds the user, and redirects to `redirectTo`.
4. With the client created with `flowType: 'pkce'`, the returned URL carries a one-time `code`.
   The app calls `supabase.auth.exchangeCodeForSession(code)` to get the session (access and
   refresh token).
   - Supabase's Expo example instead reads the tokens straight from the URL, the older implicit
     flow. PKCE is the safer choice: an intercepted code is useless without the verifier that
     supabase-js keeps.

Because Google always returns to Supabase's public HTTPS callback, sign-in also works from a
physical phone during local development. Only the final hop goes to the app.

### Apple (native, iOS)

`expo-apple-authentication` is included in Expo Go and shows the native sheet Apple reviewers
expect:

1. Generate a random `nonce`, and pass its SHA-256 hash to
   `AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL], nonce })`.
2. Call `supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: <raw nonce> })`.
3. **Apple sends the name only on the very first sign-in.** When `credential.fullName` is
   present, save it with `supabase.auth.updateUser({ data: { full_name, given_name, family_name } })`.
   Our API copies it into `users.display_name` the first time it sees the user.
4. Apple may give a private relay email (`…@privaterelay.appleid.com`). Treat it as the user's
   email; never require a real one.

**Android:** no native Apple sign-in, so Android users use Google. Apple's web flow on Android
would need a Services ID and a client secret that has to be rotated every 6 months, so it's
left for later. Native-only Apple sign-in needs no rotation.

### Email with a one-time code (no password)

1. The user types their email. The app calls
   `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`, and Supabase
   emails a 6-digit code. The first time an address is used, this also creates the account.
2. The user types the code. The app calls
   `supabase.auth.verifyOtp({ email, token: code, type: 'email' })` and is signed in.
3. A new code can be requested once a minute (Supabase's default limit). Codes expire after 1
   hour by default.

There are no passwords, so there's nothing to reset. The code is in `src/services/auth/sign-in.ts`
(`sendEmailCode`, `verifyEmailCode`) and `src/components/auth/email-sign-in.tsx`.

### Sessions and tokens

- Supabase issues an **access token** (a JWT, valid about 1 hour by default) and a **refresh
  token**. supabase-js refreshes in the background. Call `startAutoRefresh()` when the app
  comes to the foreground and `stopAutoRefresh()` when it goes to the background.
- **Storage on the phone:** session data is larger than `expo-secure-store`'s ~2 KB per value.
  Use the encrypted adapter from Supabase's Expo guide: a random key in SecureStore (Keychain or
  Keystore), and the session encrypted with it in AsyncStorage. Confirm its packages run in
  Expo Go when implementing; if one doesn't, fall back to AsyncStorage until the first store
  build.
- **Our API only ever sees access tokens.** Refresh tokens stay between the app and Supabase.
- **Sign out:** `supabase.auth.signOut()`.
- **Same email, two providers:** if a user signs in with Google and later with Apple using the
  same verified email, Supabase links both to one user (check the identity-linking setting).
  Apple private-relay emails won't match, so those become separate users.

## Verifying tokens in our API

A single FastAPI dependency, `get_current_user`, used by every protected route:

1. Read `Authorization: Bearer <token>`. If it's missing, answer **401** with
   `WWW-Authenticate: Bearer`.
2. Verify with **PyJWT**. `PyJWKClient` fetches Supabase's public keys from
   `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` and caches them.
   - Algorithms: `ES256` (Supabase's recommended asymmetric key) and `RS256`. Never the legacy
     shared secret (`HS256`); new projects should use asymmetric signing keys.
   - Check `iss == <SUPABASE_URL>/auth/v1`, `aud == "authenticated"`, `exp`, and
     `role == "authenticated"`.
   - Expected claims: `sub`, `email`, `role`, `aud`, `exp`, `user_metadata` (name, avatar),
     `app_metadata`. Check them against Supabase's JWT claims reference when implementing.
3. Load the `users` row by `sub`, creating it if missing, from `email`,
   `user_metadata.full_name` / `name` and `user_metadata.avatar_url` / `picture`. If the email in
   the token changed, update it.
4. Any verification failure (bad signature, expired, wrong issuer or audience) is **401**.

The API needs no Supabase secret to verify tokens; it only needs the public keys. The one
server-side secret is used to delete accounts (below).

## Data model

**`users`** (new)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID, primary key | **The Supabase user id.** No foreign key, since `auth.users` lives in Supabase's database |
| `email` | text, nullable | From the token; may be an Apple relay address. Not unique here, since Supabase owns identity |
| `display_name` | text, nullable | Google name, or Apple's name from the first sign-in. Editable |
| `avatar_url` | text, nullable | Google picture |
| `plan` | text, not null, default `'basic'`, check in (`basic`, `premium`) | What future features check |
| `plan_expires_at` | timestamptz, nullable | Reserved for subscriptions. `null` = no expiry |
| `kcal_target`, `protein_target_g`, `carbs_target_g`, `fat_target_g`, `fiber_target_g` | numeric, not null, defaults 2000 / 150 / 220 / 70 / 28 | Replace the app's hard-coded `TARGETS` |
| `created_at`, `updated_at`, `last_seen_at` | timestamptz | |

**Changes to `food_log_entries`:**
- add `user_id` UUID, FK → `users` on delete cascade, indexed together with `logged_on`;
- every query in `app/services/food_log.py` filters on the current user;
- another user's entry id answers **404**, not 403, so ids don't reveal that an entry exists.

Migration order:
1. Create `users`, and add `user_id` as **nullable**.
2. You sign in once (which creates your `users` row). Then run `python scripts/claim_shared_log.py <your email>`,
   which assigns every entry without a user to you. Run it in each environment that has data.
3. A second migration makes `user_id` **not null**.

The sign-in tables of our earlier draft (identities, sessions, login codes) are not needed:
Supabase keeps those.

## API endpoints

| Method and path | Auth | Purpose |
|---|---|---|
| `GET /api/v1/users/me` | access token | Profile: name, email, avatar, plan, targets. Creates the row on first call |
| `PATCH /api/v1/users/me` | access token | Change display name and daily targets |
| `DELETE /api/v1/users/me` | access token | Delete the account and all its data. Apple rule 5.1.1(v) requires this in the app |
| `GET/POST/PATCH/DELETE /api/v1/meals/...` | access token | As today, scoped to the current user |
| `GET /api/v1/foods`, `GET /api/v1/foods/{id}` | access token | As today (decision 4) |
| `GET /api/v1/health` | none | Unchanged |

- Sign-in, sign-out and token refresh are Supabase endpoints called by supabase-js. Our API has
  **no `/auth` routes**, so the placeholder `app/api/routes/auth.py` is removed.
- The `users.py` placeholder is replaced by the endpoints above.
- **Account deletion:**
  - deletes our `users` row (the food log goes with it, by cascade);
  - then deletes the Supabase user through the Admin API
    (`DELETE <SUPABASE_URL>/auth/v1/admin/users/<id>`, with the project's **secret key**).
- **Apple token revocation on deletion:** Apple requires apps to revoke a user's Sign in with
  Apple tokens when their account is deleted. Check whether Supabase does this on user
  deletion. If it doesn't, add a revoke call to Apple's REST API before the first App Store
  submission; that needs the Apple Developer account's Sign in with Apple key.

### Plans (basic / premium)

- `GET /users/me` returns `plan`. A dependency `require_plan("premium")` lets a future endpoint
  answer **403** with a clear message for basic users. Nothing uses it yet.
- The plan lives in **our** `users` table, not in Supabase. That keeps one source of truth next to the
  data it unlocks, and a webhook from the payment provider can set it later.
- Until payments exist, a user is made premium by hand: `python scripts/set_plan.py
  <email> premium`.
- For later: on iOS, unlocking features must go through **Apple's in-app purchase** (rule
  3.1.1), and through Google Play Billing on Android. The usual approach is a service like
  RevenueCat that handles both stores and calls our API's webhook, which sets `plan` and
  `plan_expires_at`.

## Mobile app

**New packages:** `@supabase/supabase-js`, `expo-apple-authentication`, `expo-secure-store`,
`expo-crypto` (nonce and hashing), plus whatever Supabase's encrypted storage adapter needs.
`expo-web-browser`, `expo-linking` and `@react-native-async-storage/async-storage` are already
installed.

1. **Supabase client:** `src/services/auth/supabase.ts`, using `createClient(url,
   publishableKey, { auth: { storage, flowType: 'pkce', autoRefreshToken: true,
   persistSession: true, detectSessionInUrl: false } })`.
   - `AGENTS.md` says network calls go through `src/services/api/`. Supabase's client is the one
     exception, only for auth; add that to `AGENTS.md`.
2. **`src/features/auth/AuthProvider`** (React context):
   - holds the Supabase session and our profile from `GET /users/me`;
   - exposes `user`, `signInWithGoogle()`, `signInWithApple()`, `signOut()` and
     `deleteAccount()`;
   - listens to `onAuthStateChange`.
3. **API client** (`src/services/api/client.ts`):
   - adds `Authorization: Bearer <session.access_token>` to every request;
   - on a 401, calls `supabase.auth.refreshSession()` once and retries;
   - if that fails, signs out.
   - New wrappers in `src/services/api/users.ts`, with types in `types.ts`.
4. **Routing** (Expo Router): a `sign-in` screen outside the tabs. The root layout uses
   protected routes (`Stack.Protected guard={signedIn}`), so signed-out users only see sign-in.
5. **Sign-in screen:**
   - "Continue with Apple" (iOS only, Apple's official button component) and "Continue with
     Google";
   - links to the privacy policy and terms, which both stores require.
6. **Profile tab** (a new tab):
   - the nutrition plan first: the daily targets, **read-only**, and a **Change plan** button.
     Plans change only by answering questions again (`ai-nutrition-plan.md`), never by typing
     numbers in; decided 2026-10-30;
   - an **Account** section at the bottom: name, email, avatar, a **Basic / Premium** badge,
     Sign out, and Delete account behind a confirmation.
7. **Targets from the profile:** replace the hard-coded `TARGETS` in
   `src/features/food/data/mock-data.ts` (37 uses) with the signed-in user's targets.
8. **App config:** set `ios.bundleIdentifier` and `android.package` (for example
   `com.raresmaier.nora`), plus `ios.usesAppleSignIn: true` and the
   `expo-apple-authentication` plugin for builds.

## Configuration

**API** (per Railway environment, and `.env` locally):

| Setting | Example | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://abcd1234.supabase.co` | The environment's Supabase project. Builds the JWKS URL and the expected issuer |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | **Secret.** Used only to delete Supabase users. Never in the app |

**Mobile** (`.env.local`, and GitHub environment variables for the publish workflow):

| Setting | Example | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://abcd1234.supabase.co` | Public |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Public by design (the replacement for the legacy "anon" key) |

`.github/workflows/mobile.yml` passes both variables to `eas update`, like `API_URL`, from the
`development` and `production` GitHub environments.

**New API dependency:** `PyJWT[crypto]` (JWT verification with ES256/RS256 keys). The Admin
API call uses `httpx`, which is already installed.

## Setup (manual, done once per Supabase project)

1. **Supabase:** create `nora-development` and `nora-production`.
   - Under Authentication → Settings, use **asymmetric JWT signing keys** (ES256).
   - Copy the project URL, the publishable key and the secret key into the settings above.
2. **Google Cloud** (free):
   - Set up the OAuth consent screen: External, scopes `openid email profile`. Basic scopes
     need no review; move the app from *Testing* to *In production* when ready.
   - Create an OAuth client of type **Web application**, with authorized redirect URI
     `https://<project>.supabase.co/auth/v1/callback` (one per Supabase project).
   - In Supabase, under Authentication → Providers → **Google**: enable it, and paste the
     client id and secret.
3. **Apple:**
   - In Supabase, under Authentication → Providers → **Apple**: enable it. Under **Client IDs**,
     list our bundle id, and in the development project only also Expo Go's id
     `host.exp.Exponent`.
   - Leave the OAuth (web) settings empty; native-only sign-in doesn't need them.
   - **Store builds** need the **Apple Developer Program ($99/year)**, with *Sign in with
     Apple* enabled for our bundle id.
4. **Email codes** (Supabase → Authentication → Emails → Templates). By default the emails
   contain a sign-in **link**. To send a **code**, put `{{ .Token }}` in **both** the
   *Magic Link* template (existing users) and the *Confirm signup* template (new users, while
   "Confirm email" is on). For example, subject "Your Nora sign-in code", body
   `<h2>{{ .Token }}</h2><p>Enter this code in Nora to sign in. It expires in an hour.</p>`.
   - **Sending email for real users:** Supabase's built-in sender is for testing only. It sends
     very few emails per hour and may only deliver to your Supabase team members. Before
     launch, connect your own SMTP sender (Authentication → Emails → SMTP Settings). Resend and
     Brevo both have free tiers, and both need a domain you own.
5. **Redirect URLs** (Supabase → Authentication → URL Configuration):
   - both projects: `noraainutrition://**`;
   - development only, for Expo Go: `exp://**`. Check that this wildcard matches the URL
     Expo Go reports; if not, list the exact URLs.

## Local development

- **Sign in for real:** the app uses the **development** Supabase project, and the local API
  points `SUPABASE_URL` at it. Google sign-in works from Expo Go on a simulator or a physical
  phone, because Google returns to Supabase's public callback.
- **The API needs internet access** to fetch Supabase's public keys (cached after the first
  request).
- **Tests never call Supabase.** They generate an ES256 key pair, override the key lookup and
  issuer in `get_current_user`, and sign their own tokens. A test helper creates a user and a
  matching token.

## Implementation phases

Each phase is shippable on its own.

1. **Supabase and accounts (API):**
   - create the Supabase projects, plus the Google and Apple provider setup;
   - add the `users` table and the nullable `food_log_entries.user_id`;
   - add `get_current_user` with Supabase token verification, `GET/PATCH /users/me` and
     `require_plan`;
   - scope meals to the user and put foods behind auth;
   - add the claim script, then the not-null migration;
   - remove the `/auth` placeholder.
2. **Google sign-in (app):**
   - the Supabase client and encrypted session storage;
   - `AuthProvider`, protected routes and the sign-in screen with Google;
   - the bearer header with refresh-on-401;
   - the `EXPO_PUBLIC_SUPABASE_*` settings, locally and in CI.
3. **Apple sign-in (app):** the native button on iOS with `signInWithIdToken`, saving the name
   on first sign-in.
4. **Profile tab and targets (app):** the Profile tab with the read-only plan, Change plan, and an account section (Basic / Premium badge), targets replacing
   `TARGETS`, sign out.
5. **Account deletion (API and app):**
   - `DELETE /users/me`, including the Supabase Admin API call, and the in-app confirmation flow;
   - Apple token revocation, if Supabase doesn't do it.
6. **Before launch:**
   - decide whether production stays on the Supabase **Free** plan (see *Cost*), and make sure
     someone will notice and unpause it if it pauses;
   - Google consent screen to production;
   - privacy policy and terms pages;
   - review Supabase's auth rate limits;
   - add rate limiting on our API.

## Tests

- **Token verification:**
  - a valid token creates the user on first call and reuses it after;
  - expired, wrong issuer, wrong audience, wrong role, bad signature, `HS256`-signed or missing
    → 401.
- **Isolation:**
  - user A never sees, changes or deletes user B's entries (404);
  - copy-day copies only the user's own entries.
- **Profile:**
  - a new user is `basic` with default targets, and name and avatar come from the token;
  - `PATCH` validates targets (positive, sensible maximums);
  - `require_plan` → 403 for basic, passes for premium.
- **Deletion:**
  - removes the user and their entries;
  - calls the Supabase Admin API, faked in tests;
  - if the Supabase call fails, the API reports it and doesn't pretend the account is gone.
- **Claim script:** assigns only entries with no user, and refuses an unknown email.
- **App** (where practical): refresh-on-401 retries once, then signs out.

## Docs to update when implementing

- `apps/api/docs/api.md`: the users endpoints, and which endpoints need a token.
- `apps/api/docs/architecture.md`: an "Authentication" section on Supabase, token verification
  and the user row; move Authentication and User profiles to *Implemented*.
- `apps/api/docs/database.md`: `users` and `food_log_entries.user_id`.
- `apps/api/docs/development.md`: Supabase and Google setup, `.env` keys, the claim script.
- `apps/mobile/documentation/api-integration.md` and `apps/mobile/AGENTS.md`: the Supabase
  client exception, the bearer header, refresh-on-401.

## Out of scope (later)

- Payments and subscriptions: RevenueCat with Apple and Google in-app purchase, a webhook that
  sets `plan`.
- Email/password sign-in; Apple sign-in on Android.
- Linking and unlinking providers from the profile; signed-in devices with remote sign-out.
- Profile details for goal calculation (age, sex, height, weight, activity, goal).
- Admin tools beyond the `set_plan` script.
