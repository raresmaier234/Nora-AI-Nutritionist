# API integration

How the Expo app talks to the FastAPI backend (`apps/api/` in this repo).

## Architecture

```
Expo Mobile App ------ sign-in, token refresh ------> Supabase Auth
       |               (src/services/auth/)            (Google, Apple)
       |                                                     |
       | HTTPS (HTTP in local dev)                           | public signing keys
       | Authorization: Bearer <Supabase access token>       |
       v                                                     v
  API Client (src/services/api/)  ---------------->  FastAPI  ---- PostgreSQL
                                                         |
                                                         +------- External APIs   (planned)
                                                         |
                                                         +------- AI services     (planned)
```

The app never talks to PostgreSQL, or holds any backend secret, directly. Every request goes
through `src/services/api/apiRequest()` (or a thin wrapper around it, like `getHealth()`) —
never `fetch` directly from a component, hook, or screen.

The one other network client is supabase-js (`src/services/auth/supabase.ts`), used **for
sign-in only**: Supabase Auth runs Google and Apple sign-in and issues the access token our API
checks. App data never goes through Supabase. See [Authentication](#authentication).

## Environment variables

| Variable | Read in | What |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `src/services/api/config.ts` | Our API's base URL (below) |
| `EXPO_PUBLIC_SUPABASE_URL` | `src/services/auth/supabase.ts` | The Supabase project, e.g. `https://<ref>.supabase.co` — the **development** project locally |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `src/services/auth/supabase.ts` | That project's publishable key (`sb_publishable_…`) — public by design. Never the secret key |

Without the two Supabase variables the app still starts, but the sign-in screen says sign-in is
not configured. For EAS Update, `.github/workflows/mobile.yml` passes all three from the
`development` / `production` GitHub environments' variables `API_URL`, `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY`.

## API base URL

Configured through one environment variable, read in exactly one place —
`src/services/api/config.ts`:

```
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```

- The `EXPO_PUBLIC_` prefix is Expo's own convention: any var with that prefix is inlined into
  the JS bundle at build time automatically (no `app.json` config needed). That also means it's
  readable by anyone with the compiled app — **never put a secret in an `EXPO_PUBLIC_*` var.**
- The value is the backend's **host + port only** — no `/api/v1` suffix. `config.ts` exports
  that separately as `API_VERSION_PREFIX`, and `client.ts` appends it once, centrally, so every
  endpoint wrapper stays version-agnostic (mirrors how the backend itself enforces versioning
  in one place, `app/api/router.py`).
- If the variable isn't set, `config.ts` falls back to `http://127.0.0.1:8000` and logs a
  `__DEV__`-only warning. This is a deliberate convenience so the simulator works out of the
  box — it is **not** a safety net for a real build; there's no EAS/production pipeline yet, so
  this hasn't been hardened further.

## Environment files

- **`.env.example`** — committed, documents the variables and the three common local API URLs
  (simulator / physical device / Android emulator). No real values.
- **`.env.local`** — gitignored, holds your actual local values. Already populated with the
  simulator default (`http://127.0.0.1:8000`) so a fresh checkout works immediately; add the
  development Supabase project's URL and publishable key to sign in.
- `.gitignore` ignores `.env` and `.env.*` except `.env.example` (`!.env.example`) — so any
  `.env*` variant you create locally stays out of git by default, and only the example file is
  ever committed.

## Local development

### Backend

```bash
cd apps/api   # relative to the monorepo root
source .venv/bin/activate
uvicorn app.main:app --reload
```

This binds to uvicorn's own default, `127.0.0.1:8000` — reachable from the Mac itself and from
the iOS Simulator (which shares the Mac's network namespace), but **not** from a physical
device. For that, see "Physical iPhone" below.

### Expo

```bash
npm start
```

Then press `i` for the iOS Simulator or `a` for an Android emulator.

### iOS Simulator

No change needed — `.env.local`'s default (`http://127.0.0.1:8000`) already works, because the
simulator resolves `127.0.0.1` to the Mac itself.

### Physical iPhone

The phone is a separate device on your Wi-Fi — `127.0.0.1` on the phone means the phone, not
your Mac. Two changes are needed:

1. Start the backend bound to all interfaces, not just loopback:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0
   ```

   (Trusted/local networks only — this exposes the dev server to your whole LAN.)

2. Set `EXPO_PUBLIC_API_URL` in `.env.local` to your Mac's LAN IP:

   ```bash
   ipconfig getifaddr en0   # prints something like 192.168.1.42
   ```

   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.42:8000
   ```

   Restart Metro after changing `.env.local` (env vars are read at bundle time).

### Android emulator

Android's emulator maps `10.0.2.2` to the host machine's `localhost` — set:

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```

## How the client works

```
src/services/api/
├── config.ts   API_BASE_URL, API_VERSION_PREFIX
├── client.ts   ApiError, apiRequest<T>(path, options), describeError(err)
├── types.ts    ApiErrorKind, HealthResponse, FoodDetail, FoodLogEntry, UserProfile, ...
├── health.ts   getHealth()
├── foods.ts    searchFoods(), getFood()
├── meals.ts    listEntries(), createEntry(), updateEntry(), deleteEntry(), copyDay()
├── users.ts    getMe(), updateMe(), deleteMe()
└── index.ts    barrel export — import from '@/services/api'
```

`apiRequest<T>(path, options)`:
- `path` starts with `/` and excludes `/api/v1` (e.g. `/health`), so callers stay version-agnostic.
- Sends/expects JSON, sets `Content-Type`/`Accept` headers automatically.
- Adds `Authorization: Bearer <access token>` from the current Supabase session, when signed in.
  Every endpoint except `/health` needs it. On a **401** it refreshes the session once and
  retries; if the retry is refused too, it signs the user out (see [Authentication](#authentication)).
- Enforces a 10s timeout via `AbortController` (override with `options.timeoutMs`).
- Throws `ApiError` (never returns a partial/error-shaped success value) on any failure.
- Resolves with the parsed JSON body, typed as `T`, on success.

## How to add a new endpoint

1. Add the response (and request, if any) shape to `src/services/api/types.ts`, or a new file
   next to it if the resource is large enough to warrant its own file (health has its own
   `health.ts` for exactly this reason).
2. Add a small wrapper function that calls `apiRequest`, e.g.:

   ```ts
   // src/services/api/barcodes.ts — ILLUSTRATIVE ONLY, do not add this file yet.
   // POST /api/v1/barcodes/lookup does not exist on the backend today — only
   // GET /api/v1/barcodes exists, and it always returns 501 Not Implemented.
   // This is what the wrapper will look like once that endpoint is built for real.
   import { apiRequest } from './client';
   import type { BarcodeLookupRequest, BarcodeLookupResponse } from './types';

   export function lookupBarcode(body: BarcodeLookupRequest): Promise<BarcodeLookupResponse> {
     return apiRequest<BarcodeLookupResponse>('/barcodes/lookup', { method: 'POST', body });
   }
   ```

3. Export it from `src/services/api/index.ts`.
4. Call it from wherever the feature needs it — e.g. `src/components/log/panels/barcode-scanner-panel.tsx`
   would eventually replace its mock `BARCODES.find(...)` lookup with `lookupBarcode(...)`. Not
   done yet — see `documentation/ARCHITECTURE.md`'s note on `mock-data.ts`'s swap points.

Do not build a wrapper for an endpoint that doesn't exist on the backend yet — check
`apps/api/app/api/routes/` first (the backend's own `CLAUDE.md` prohibits
documenting/faking endpoints that aren't real, and this repo should mirror that discipline).

## Authentication

Sign-in is **Supabase Auth** with Google, Apple, or a one-time code sent by email. There are no
passwords and no separate sign-up (the first sign-in creates the account). The plan behind it is
`apps/api/docs/plans/auth-and-user-profiles.md`.

```
src/services/auth/
├── supabase.ts            the supabase-js client (null when the env vars are missing), auto-refresh on AppState
├── encrypted-storage.ts   where supabase-js keeps the session: AES key in SecureStore, ciphertext in AsyncStorage
├── web-crypto.ts          crypto.getRandomValues + crypto.subtle.digest from expo-crypto, for PKCE
├── session.ts             getAccessToken(), refreshAccessToken(), endSession() — used by apiRequest
├── sign-in.ts             signInWithGoogle(), signInWithApple(), isAppleSignInAvailable(), sendEmailCode(), verifyEmailCode(), SignInError
└── index.ts               barrel export — import from '@/services/auth'

src/features/auth/
├── auth-provider.tsx      AuthProvider: session (supabase-js) + profile (GET /users/me) + actions
├── hooks/use-auth.ts      useAuth(): status, user, profile, signInWithGoogle/Apple, signOut, deleteAccount, updateProfile
└── legal-links.ts         Privacy Policy / Terms URLs (null until the pages exist)
```

**Google** (works in Expo Go): `supabase.auth.signInWithOAuth({ provider: 'google', options:
{ redirectTo, skipBrowserRedirect: true } })` returns Supabase's sign-in URL;
`WebBrowser.openAuthSessionAsync(url, redirectTo)` opens it; Google returns to Supabase's own
callback, which redirects to `redirectTo` with a one-time `code`; `exchangeCodeForSession(code)`
swaps it for the session. The client uses `flowType: 'pkce'`, so the code is useless without the
verifier supabase-js kept. `redirectTo` is `Linking.createURL('auth/callback')`:
`noraainutrition://auth/callback` in builds, `exp://<host>/--/auth/callback` in Expo Go. On
Android that URL also reaches Expo Router as a deep link; `src/app/auth/callback.tsx` just sends
it on to `/`.

**Apple** (iOS only, native sheet, works in Expo Go): a random nonce, its SHA-256 passed to
`AppleAuthentication.signInAsync`, then `supabase.auth.signInWithIdToken({ provider: 'apple',
token, nonce })`. Apple shares the name only on the first sign-in: it's saved to the Supabase
user's metadata (`updateUser`) and, if the profile has no name yet, to `PATCH /users/me`.
Android users sign in with Google or by email.

**Email code** (no password, works everywhere): `supabase.auth.signInWithOtp({ email, options:
{ shouldCreateUser: true } })` emails a code; `supabase.auth.verifyOtp({ email, token, type:
'email' })` signs in with it. The form is `src/components/auth/email-sign-in.tsx`. Supabase's
email templates must contain `{{ .Token }}`, or the emails carry a link instead of a code (see
the plan's setup section).

**Session storage.** A session is bigger than SecureStore's ~2 KB limit, so (as in Supabase's
Expo guide) each value is encrypted with a random AES-256 key kept in SecureStore (Keychain /
Keystore) and only the ciphertext is stored in AsyncStorage. The guide uses aes-js and
react-native-get-random-values; this app uses expo-crypto's AES-GCM, which is native,
authenticated and included in Expo Go. supabase-js refreshes the access token in the background
while the app is in the foreground (`startAutoRefresh` / `stopAutoRefresh` on AppState changes).

**Calling the API.** `apiRequest` reads the access token from the session for every request.
Only access tokens go to our API; the refresh token stays between the app and Supabase. On a
401 it refreshes once (or reuses a token another request already refreshed) and retries. If
Supabase says the session is over, or the retry is refused too, it calls `endSession()`
(`signOut({ scope: 'local' })`: this phone only), and the guards return the app to sign-in. If
Supabase can't be reached, the 401 is thrown without signing out.

**Routing.** `src/app/_layout.tsx` wraps the app in `AuthProvider` and uses Expo Router's
protected routes: `Stack.Protected guard={!signedIn}` around `sign-in`, `guard={signedIn}` around
the tabs and camera screens. While the saved session is restored at startup it shows a plain
loading screen (after the animated splash).

**Targets.** The profile's daily targets replace the old hard-coded `TARGETS`: read them with
`useTargets()` (`src/features/food/hooks/use-targets.ts`), which falls back to the defaults in
`mock-data.ts` until the profile has loaded.

**Supabase dashboard setup** (per project; the full checklist is in the plan):
- Authentication → URL Configuration → Redirect URLs: `noraainutrition://**`, and in the
  development project also `exp://**` for Expo Go (check it matches the URL Expo Go reports, or
  list exact URLs).
- Authentication → Providers → Google: the Google Cloud web client's id and secret.
- Authentication → Providers → Apple → Client IDs: `com.raresmaier.nora`, and in the
  development project also Expo Go's `host.exp.Exponent`.

## Handling errors

`apiRequest` throws `ApiError` with a `kind` discriminant — five values, one per failure mode:

| `kind`                | Meaning                                              |
| ---------------------- | ----------------------------------------------------- |
| `network`              | Request never reached the server (offline, connection refused, DNS failure) |
| `timeout`               | No response within the timeout window                |
| `http_client_error`    | HTTP 4xx                                              |
| `http_server_error`    | HTTP 5xx                                              |
| `invalid_response`     | Response body wasn't valid JSON                       |

`ApiError` also carries `status` (when applicable) and a `message` that already includes the
backend's `detail` field (FastAPI's standard error shape, `{"detail": "..."}"`) when present —
for a 422 validation error, each field and its message (`kcal: Input should be …`).

For a sentence to show the user, `describeError(err)` (from `@/services/api`) turns any error
into one: "Can't reach the server…", "Your session has ended…" for a 401, or the backend's detail.

```ts
import { ApiError, getHealth } from '@/services/api';

try {
  const health = await getHealth();
} catch (err) {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case 'network':
        // show "can't reach the server" UI
        break;
      case 'timeout':
        // show a retry affordance
        break;
      case 'http_client_error':
      case 'http_server_error':
        // err.status, err.message (includes backend detail) are available
        break;
      case 'invalid_response':
        // unexpected — likely a proxy/misconfiguration, not a normal API error
        break;
    }
  }
}
```

## Verifying connectivity (dev-only screen)

`src/app/dev/api-health.tsx` is a throwaway screen (not linked from the tab bar) that calls
`getHealth()` and `GET /users/me` (a 401 when signed out, to demonstrate the HTTP-error path),
showing the raw result or the `ApiError` details on screen. It sits outside the sign-in guard,
so it opens signed out too. Reach it directly during development:

```bash
xcrun simctl openurl booted noraainutrition://dev/api-health
```

Safe to delete once there are real API-backed screens to verify against instead.

## CORS

CORS is a browser-enforced mechanism — it does not apply to `fetch` calls from a compiled or
dev-client Expo app running on iOS/Android. No backend CORS configuration is required for the
app itself to reach the API. The backend's `CORS_ORIGINS` setting only matters if you test the
API through a browser-based tool (e.g. Expo's web output, or a browser-based API client) — see
`apps/api/app/core/config.py` if that's ever needed.
