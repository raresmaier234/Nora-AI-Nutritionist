# Development

## Install dependencies

```bash
npm install
```

## Start the app

```bash
npm start
```

This starts the Expo dev server and prints a QR code plus keyboard shortcuts. From there:

```bash
npm run android   # expo start --android
npm run ios       # expo start --ios
npm run web       # expo start --web
```

## Type-check

```bash
npx tsc --noEmit
```

Run this after any structural change (moved files, renamed exports) — it catches broken imports immediately, before you need a simulator running.

## Lint

```bash
npm run lint
```

Runs `expo lint`.

## Clear the Metro/Expo cache

```bash
npx expo start -c
```

Reach for this if you hit a stale-bundle symptom after moving/renaming files — a route that still shows old content, an import that resolves to the wrong module, etc.

## Tests

No test runner is configured in this project yet. When one is added (see [Expo's unit testing guide](https://docs.expo.dev/develop/unit-testing/) for the supported setup), tests should live under `tests/`, mirroring the `src/` structure (`tests/components/`, `tests/features/`, `tests/utils/`).

## Everyday workflow

1. `npm start`, press `w` for web (fastest inner loop for UI work) or scan the QR code for a device/simulator.
2. Edit files under `src/`. Fast Refresh picks up changes automatically.
3. Before committing, run `npx tsc --noEmit` and `npm run lint`.
4. If routes or navigation changed, do a full reload (not just Fast Refresh) — Expo Router's typed routes and the tab navigator both need a fresh bundle to pick up new/moved route files.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for where new code should go, and [COMPONENTS.md](./COMPONENTS.md) for component conventions.
