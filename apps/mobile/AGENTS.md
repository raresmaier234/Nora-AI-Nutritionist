# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# API integration rules

- API calls must go through `src/services/api/` (`apiRequest` or a wrapper around it, e.g. `getHealth`). Do not call `fetch` directly from UI components unless there is a very good reason.
- Do not hardcode API URLs — the only place the base URL is read is `src/services/api/config.ts`, via `EXPO_PUBLIC_API_URL`.
- Do not store secrets in Expo. `EXPO_PUBLIC_*` variables are inlined into the JS bundle and readable by anyone with the compiled app — only the public API base URL belongs there.
- Keep API request/response types in `src/services/api/types.ts` (or a file next to it), separate from UI component prop types.
- Do not modify the backend (`nora-ai-nutrition-api`) architecture from this repo. See `documentation/api-integration.md` for the full integration architecture.
