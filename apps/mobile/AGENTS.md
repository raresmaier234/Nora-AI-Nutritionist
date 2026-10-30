# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v58.0.0/ before writing any code.

# API integration rules

- API calls must go through `src/services/api/` (`apiRequest` or a wrapper around it, e.g. `getHealth`). Do not call `fetch` directly from UI components unless there is a very good reason.
- The one exception is sign-in: the Supabase client in `src/services/auth/supabase.ts` talks to Supabase Auth directly (sign-in, token refresh, sign-out). Use it for auth only — never for app data, which always goes through our API. `apiRequest` adds the user's access token itself; don't add `Authorization` headers by hand.
- Do not hardcode API URLs — the only place the base URL is read is `src/services/api/config.ts`, via `EXPO_PUBLIC_API_URL`.
- Do not store secrets in Expo. `EXPO_PUBLIC_*` variables are inlined into the JS bundle and readable by anyone with the compiled app — only public values belong there: the API base URL, the Supabase project URL and its *publishable* key (never Supabase's secret key).
- Keep API request/response types in `src/services/api/types.ts` (or a file next to it), separate from UI component prop types.
- Do not modify the backend's architecture from `apps/mobile/`. The FastAPI backend lives alongside this app at `apps/api/` in this same repo — its own `apps/api/CLAUDE.md` governs changes there. See `documentation/api-integration.md` for the full integration architecture.
