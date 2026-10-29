# Components

Where components live, how they're named, and when to create a new one.

## The four buckets

```text
src/components/
├── common/      # app-shell infrastructure — not reusable UI in the design-system sense
├── ui/          # generic, design-system primitives — no domain knowledge
├── navigation/  # the tab bar shell
└── log/         # everything specific to the Log Food screen's vocabulary
```

**`ui/`** — a component belongs here if you could drop it into an entirely different app and it would still make sense: `Button`, `Card`, `Field`, `Pill`, `Sheet`, `Toast`, the shared text styles in `typography.tsx`. These take generic props (`label`, `variant`, `children`) and know nothing about food, meals, or macros. They pull their values from `src/constants/log-theme.ts` but don't hardcode feature concepts.

**`log/`** — a component belongs here if it speaks the Log screen's domain vocabulary: `FoodIcon`, `MacroBar`, `AmountField`, `WhenPicker`, `DateNavigator`, `Timeline`, `LogFoodBar`, and `nutrition-parts.tsx` (the target bars and nutrient sections Food Details and Day Nutrition share). `log/panels/` holds one file per sheet flow (`photo-estimate-panel.tsx`, `barcode-scanner-panel.tsx`, `recipes-panel.tsx`, `custom-food-panel.tsx`) — each panel is the full content of one `Sheet`. `log/screens/` holds the full-screen pages that slide up over the Log inside a `FullScreen` (`food-search-screen.tsx`, `food-details-screen.tsx`, `day-nutrition-screen.tsx`, `recipe-studio-screen.tsx`); a second page inside one is a `FullScreenLayer`, never a nested `FullScreen`. Both are composed from `ui/` primitives and other `log/` components.

**`navigation/`** — the tab bar shell (`app-tabs.tsx` for native, `app-tabs.web.tsx` for web — Expo Router picks the right one per platform automatically via the `.web.tsx` suffix). Add new tab triggers here as real features land; don't put screen content in this folder.

**`common/`** — things every screen might need that aren't part of the visual design system: `splash-overlay.tsx` (drives the native splash-screen dismiss animation, mounted once at the root layout) and `external-link.tsx` (opens a URL in an in-app browser on native, a normal link on web — not currently used anywhere, kept because every app eventually needs it for things like a privacy policy or help link).

## When something outgrows `components/log/`

If a second feature needs a component that looks like something in `log/` (say, a future `nutrition` feature wants its own macro bar), don't reach into `components/log/` and reuse the Log-specific one directly. Either:

1. The component is actually generic → promote it to `components/ui/` and update `log/` to use the promoted version, or
2. The component is genuinely feature-specific to both → each feature keeps its own copy under its own `src/features/<name>/components/`.

Don't guess which one applies before there's a second real consumer — that's premature abstraction in the other direction.

## Naming

- Files: kebab-case (`food-row.tsx`, `macro-bar.tsx`, `unit-picker-sheet.tsx`).
- Components: PascalCase, named export (`export function FoodIcon(...)`), matching the filename.
- One component per file, styles live in the same file directly below the component — this codebase doesn't use a separate stylesheet file per component.
- Styles are a module-level `const makeStyles = (colors: Palette) => StyleSheet.create({...})`, used with `const styles = useStyles(makeStyles)`, so they follow night mode. Never hard-code a surface, text or border color — use a palette token (`colors.bgSurfaceSolid`, `colors.textSecondary`, …). Fixed colors are fine only where they don't change with the theme: white on an indigo button, the camera viewfinder, drop shadows.

## Composition principles

- **Props over configuration objects.** `<Button label="Save" variant="primary" onPress={...} />`, not a single `config` prop.
- **Compose sheets from panels, not the other way around.** `Sheet` (in `ui/`) is the one shared bottom-sheet shell every flow renders inside — see `src/app/(tabs)/index.tsx` for how the six `log/panels/*` are each wrapped in their own `<Sheet>`. Don't build a new modal mechanism for a new flow.
- **Derive, don't duplicate.** Macro totals are always computed from `entryMacros()` / `sumMacros()` (`src/features/food/data/mock-data.ts`) from `amount + unit + per100`, never stored precomputed. If you're tempted to store a computed value, store the inputs instead and compute at render time.
- **One mutation surface per feature.** All food-log writes go through `useFoodLog()`'s returned functions (`addEntry`, `updateEntry`, `removeEntry`, ...) — components never mutate feature state directly. This is what makes swapping the mock data for a real API a hook-body change, not a UI rewrite.

## When to create a new reusable component

Create one when:
- The same visual pattern appears **3+ times** with only prop differences (this is how `FoodIcon` ended up shared by timeline rows, search results and Food Details).
- A design-system primitive (button variant, input style, shadow) is about to be hand-rolled inline for the second time.

Don't create one for a single current usage "just in case" — inline it in the screen/panel until a second consumer actually shows up.
