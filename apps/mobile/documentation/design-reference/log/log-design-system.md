# Log Page — Design System

**Source:** `ui_kits/mobile-app-v2/LogPageV3.jsx` · **Standalone preview:** `ui_kits/mobile-app-v2/log.html` · **Spec card:** `guidelines/log-page.card.html`

The Log (food diary) page is the app's highest-frequency screen. Everything on it serves one question — *what have I eaten today, and how much room is left?* — followed by one action: log something else, in as few taps as possible.

---

## 1. Foundations used

All values come from the design system's tokens (`styles.css` → `tokens/`). The page runs under the v2 identity: wrap it in `data-identity="v2"`.

### Color roles on this page

| Role | Token | Value | Used for |
|---|---|---|---|
| Primary / interactive | `--lime-500` | `#6366F1` indigo | Add food links, quick-entry icons, water fill, Save, active pills, **Protein** |
| Progress / positive | `--violet-500` | `#22C55E` green | Calorie progress bar, meal kcal totals, "remaining", **Fat** |
| Secondary accent | `--apricot-500` | `#F59E0B` amber | **Carbs** only — used sparingly |
| Error / destructive | `--rose-500` | `#EF4444` red | Delete, over-target progress bar |
| Page background | `--bg-app` | `#F8FAFC` | Page ground |
| Surface | `--bg-surface-solid` | `#FFFFFF` | Cards, sheets, rows |
| Text primary | `--text-primary` | `#111827` | Food names, numbers |
| Text secondary | `--text-secondary` | `#475569` | Body copy |
| Text tertiary | `--text-tertiary` | `#64748B` | Meta, captions, labels |
| Border | `--border-subtle` | `#E2E8F0` | Card outlines, row dividers |

> **Canonical macro mapping — do not deviate:** Protein = indigo, Carbs = amber, Fat = green, Calories = green.
> Token names `--lime-*` / `--violet-*` predate this palette; their *values* are indigo and green. `MacroBar`'s `TONE` map and the detail sheet both follow the mapping above.

### Type scale

| Element | Token / size | Weight |
|---|---|---|
| Day label ("Today") | `--text-h1` 22px | 800, `--track-tight` |
| Calorie total | `--text-display-2` 36px | 800, `--track-tight` |
| Meal title | `--text-h2` 18px | 700 |
| Food name | `--text-body` 15px | 700 |
| Portion / time meta | `--text-micro` 11px | 500 |
| Section labels | 11px uppercase | 700, `--track-wide` |

Font: `--font-sans` (Plus Jakarta Sans).

### Spacing, radius, elevation

- Page padding `16px 20px`; vertical rhythm between blocks `18px` (`gap`).
- Rows: `12px` vertical / `14px` horizontal padding. Cards: `16–18px`.
- Radius: cards `--radius-lg` 24px, controls/fields `--radius-md` 18px, pills `--radius-pill`, sheets `24px 24px 0 0`.
- Elevation: cards `--shadow-1`, sheets `--shadow-3`, primary CTA `--glow-lime`.
- Hit targets ≥ 44px (rows are 70px, buttons 34px+ with padding).

### Motion

| Pattern | Class / token |
|---|---|
| Block entrance | `.v2-rise` (+ `.v2-d1…d5` stagger) |
| Sheet slide-up | `.n-sheet` |
| Overlay fade | `.n-fade` |
| Progress fill | `.n-bar` |
| Press feedback | `.v2-press` (scale .965) |
| Row press tint | `.v2-row` |
| Toast | `.n-toast` |

Durations/easings from `--dur-*` / `--ease-*`. Everything is disabled under `prefers-reduced-motion`.

---

## 2. Page anatomy

Top → bottom:

1. **Date navigation** — prev / `Today` + full date / next. Labels resolve to "Today", "Yesterday", or the weekday name.
2. **Summary card** (`GlassCard`) — consumed vs target kcal, remaining (or over), progress bar, three `MacroBar`s, "Copy yesterday".
3. **Quick entry row** — five tiles: Search · Photo · Scan · Recipes · Custom.
4. **Meal sections** ×4 — Breakfast, Lunch, Dinner, Snacks.
5. **Water** — eight tappable segments, `n/8 glasses`.
6. **Day stats** — entries count, protein total, water volume.

### Food row anatomy

```
[ 46px FoodIcon ]  Food name              280 kcal
                   150 g · 13:05
```

| Part | Spec |
|---|---|
| Icon | 46px `FoodIcon` — keyword-matched colorful illustration in a tinted container |
| Primary | Food name, 15px/700, `--text-primary` |
| Meta | `amount unit · time`, 11px/500, `--text-tertiary` |
| Trailing | kcal, 15px/700, right-aligned |
| Divider | 1px `--border-subtle` between rows |
| Interaction | Whole row taps → edit sheet; tints on press |

### Meal section anatomy

Header: meal name (18px/700) left, meal kcal total (13px/800, green) right. Body: card containing food rows, then a persistent `+ Add food` row. Empty meals show *"No food added yet"* + `+ Add food` — never a blank box.

---

## 3. The five entry points

Each quick-entry tile opens its own flow in the shared `Sheet` shell. All of them include a **meal picker** (Breakfast / Lunch / Dinner / Snacks) because they are not meal-scoped, and all confirm with a toast.

### Search
Opens the add-food sheet scoped to a meal. Live-filters `FOOD_DB` as you type; shows result count, or a no-match state suggesting Photo / Scan / Custom. With an empty query it shows *Recently added*. Tapping a result logs it at 100 g (adjustable afterwards in the edit sheet). Also reachable from every meal's `+ Add food`.

### Photo
Three-phase vision flow — the fastest path for a whole plate:
- **Capture** — dark viewfinder with framing hint ("Center the whole plate in frame"), `Take photo` primary + `Upload` secondary
- **Analyzing** — spinner, "Analyzing your plate…"
- **Result** — one row per detected item: include/exclude toggle, `FoodIcon`, **confidence** (`92% confident`, or an amber *"Low confidence — check this"* under 70%), an editable amount, and live kcal. A green strip totals the selected items; `Confirm & add to {meal}` logs each item as its own entry, `Retake` restarts.

Items are always editable before saving — the estimate is a starting point, never a silent write. Mocked detection returns three items; swap for the meal-recognition endpoint.

### Scan
Barcode flow with three states:
- **Scanning** — dark viewfinder, animated scan line, "Scanning…"
- **Found** — product card (name, barcode, kcal/100g) + meal picker + `Add {amount}{unit} to {meal}`
- **No match** — explanatory copy and a route to Custom food

A manual barcode field with a `Look up` action is always available. Mock lookup table: `BARCODES` (swap for a product API).

### Recipes
Two tabs:
- **Saved** — the user's recipes with ingredient count, per-recipe macros, and total kcal (all computed from ingredient data, never stored as text). Tap to log the whole recipe as one entry.
- **Build new** — name field + ingredient chips; totals (kcal + P/C/F) auto-calculate live as ingredients are toggled, shown in a green summary strip. `Save & add to {meal}` is disabled until at least one ingredient is picked.

### Custom
Manual entry form: name, serving (`AmountField` — amount + unit), then kcal / protein / carbs / fat for that serving. Values are normalised to per-100g on save so the food behaves like any database item afterwards. `Save food & add to {meal}` stays disabled until a name and a kcal value exist.

---

## 4. Editing an entry

Tapping any food row opens the edit sheet: large `FoodIcon`, name, `{meal} · {time}`, an `AmountField` (amount + unit), and a four-up macro readout that **recalculates live** as the amount changes. Actions: `Save` (indigo) and `Delete` (red outline). Totals, meal totals and the progress bar all update immediately.

Units supported: `g`, `oz`, `slice`, `piece`, `cup`, `serving` — each with a gram factor, so all macro math funnels through one `toGrams()` helper.

---

## 5. States

| State | Treatment |
|---|---|
| Empty meal | "No food added yet" + inline `+ Add food` |
| Empty day | All four meals show their empty state; summary reads `0 / 2,000` |
| No search results | Message naming the query + suggest Scan / Custom |
| Over target | Progress bar turns red; caption switches to "N kcal over" |
| Scanning | Animated scan line, live status caption |
| Photo capture | Framing hint over dark viewfinder |
| Photo analyzing | Spinner + "Analyzing your plate…" |
| Low confidence item | Amber caption "Low confidence — check this" |
| Item excluded | Row at 50% opacity, empty toggle |
| Barcode not found | Explanatory copy + manual entry + Custom route |
| Disabled action | 50% opacity, `cursor: default` (Save recipe / Save custom food) |
| Added | Green toast; totals recompute |
| Removed | Neutral toast, no guilt copy |
| Pressed | Buttons scale .965; rows tint |

Copy tone: short, plain, second person, no exclamation stacking, never punitive.

---

## 6. Data model

```js
Food   = { id, name, per100: { kcal, protein, carbs, fat } }
Entry  = { uid, ...Food, amount, unit, time }
Day    = { Breakfast: Entry[], Lunch: Entry[], Dinner: Entry[], Snacks: Entry[] }
Recipe = { id, name, items: [ [foodId, amount, unit], … ] }
Product= { code, name, per100, amount, unit }
Detected = { id, name, per100, amount, unit, confidence, on }   // photo estimate row
```

Derived, never stored:

```js
grams  = amount × unitFactor
macros = per100 × grams / 100          // entryMacros(entry)
mealKcal = Σ entryMacros(e).kcal
dayTotals = Σ over all meals
```

### Mutation surface (the only writes)

| Helper | Purpose |
|---|---|
| `addEntry(meal, food, amount, unit)` | Log a database/search food |
| `addPhotoItems(items)` | Log each confirmed item from a photo estimate |
| `addScanned(product)` | Log a scanned product at its label serving |
| `addRecipe(recipe, totals)` | Log a recipe as a single entry |
| `saveCustom(form)` | Normalise to per-100g, save + log |
| `updateEntry(meal, uid, patch)` | Portion / unit edits |
| `removeEntry(meal, uid, name)` | Delete |
| `copyYesterday()` | Clone the previous day |
| `setWater(n)` | Hydration |

---

## 7. Backend swap points

The page is deliberately structured so nothing in the UI needs to change when it goes live:

| Mock | Replace with |
|---|---|
| `FOOD_DB` | Food search API (`GET /foods?q=`) |
| `BARCODES` | Barcode lookup (`GET /products/{code}`) |
| `PhotoEstimatePanel.analyze()` | Meal recognition (`POST /vision/estimate` → detected items + confidence) |
| `RECIPES` | User recipes (`GET /recipes`) |
| `seed()` | Day fetch (`GET /diary/{date}`) |
| mutation helpers | `POST/PATCH/DELETE /diary/{date}/entries` |
| `TARGETS` | User's goal targets |
| `water` | Hydration log |

Keep the derived-macro rule server-side too: store `amount` + `unit` + a food reference, never denormalised macros, so corrections to food data propagate.

---

## 8. Components consumed

From the design system (do not re-implement locally):

- `GlassCard` — summary and water surfaces
- `FoodIcon` — every food illustration (46px in rows, 40px in lists, 72px in sheets)
- `MacroBar` — the three macro readouts
- `FloatingNav` — bottom navigation

Local to the page (promote to the system if reused elsewhere): `Sheet`, `AmountField`, `MealPicker`, `PhotoEstimatePanel`, `BarcodeScanner`, `RecipesPanel`, `CustomFoodForm`, `Stat`.

---

## 9. Known gaps

- Favorites is described in the brief but not built — the Search sheet's actions route to Photo / Scan / Custom instead.
- Photo capture is mocked: no real camera stream or image upload is wired, and detection returns a fixed three-item result.
- Swipe-to-delete is not implemented; deletion lives in the edit sheet.
- No persistence: state is in-memory per session (deliberate for the prototype — see swap points).
- Recipe ingredient amounts are fixed at 100 g in the builder; per-ingredient amount editing exists in the v1 recipe builder (`ui_kits/mobile-app/RecipeBuilderScreen.jsx`) and can be ported.
