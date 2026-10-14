# Architecture

How Nora AI Nutrition's codebase is organized, and where new code should go.

## Stack

- **Expo** (SDK 57) + **React Native** 0.86, new architecture (the only one since SDK 55)
- **Expo Router** (file-based routing, typed routes enabled). Since SDK 56 it no longer depends on
  React Navigation: import navigation themes and types from `expo-router/react-navigation`, not
  `@react-navigation/*`.
- **TypeScript**, strict mode
- **react-native-reanimated** for animation, **expo-linear-gradient** for gradients (RN's `experimental_backgroundImage` does not render on web — see `src/components/ui/button.tsx` for the pattern)
- **react-native-svg** for the remote food-icon illustrations

## Top-level layout

```text
nora-ai-nutrition/
├── assets/                  # static images, app icons
├── documentation/           # this folder
├── src/
│   ├── app/                 # Expo Router routes — navigation + composition only
│   ├── components/          # reusable UI, grouped by responsibility
│   ├── constants/           # design tokens
│   ├── features/            # domain logic, grouped by feature
│   └── hooks/                # cross-feature reusable hooks
├── app.json
├── package.json
└── tsconfig.json
```

Folders are created when something concrete needs them, not speculatively. `src/services/`, `src/types/`, `src/utils/`, `src/config/`, and `tests/` don't exist yet because nothing currently needs them — see [Where things go next](#where-things-go-next) for what belongs there when they do.

## `src/app/` — routing only

Expo Router maps this directory to routes. Today:

```text
src/app/
├── _layout.tsx           # root layout: theme provider, splash overlay, root Stack
└── (tabs)/
    ├── _layout.tsx       # tab navigator (NativeTabs / expo-router/ui Tabs)
    └── index.tsx         # Home tab — renders the Log Food screen
```

`(tabs)` is a route group: the parentheses mean the segment doesn't appear in the URL, so `index.tsx` inside it is still just `/`. It exists so the tab navigator has its own layout, separate from the root `Stack` — the root `Stack` is what lets a future screen (e.g. a settings modal) be pushed on top of the tabs without restructuring routing again.

Route files should stay thin: navigation, route params, and composing components from `src/components/` and `src/features/`. `(tabs)/index.tsx` currently holds the Log screen's local UI state (which sheet is open, search query, selected day) because that state is inherently screen-level; the actual food-logging *data* and mutations live in `src/features/food/hooks/use-food-log.ts`, not in the route file.

## `src/components/` — reusable UI

```text
components/
├── common/         # app-shell-level, not tied to any feature (splash overlay, external-link)
├── navigation/      # the tab bar shell (app-tabs.tsx + .web.tsx)
├── ui/              # generic primitives: Button, Card, Field, Pill, Sheet, Toast, typography
└── log/             # components specific to the Log Food screen, incl. log/panels/
    └── panels/       # one file per bottom-sheet flow (add food, scan, recipes, ...)
```

Rule of thumb: if a component has no idea what "food" or "macros" means, it belongs in `ui/`. If it's part of the Log screen's vocabulary (FoodIcon, MacroBar, WhenPicker, Timeline, ...), it belongs in `log/`. See [COMPONENTS.md](./COMPONENTS.md) for the full decision guide.

## `src/features/` — domain logic

```text
features/
└── food/
    ├── data/mock-data.ts    # FOOD_DB, RECIPES, BARCODES, seed() — swap points for real APIs
    ├── hooks/use-food-log.ts # the day's timeline of entries + the mutation surface (addEntry, changeEntry, ...)
    └── time.ts               # "HH:MM" helpers, eating moments, and the local-offset logged_at sent to the API
```

This is where business logic, feature-specific hooks, feature-specific types, and (eventually) feature-specific services live — kept separate from `src/components/` so UI and domain logic don't get tangled. Only `food/` exists today because it's the only feature with real code to hold; `nutrition/`, `meals/`, `dashboard/`, `profile/` are not created until they have something to contain.

A feature folder grows its own `components/`, `hooks/`, `services/`, `types/`, `utils/` subfolders only as needed — `food/` currently only needs `data/` and `hooks/`.

## `src/constants/` — design tokens

`src/constants/log-theme.ts` is the single source of design tokens: colors, gradients, shadows, radii, spacing, font family/size, motion durations. It's the code form of [`documentation/DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — token names were corrected during implementation to match what they actually render (the design doc's §14.1 flags the original mockup's tokens were misnamed, e.g. `--lime-500` actually held indigo).

It's named `log-theme` rather than a generic `theme` because, right now, the Log screen *is* the app — there's only one design system in use. If a second feature ships with materially different visual needs, split shared tokens (color primitives, type scale, spacing scale) out into a genuinely feature-agnostic module at that point rather than in advance.

There's no dark-mode variant yet — the design system is a fixed light palette. `src/hooks/use-color-scheme.ts`/`.web.ts` (a hydration-safe wrapper around React Native's `useColorScheme`) is kept in place for when that's needed, even though nothing currently imports it.

## `src/hooks/`

Cross-feature reusable hooks only. Feature-specific hooks (like `useFoodLog`) live inside their feature folder instead — see `src/features/food/hooks/`.

## `src/services/api/` — backend HTTP client

```text
services/api/
├── config.ts     API_BASE_URL (from EXPO_PUBLIC_API_URL), API_VERSION_PREFIX
├── client.ts     ApiError, apiRequest<T>(path, options) — fetch + timeout + JSON handling
├── types.ts      ApiErrorKind, HealthResponse, ...
├── health.ts     getHealth()
└── index.ts      barrel export
```

The reusable client for the FastAPI backend (`apps/api/` in this repo). All API
calls go through `apiRequest`/the endpoint-specific wrapper functions (e.g. `getHealth`) —
never call `fetch` directly from a component. See
[`documentation/api-integration.md`](./api-integration.md) for the full architecture, local-dev
setup, and how to add a new endpoint wrapper. `src/features/food/data/mock-data.ts` still
documents the exact swap points for the mock arrays this client will eventually replace
(`FOOD_DB` → food search, `BARCODES` → barcode lookup, `RECIPES` → user recipes, `seed()` →
`GET /diary/{date}`) — those endpoints don't exist on the backend yet.

## Where things go next

These don't exist yet; create them when the first real need shows up, not before.

- **`src/services/storage/`** — local persistence (AsyncStorage/SQLite) when the app needs to survive a reload.
- **`src/services/analytics/`** — event tracking, when there's something to track.
- **`src/types/`** — types shared across *multiple* features. Types relevant to one feature stay colocated in that feature (e.g. `Food`, `Entry`, `Macro` currently live in `src/features/food/data/mock-data.ts`).
- **`src/utils/`** — pure, feature-agnostic helper functions. Don't put business logic here.
- **`src/config/`** — environment/build-time configuration, once there's more than `app.json` needs to express.
- **`tests/`** — no test runner is configured yet (see [DEVELOPMENT.md](./DEVELOPMENT.md)).

## Path aliases

```ts
"@/*": ["./src/*"]
"@/assets/*": ["./assets/*"]
```

Always import via `@/...`, never relative paths that climb out of a folder (`../../../`). Configured in `tsconfig.json`.
