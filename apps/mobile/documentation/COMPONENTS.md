# Components

Where components live, how they're named, and when to create a new one.

## The four buckets

```text
src/components/
├── common/      # app-shell infrastructure — not reusable UI in the design-system sense
├── ui/          # generic, design-system primitives — no domain knowledge
├── navigation/  # the tab bar shell
├── log/         # everything specific to the Log Food screen's vocabulary
├── auth/        # parts of the sign-in screen
└── nutrition-plan/ # the nutrition plan: Profile tab parts and the plan builder
```

**`ui/`** — a component belongs here if you could drop it into an entirely different app and it would still make sense: `Button`, `Card`, `Field`, `Pill`, `Sheet`, `Toast`, the shared text styles in `typography.tsx`. These take generic props (`label`, `variant`, `children`) and know nothing about food, meals, or macros. They pull their values from `src/constants/log-theme.ts` but don't hardcode feature concepts.

**`log/`** — a component belongs here if it speaks the Log screen's domain vocabulary: `FoodIcon`, `MacroBar`, `AmountField`, `WhenPicker`, `DateNavigator`, `Timeline`, `LogFoodBar`, and `nutrition-parts.tsx` (the target bars and nutrient sections Food Details and Day Nutrition share). `log/panels/` holds one file per sheet flow (`photo-estimate-panel.tsx`, `barcode-scanner-panel.tsx`, `recipes-panel.tsx`, `custom-food-panel.tsx`) — each panel is the full content of one `Sheet`. `log/screens/` holds the full-screen pages that slide up over the Log inside a `FullScreen` (`food-search-screen.tsx`, `food-details-screen.tsx`, `day-nutrition-screen.tsx`, `recipe-studio-screen.tsx`); a second page inside one is a `FullScreenLayer`, never a nested `FullScreen`. Both are composed from `ui/` primitives and other `log/` components.

**`navigation/`** — the tab bar shell (`app-tabs.tsx` for native, `app-tabs.web.tsx` for web — Expo Router picks the right one per platform automatically via the `.web.tsx` suffix). Add new tab triggers here as real features land; don't put screen content in this folder.

**`common/`** — things every screen might need that aren't part of the visual design system: `splash-overlay.tsx` (drives the native splash-screen dismiss animation, mounted once at the root layout), `external-link.tsx` (opens a URL in an in-app browser on native, a normal link on web) and `legal-link.tsx` (the Privacy Policy / Terms inline in a sentence — a link once its URL is set in `src/features/auth/legal-links.ts`, plain text until then; used on the sign-in screen and the Profile tab).

**`auth/`** — `google-sign-in-button.tsx`: "Continue with Google" in Google's own button branding (the colour G, Google's light/dark colours), sized to match Apple's native `AppleAuthenticationButton`, which the sign-in screen (`src/app/sign-in.tsx`) uses as is.

**`nutrition-plan/`** — the nutrition plan (spec: `apps/api/docs/plans/ai-nutrition-plan.md`) and the Profile tab's parts:
- `plan-section.tsx` — the Profile tab's "Your plan" section, by account and `targets_mode`: basic (default targets + the premium card), premium without a plan ("Build my plan" above the starting targets), premium with an active plan (`PlanDetails`, Change plan, "Something changed?"), and "log without targets" (a gentle note, no targets). The weekly check-in card (next phase) goes above the plan there.
- `plan-card.tsx` — daily calories and macros, read-only (`approximate` adds "~" for a built plan's estimates). Targets are never typed in.
- `plan-details.tsx` — a plan: goal and goal date, the targets, summary, "Why these numbers", guidance, cautions and "General guidance, not medical advice". Used by the builder's review and the Profile tab (with a progress placeholder).
- `build-plan-card.tsx` — "Build my plan": a prominent button for premium, or what premium includes for basic (no purchase flow: payments don't exist yet).
- `first-plan-prompt.tsx` — the once-per-user sheet after a premium user's first sign-in.
- `account-card.tsx` — the account section at the foot of the tab: avatar or initials, name, email, the Basic / Premium badge, how they signed in (nothing to edit).
- `plan-builder/` — the questionnaire, full screen:
  - `plan-builder-host.tsx` — `PlanBuilderHost` (wraps the tabs in `src/app/(tabs)/_layout.tsx`) owns the one builder modal and the first-sign-in prompt; `usePlanBuilder().open({ mode })` opens it from any tab (`build`, `change` = "What would you like to change?" first, `recheck` = "Something changed?").
  - `plan-builder.tsx` — the flow: one question per screen, progress bar, Back / Next, gate and stop screens, then the review with "Use this plan" / "Change my answers". Which screens show and what they accept is `src/features/nutrition-plan/questionnaire.ts`; the wording is `options.ts` there.
  - `steps.tsx` (screens with their own input state: birth, height, weight, exercise, target, pace, food), `outcomes.tsx` (gate, stop, review), `parts.tsx` (question header, choice lists, chips, unit toggle, stepper, number field, callout), `date-field.tsx` (Expo UI's DateTimePicker, included in Expo Go).

The tab itself is `src/app/(tabs)/profile.tsx`. The builder is one `FullScreen` at the tabs level; nothing inside it opens another `FullScreen`.

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
