# API integration

How the Expo app talks to the FastAPI backend (`apps/api/` in this repo).

## Architecture

```
Expo Mobile App
       |
       | HTTPS (HTTP in local dev)
       v
  API Client (src/services/api/)
       |
       v
    FastAPI  ---- PostgreSQL
       |
       +------- External APIs   (planned)
       |
       +------- AI services     (planned)
```

The app never talks to PostgreSQL, or holds any backend secret, directly. Every request goes
through `src/services/api/apiRequest()` (or a thin wrapper around it, like `getHealth()`) —
never `fetch` directly from a component, hook, or screen.

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

- **`.env.example`** — committed, documents the variable and the three common local values
  (simulator / physical device / Android emulator). No real values.
- **`.env.local`** — gitignored, holds your actual local value. Already populated with the
  simulator default (`http://127.0.0.1:8000`) so a fresh checkout works immediately.
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
├── client.ts   ApiError, apiRequest<T>(path, options)
├── types.ts    ApiErrorKind, HealthResponse, FoodDetail, FoodLogEntry, ...
├── health.ts   getHealth()
├── foods.ts    searchFoods(), getFood()
├── meals.ts    listEntries(), createEntry(), updateEntry(), deleteEntry(), copyDay()
└── index.ts    barrel export — import from '@/services/api'
```

`apiRequest<T>(path, options)`:
- `path` starts with `/` and excludes `/api/v1` (e.g. `/health`), so callers stay version-agnostic.
- Sends/expects JSON, sets `Content-Type`/`Accept` headers automatically.
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
backend's `detail` field (FastAPI's standard error shape, `{"detail": "..."}"`) when present.

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
`getHealth()` and a placeholder endpoint (to demonstrate the HTTP-error path), showing the raw
result or the `ApiError` details on screen. Reach it directly during development:

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
