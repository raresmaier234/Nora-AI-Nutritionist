# Design reference (archived)

This folder holds the original design-tool exports the Log Food screen was built from. They are **not application code** — nothing under `src/` imports them, and they are not part of the Expo build.

- `LogPageV3.jsx` — the canonical Claude Design mockup for the Log Food screen. The real implementation lives at [`src/app/(tabs)/index.tsx`](../../src/app/(tabs)/index.tsx) plus [`src/components/log/`](../../src/components/log/), ported faithfully to React Native per [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).
- `log/` — an **earlier** (v2) component kit for the same screen, superseded by `LogPageV3.jsx`. Kept only because `DESIGN_SYSTEM.md` §14.5 references it; its `FoodIcon.jsx` keyword-map/tint system is what [`src/components/log/food-icon.tsx`](../../src/components/log/food-icon.tsx) was ported from. The rest of this folder's components (`SearchBar`, `QuickActionButton`, `FoodLogItem`, `IngredientRow`, `FoodDetailSheet`, `AmountUnitInput`) use a different, non-canonical token set and were not carried into the app.

Treat everything here as historical reference only. If it drifts from the shipped screen, `DESIGN_SYSTEM.md` and the `src/` implementation are the source of truth, not these files.
