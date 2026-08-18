# DESIGN_SYSTEM.md — Nora · Log Food Page

**Scope:** the Log (food diary) page and everything it renders.
**Extracted from:** `ui_kits/mobile-app-v2/LogPageV3.jsx`, `ui_kits/mobile-app-v2/log.html`, `components/v2/*`, `components/log/FoodIcon.jsx`, `tokens/*.css`.
**Design width:** 390 × 844 (iPhone 14/15 class). Works unchanged on Android at the same logical width.

Every value below was read out of the existing implementation. Anything not determinable is marked **TBD** — do not invent it.

> **Read §14 (Known inconsistencies) before writing code.** There are naming and scale issues that should be resolved in the first implementation pass, not carried forward.

---

## 1. Design principles

**Personality:** calm, modern, premium wellness. Friendly but not playful; informative but never clinical.

1. **The number leads.** The day's calorie total is the largest element on the page (36px/800). Everything else supports it.
2. **Scan before read.** Food identity is carried by a colorful illustrated icon, so a user recognises a row before parsing text.
3. **Two-tap logging.** Every entry path (search, photo, scan, recipe, custom) reaches "logged" in 2–3 taps. No wizard.
4. **Restraint in colour, richness in food.** UI chrome is slate + white with one accent per role; colour saturation is spent on food illustrations, not on the interface.
5. **Never a blank box.** Every empty container carries an explanation and an action.
6. **No guilt.** Over-target and deletion states are factual, never punitive.
7. **Progressive disclosure.** Rows show name/portion/kcal; full macros live one tap deeper in the edit sheet.
8. **Motion confirms, never decorates.** Entrances stagger, sheets slide, bars fill. Nothing loops or bounces.

---

## 2. Color system

### 2.1 Global palette (raw values)

| Token | HEX | Notes |
|---|---|---|
| `--indigo-500` (currently `--lime-500`) | `#6366F1` | Primary |
| `--indigo-400` (currently `--lime-400`) | `#818CF8` | Primary light / gradient start |
| `--indigo-600` (currently `--lime-600`) | `#4F46E5` | Primary dark / gradient end, hover |
| `--green-500` (currently `--violet-500`) | `#22C55E` | Success / progress |
| `--green-400` (currently `--violet-400`) | `#4ADE80` | Gradient start |
| `--amber-500` (currently `--apricot-500`) | `#F59E0B` | Secondary accent |
| `--amber-400` (currently `--apricot-400`) | `#FBBF24` | Gradient start |
| `--red-500` (`--rose-500`) | `#EF4444` | Error / destructive |
| `--slate-0` | `#FFFFFF` | Surface |
| `--slate-50` | `#F8FAFC` | Page background |
| `--slate-100` | `#F1F5F9` | Neutral tint (icon container) |
| `--slate-200` | `#E2E8F0` | Border / divider |
| `--slate-300` | `#CBD5E1` | Strong border |
| `--slate-400` | `#94A3B8` | Faint text (unused on this page) |
| `--slate-500` | `#64748B` | Tertiary text |
| `--slate-600` | `#475569` | Secondary text |
| `--slate-900` | `#111827` | Primary text |
| Track | `#E9EDF3` | Progress / bar tracks |

### 2.2 Semantic tokens (use these in components)

| Token | Resolves to | Applied to |
|---|---|---|
| `--bg-app` | `#F8FAFC` | Page ground |
| `--bg-surface-solid` | `#FFFFFF` | Cards, rows, sheets |
| `--bg-surface` | `rgba(255,255,255,0.9)` | Translucent surface (rarely used here) |
| `--bg-surface-warm` | `rgba(99,102,241,0.05)` | Subtle indigo wash |
| `--brand-primary` | `#6366F1` | Primary actions, interactive elements |
| `--brand-primary-strong` | `#4F46E5` | Darker primary |
| `--text-primary` | `#111827` | Food names, numbers, titles |
| `--text-secondary` | `#475569` | Body copy |
| `--text-tertiary` | `#64748B` | Meta, captions, section labels |
| `--text-onbrand` | `#FFFFFF` | Text/icons on filled indigo |
| `--border-subtle` | `#E2E8F0` | Card outlines, row dividers |
| `--border-strong` | `#CBD5E1` | Secondary button outlines |
| `--track-empty` | `#E9EDF3` | Progress + water track |
| `--accent-protein` | `#6366F1` | Protein |
| `--accent-carbs` | `#F59E0B` | Carbs |
| `--warn-fat` | `#22C55E` | Fat |
| `--state-error` | `#EF4444` | Errors, delete, over-target |

### 2.3 Gradients

| Token | Value | Used for |
|---|---|---|
| `--grad-lime` (primary) | `linear-gradient(135deg,#818CF8 0%,#4F46E5 100%)` | Primary buttons, active pills, water fill, protein bar |
| `--grad-violet` (success) | `linear-gradient(135deg,#4ADE80 0%,#22C55E 100%)` | Calorie progress bar, fat bar |
| `--grad-apricot` (accent) | `linear-gradient(135deg,#FBBF24 0%,#F59E0B 100%)` | Carbs bar |
| `--grad-glass` | `linear-gradient(160deg,rgba(255,255,255,0.85) 0%,rgba(255,255,255,0.55) 100%)` | `.v2-glass` surfaces |

### 2.4 Canonical macro mapping — do not deviate

| Metric | Colour |
|---|---|
| Calories / progress / positive | **Green `#22C55E`** |
| Protein | **Indigo `#6366F1`** |
| Carbs | **Amber `#F59E0B`** |
| Fat | **Green `#22C55E`** |

Fat and calories share green; they never appear in the same visual comparison (calories are the headline number and bar, fat is a labelled macro). **If a future chart plots both together, assign fat a new colour rather than reusing green.**

### 2.5 State colours

| State | Treatment |
|---|---|
| Default | Token values above |
| Pressed (button) | `transform: scale(.965)`, no colour change |
| Pressed (row) | Background `--overlay-press` = `rgba(17,24,39,0.04)` |
| Focus | `--ring-focus` = `0 0 0 3px rgba(99,102,241,0.25)`, `outline: none` |
| Selected (pill/tab) | Fill `--grad-lime`, text `--text-onbrand`, border removed |
| Unselected (pill/tab) | Background `--bg-app`, 1px `--border-subtle`, text `--text-secondary` |
| Disabled | `opacity: 0.5`, `cursor: default`, no colour change, still rendered |
| Success | Green toast + green totals |
| Error | `#EF4444` border/text; over-target bar solid `#EF4444` |
| Low confidence (photo) | Caption in `#F59E0B` |
| Excluded (photo row) | `opacity: 0.5` |

---

## 3. Typography

**Family:** `Plus Jakarta Sans` (Google Fonts), fallback `ui-sans-serif, system-ui, sans-serif`. Token: `--font-sans`.

### 3.1 Global scale

| Token | px | Weights in use | Line height | Tracking |
|---|---|---|---|---|
| `--text-hero` | 52 | 800 | 0.9 | `--track-tight` (−0.03em) |
| `--text-display-2` | 36 | 800 | 1.0 | `--track-tight` |
| `--text-display` | 28 | 800 | 1.0 | `--track-tight` |
| `--text-h1` | 22 | 800 | 1.0–1.15 | `--track-tight` |
| `--text-h2` | 18 | 700 | 1.0 | `--track-snug` (−0.015em) |
| `--text-body` | 15 | 500 / 600 / 700 | 1.0–1.45 | `--track-snug` or none |
| `--text-small` | 13 | 500 / 600 / 700 / 800 | 1.0–1.45 | none |
| `--text-micro` | 11 | 500 / 600 / 700 | 1.0 | `--track-wide` (0.08em) when uppercase |

Weights: `--weight-regular` 400, `--weight-medium` 500, `--weight-semibold` 600, `--weight-bold` 700, `--weight-extrabold` 800.
Line-height tokens: `--lh-tight` 1.15, `--lh-normal` 1.4.

### 3.2 Named text styles on this page

| Style | Spec |
|---|---|
| Day label ("Today") | 22px / 800 / `--track-tight` / `--text-primary` |
| Day date ("Tue, Aug 11") | 11px / 600 / `--text-tertiary` |
| Calorie total | 36px / 800 / `--track-tight` / `--text-primary` |
| Calorie target suffix | 13px / 600 / `--text-tertiary` |
| Remaining caption | 13px / 700 / green (red when over) |
| Meal title | 18px / 700 / `--text-primary` |
| Meal total | 13px / 800 / green |
| Food name | 15px / 700 / 1.2 / `--text-primary` |
| Food meta (`150 g · 13:05`) | 11px / 500 / `--text-tertiary` |
| Food kcal | 15px / 700 / `--text-primary` |
| Section label (uppercase) | 11px / 700 / `--track-wide` / uppercase / `--text-tertiary` |
| Sheet title | 22px / 800 / `--text-primary` |
| Sheet subtitle | 13px / 500 / `--text-tertiary` |
| Button label | 13px / 700 |
| Macro value (MacroBar) | 21px / 800 / `--track-tight` |
| Macro label (MacroBar) | 11px / 700 / uppercase / `--track-wide` / `--text-tertiary` |
| Stat value | 18px / 800 / `--track-tight` |
| Stat label | 9px / 700 / uppercase / `--track-wide` / `--text-tertiary` |
| Tile label (quick entry) | 9.5px / 700 / `--text-primary` |
| Pill label (meal picker) | 10.5px / 700 |

> ⚠️ 9px, 9.5px, 10px, 10.5px and 21px sit **outside** the token scale. See §14.2 — snap these to tokens during implementation.

---

## 4. Spacing

### 4.1 Global scale (existing tokens)

| Token | px |
|---|---|
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 20 |
| `--space-6` | 24 |
| `--space-8` | 32 |
| `--space-10` | 40 |

### 4.2 Recommended t-shirt aliases (add these; map to the above)

| Alias | px | Typical use |
|---|---|---|
| `xs` | 4 | Icon-to-label, tight stacks |
| `sm` | 8 | Chip gaps, inline gaps |
| `md` | 12 | Row vertical padding, inner gaps |
| `lg` | 16 | Card padding |
| `xl` | 20 | Page horizontal padding |
| `2xl` | 24 | Section separation |
| `3xl` | 32 | Sheet bottom padding |

### 4.3 Values actually in use

| Context | Value |
|---|---|
| Page padding | `16px 20px 0` |
| Gap between page blocks | `18px` → **snap to 16 or 20** |
| Card padding | `16–18px` → **snap to 16** |
| Row padding | `12px 14px` → **snap to 12px 16px** |
| Row inner gap (icon → text) | `12px` |
| Sheet padding | `10px 22px 30px` → **snap to 12px 20px 32px** |
| Chip / pill gap | `6–8px` → **snap to 8** |
| Button internal padding | `13–14px` vertical → **snap to 14** |
| Grid gap (collection-style) | `12px` |
| Bottom scroll padding (over nav) | `116px` |

---

## 5. Border radius

| Token | px | Applied to |
|---|---|---|
| `--radius-xs` **(to add)** | 8 | Water segments |
| `--radius-sm-alt` **(to add or drop)** | 10 | Small numeric inputs (photo amount) |
| `--radius-sm` | 12 | Small icon containers |
| `--radius-md` | 18 | Inputs, selects, tiles, macro cells |
| `--radius-lg` | 24 | Cards, list containers |
| `--radius-pill` | 999 | Buttons, chips, search field, progress bars, nav |
| Sheet | `24px 24px 0 0` | Bottom sheets |
| Circle | `50%` | Icon buttons, toggles, avatar chips |
| FoodIcon container | `size × 0.42` | Scales with icon size (48 → 20px) |

---

## 6. Shadows and elevation

| Token | Value | Applied to |
|---|---|---|
| `--shadow-1` | `0 1px 2px rgba(17,24,39,0.04), 0 4px 12px rgba(17,24,39,0.05)` | Cards, row containers, tiles |
| `--shadow-2` | `0 6px 18px rgba(17,24,39,0.07), 0 2px 4px rgba(17,24,39,0.05)` | Glass cards, floating elements |
| `--shadow-3` | `0 18px 44px rgba(17,24,39,0.14)` | Bottom sheets, toasts, floating nav |
| `--glow-lime` (primary glow) | `0 10px 24px rgba(99,102,241,0.28), 0 2px 6px rgba(99,102,241,0.16)` | Primary CTA only |
| `--glow-violet` | `0 10px 24px rgba(34,197,94,0.26)` | Success emphasis (unused on this page) |
| `--hairline-top` | `inset 0 1px 0 rgba(255,255,255,0.9)` | Glass surface top highlight |
| `--ring-focus` | `0 0 0 3px rgba(99,102,241,0.25)` | Focus-visible |

**Elevation ladder:** page (0) → cards `--shadow-1` (1) → glass/floating `--shadow-2` (2) → sheets/toasts/nav `--shadow-3` (3). Only one level-3 surface is visible at a time.

---

## 7. Components

### 7.1 Global primitives (shared across the app)

#### Button

| Variant | Background | Text | Border | Padding | Radius | Shadow |
|---|---|---|---|---|---|---|
| Primary | `--grad-lime` | `--text-onbrand` | none | `14px` (full-width) | pill | `--glow-lime` |
| Secondary | `--bg-surface-solid` | `--text-primary` | 1px `--border-strong` | `14px 18px` | pill | none |
| Tertiary / inline link | transparent | `--brand-primary` | none | `12px 14px` | — | none |
| Destructive | transparent | `#EF4444` | 1px `#EF4444` | `13px 20px` | pill | none |
| Ghost pill (chip) | `--bg-app` | `--text-secondary` | 1px `--border-subtle` | `9–10px 12px` | pill | none |
| Icon button | `--bg-surface-solid` | icon `--text-secondary` | 1px `--border-subtle` | — (34×34) | 50% | none |

Label typography: 13px/700 (primary, secondary, destructive), 11px/600 (chips).
States: `.v2-press` → `scale(.965)` on `:active`, `--ring-focus` on `:focus-visible`, `opacity .5` + `cursor: default` when disabled. Transition `transform var(--dur-fast) var(--ease-out)`.

#### Search field
Height ≈ 46px. Layout: 18px magnifier icon (`--text-tertiary`) + input + optional 20px circular clear button. Padding `13px 16px`, radius pill, background `--bg-app`, border 1px `--border-subtle`. Input 15px/500 `--text-primary`; placeholder `--text-tertiary`. Focus: `--ring-focus` on the wrapper.

#### FoodIcon
Purpose: instant food recognition. Container `size × size`, radius `size × 0.42`, illustration at `size × 0.52`, centered.
Sizes: **72** (sheet hero), **46** (log row), **40** (list/search result), **38** (photo result row).
Tints (container background): indigo `rgba(99,102,241,0.12)`, green `rgba(34,197,94,0.12)`, amber `rgba(245,158,11,0.12)`, neutral `#F1F5F9`. Tint is assigned per food by the keyword map, not by macro.
Asset source: Noto Emoji SVG CDN, keyword-matched from the food name; fallback = generic plate glyph. **Swap-ready:** replace the `src` lookup to move to a licensed illustration set.

#### MacroBar
Purpose: one macro's progress. Vertical layout: uppercase label (11px/700) → value row (21px/800 current + 11px/600 `/target unit`) → 5px pill track.
Track `--track-empty`; fill = macro gradient; width animates from 0 on mount, `width var(--dur-slow) var(--ease-out)`.
Props: `tone: 'protein' | 'carbs' | 'fat'`, `label`, `current`, `target`, `unit`.

#### GlassCard
Surface primitive. Background `--grad-glass`, 1px `--border-subtle`, `--shadow-2` + `--hairline-top`, `backdrop-filter: blur(14px) saturate(1.1)`, radius `--radius-lg`, default padding 18. Becomes pressable (adds `.v2-press`) when given `onClick`.

#### Bottom sheet (`Sheet`)
Overlay `rgba(17,24,39,0.34)`, click-outside to dismiss. Panel: full width, `max-height: 88%`, `overflow-y: auto`, background `--bg-surface-solid`, radius `24px 24px 0 0`, padding `10px 22px 30px`, `--shadow-3`. Grab handle 36×4, radius pill, `--border-strong`, centered, 18px bottom margin.
Motion: panel `.n-sheet` (slide up), overlay `.n-fade`. Content stops propagation. **TBD:** drag-to-dismiss.

#### Toast
Glass pill, `--shadow-3`, max-width 320–330px, padding `9px 18px 9px 9px`, gap 10. 32–34px circular icon chip (green success) with a 15px glyph, then 13px/700 message. Centered, `bottom: 104px` (above nav), `pointer-events: none`. Auto-dismisses after **2400–2600 ms**. Motion `.n-toast`.

#### FloatingNav
Detached glass pill, `left/right: 18px`, `bottom: 22px`, padding `9px 10px`, radius pill, `--shadow-3` + `--hairline-top`. Five tabs; 20px icons + 10px uppercase labels; active `--brand-primary` with a subtle drop-shadow, inactive `--text-tertiary`. Centre tab is a raised 52px circle (`margin-top: -20px`), `--grad-lime` fill, `--glow-lime`.
Content must reserve `116px` bottom padding.

### 7.2 Page-specific components

#### Date navigator
Row, `space-between`. Two 34×34 circular icon buttons (prev/next) with 15px chevrons; centre block = day label (22px/800) + date (11px/600). Label logic: offset 0 → "Today", −1 → "Yesterday", else weekday name.

#### Calorie summary card
`GlassCard`, padding 18.
Row 1: `{total} / {target} kcal` (36px/800 + 13px/600) and a "Copy yesterday" ghost pill (11px/700) right-aligned.
Row 2: remaining caption — 13px/700, green normally, `#EF4444` with "N kcal over" when over target.
Row 3: 10px pill progress bar; fill `--grad-violet`, or solid `#EF4444` when over.
Row 4: three `MacroBar`s in a 16px-gap flex row.

#### Quick entry tile row
Five equal tiles, gap 8. Each: 30px circular icon chip (`rgba(99,102,241,0.12)` bg, `--brand-primary` 15px glyph) + 9.5px/700 label, padding `12px 4px`, radius `--radius-md`, 1px `--border-subtle`, `--shadow-1`.
Tiles: **Search** (opens add-food sheet), **Photo**, **Scan**, **Recipes**, **Custom**.

#### Meal section
Header row: meal title (18px/700) + meal kcal (13px/800 green), 10px bottom margin.
Body: white container, radius `--radius-lg`, 1px `--border-subtle`, `--shadow-1`, containing food rows and a trailing full-width `+ Add food` row (`12px 14px` padding, 13px/700 `--brand-primary`).
Empty variant: centered column, `20px 16px` padding — "No food added yet" (13px/500 `--text-tertiary`) + `+ Add food` link.

#### Food row
`[46px FoodIcon] [name / meta] [kcal]` — padding `12px 14px`, gap 12, 1px `--border-subtle` bottom divider, whole row tappable (opens edit sheet), `.v2-row` press tint. Effective height ≈ 70px.

#### Edit sheet (food detail)
Hero: 72px FoodIcon, name (22px/800, centered), `{meal} · {time}` (11px/600 `--text-tertiary`).
"AMOUNT" label → `AmountField`: number input (88px wide, `12px 14px`, radius `--radius-md`) + unit `<select>` (flex 1, same metrics). Units: g, oz, slice, piece, cup, serving.
Macro grid: 4 equal cells, gap 10, padding `12px 8px`, radius `--radius-md`, `--bg-app` fill, 1px `--border-subtle` — value 18px/800 in role colour, label 9px/600 uppercase.
Actions: `Save` (primary, flex 1) + `Delete` (destructive outline). All macro values recompute live from amount × unit.

#### Add-food sheet
Title `Add to {meal}` (22px/800) + subtitle. Search field. Four ghost pills routing to Photo / Scan / Recipes / Custom (9.5px/600). Section label switches between `N results` and `Recently added`. Result list: bordered container, rows = 40px FoodIcon + name (15px/600) + `{kcal} kcal/100g` (11px/500). No-match state: bold line naming the query + guidance sentence.

#### Meal picker
"ADD TO" label + four equal pills (Breakfast/Lunch/Dinner/Snacks), padding `9px 4px`, 10.5px/700. Selected = `--grad-lime` + `--text-onbrand`; unselected = `--bg-app` + 1px `--border-subtle` + `--text-secondary`.

#### Photo estimate panel
Viewfinder: 170px tall, radius `--radius-lg`, `#111827` fill.
- *Capture:* 34px camera glyph + hint (11px/600, `rgba(255,255,255,0.85)`); actions `Take photo` (primary) + `Upload` (secondary).
- *Analyzing:* spinning 28px arc in `#818CF8`, `.n-spin` (0.8s linear), caption "Analyzing your plate…".
- *Result:* detected FoodIcons (52px) in the frame; below, one row per item — 22px circular include toggle (green fill + white check when on), 38px FoodIcon, name (13px/700), confidence caption (10px/600; amber "Low confidence — check this" under 70%), 62px amount input (radius 10), unit label. Excluded rows drop to `opacity .5`.
- Totals strip: `rgba(34,197,94,0.10)` fill, radius `--radius-md`, kcal (15px/700) + `N items · P/C/F` (11px/600).
- Actions: `Confirm & add to {meal}` (primary, disabled at 0 selected) + `Retake` (secondary).

#### Barcode scanner
Viewfinder 168px, `#111827`. Reticle 200×104, 2.5px `rgba(255,255,255,0.75)` border, radius 12; scanning adds a 2px indigo line with matching glow. Status caption bottom-centre: "Scanning…" / "Product found" / "No match".
Found state: product row (44px FoodIcon, name 15px/700, `code · kcal/100g` 11px/500) in a bordered `--radius-md` container → meal picker → primary `Add {amount}{unit} to {meal}`.
Manual fallback always visible: barcode text input + `Look up` secondary button.

#### Recipes panel
Two segmented pills (`Saved` / `Build new`) → meal picker → content.
*Saved:* bordered list; each row = 40px indigo-tinted star chip, name (15px/700), `N ingredients · P/C/F` (11px/500), total kcal (13px/700). Macros computed from ingredients, never stored.
*Build new:* name input → "INGREDIENTS (n)" → toggleable ingredient chips (selected = indigo fill with a ✓) → green totals strip (auto-calculated) → primary `Save & add to {meal}`, disabled until ≥1 ingredient.

#### Custom food form
Name input → "SERVING" + `AmountField` → 2×2 numeric fields (Kcal, Protein / Carbs, Fat; 10px uppercase labels, `11px 12px` padding) → meal picker → primary `Save food & add to {meal}`, disabled until name + kcal are present. Values normalised to per-100g on save.

#### Water tracker
`GlassCard`, padding 16. Header: "Water" (15px/700) + `n / 8 glasses` (13px/600 `--text-tertiary`). Below: 8 equal segments, height 30, radius 8, gap 6 — filled `rgba(99,102,241,0.85)`, empty `--bg-app` + 1px `--border-subtle`. Tapping segment *i* sets the count to *i+1*.

#### Day stats row
Three inline stats, gap 26: value (18px/800) over uppercase label (9px/700 `--text-tertiary`). Entries (neutral), protein (indigo), water volume (green).

#### Loading state
**Not yet applied to this page.** The system provides `Skeleton` / `SkeletonCard` (shimmer, `.n-skeleton`, 1.3s linear). Implementation should use `SkeletonCard` for the summary card and 3 skeleton rows per meal while the day fetch is in flight. Exact composition: **TBD**.

#### Error state
**TBD** — no designed state exists for "day failed to load" or "search request failed". Recommended: inline retry card using `--state-error` for the icon plus a secondary `Retry` button; must be designed before implementation.

---

## 8. Interaction states (summary matrix)

| Component | Default | Pressed | Focus | Selected | Disabled | Loading | Success | Error |
|---|---|---|---|---|---|---|---|---|
| Primary button | gradient + glow | scale .965 | ring | — | opacity .5 | spinner in place | toast | — |
| Secondary button | outline | scale .965 | ring | — | opacity .5 | — | — | — |
| Destructive button | red outline | scale .965 | ring | — | — | — | toast | — |
| Chip / pill | outlined | scale .965 | ring | gradient fill | — | — | — | — |
| Food row | white | bg tint | ring | — | — | skeleton | — | — |
| Search field | bordered | — | ring on wrapper | — | — | — | results | no-match copy |
| Toggle (photo item) | outlined circle | scale .965 | ring | green + check | — | — | — | — |
| Water segment | empty | — | ring | indigo fill | — | — | — | — |
| Progress bar | green fill | — | — | — | — | animates from 0 | — | red fill (over) |

---

## 9. Motion

| Token | Value |
|---|---|
| `--dur-instant` | 90ms |
| `--dur-fast` | 140ms |
| `--dur-base` | 220ms |
| `--dur-slow` | 340ms |
| `--ease-out` | `cubic-bezier(.22,.8,.3,1)` |
| `--ease-in-out` | `cubic-bezier(.5,0,.4,1)` |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` |

| Pattern | Class | Spec |
|---|---|---|
| Block entrance | `.v2-rise` | fade + 16px rise, `--dur-base` `--ease-out`, staggered via `.v2-d1…d5` (40/90/140/200/260ms) |
| Sheet | `.n-sheet` | translateY(100%) → 0, `--dur-base` `--ease-out` |
| Overlay | `.n-fade` | opacity 0 → 1, `--dur-base` |
| Toast | `.n-toast` | fade + 14px rise + scale .96 → 1, `--dur-base` `--ease-spring` |
| Bar fill | `.n-bar` | `scaleX` from 0, `--dur-slow` `--ease-out`; MacroBar animates `width` instead |
| Press | `.v2-press` | `scale(.965)`, `--dur-fast` |
| Row press | `.v2-row` | background transition, `--dur-fast` |
| Check pop | `pop-check` | scale 0 → 1.15 → 1, `--dur-base` `--ease-spring` |
| Spinner | `.n-spin` | 360° rotate, 0.8s linear infinite |
| Scan line | inline | translate loop over the reticle |

**Rules:** durations ≤ 340ms; only spinners and the scan line loop; spring easing only on discrete confirmations, never on layout; everything is disabled inside `@media (prefers-reduced-motion: reduce)` (already implemented).

---

## 10. Layout

| Rule | Value |
|---|---|
| Design viewport | 390 × 844 |
| Screen horizontal margin | 20px |
| Screen top padding | 16px |
| Content max width | 390px (single column; not responsive beyond mobile — **TBD** for tablet) |
| Vertical rhythm between blocks | 18px (recommend 16 or 20) |
| Card internal padding | 16–18px |
| Row height | ≈70px (12px padding + 46px icon) |
| Section header → content | 10px |
| Scroll container | absolute inset 0, `overflow-y: auto`, `padding-bottom: 116px` |
| Floating nav | 18px side insets, 22px from bottom, ≈70px tall incl. raised centre |
| Toast position | centered, 104px from bottom |
| Sheet max height | 88% of viewport |
| Safe area | **TBD** — currently fixed pixel offsets. Implement as `max(22px, env(safe-area-inset-bottom))` for nav and `env(safe-area-inset-top)` for page top. |

Layout is a single vertical scroll column. No grid on this page; the 2-up grid (`1fr 1fr`, 12px gap) exists elsewhere in the system.

---

## 11. Accessibility

**Met:**
- Food rows ≈70px tall — comfortably above 44px.
- Primary/secondary buttons ≈46px tall.
- Primary content text is 15px; 11px is reserved for meta.
- `--ring-focus` defined and applied via `.v2-press:focus-visible`.
- `aria-label` on all icon-only controls (date nav, clear, toggles, water segments).
- `prefers-reduced-motion` honoured system-wide.
- Text contrast: `#111827` on `#FFFFFF` = 16.9:1; `#64748B` on `#FFFFFF` ≈ 4.8:1 — both pass AA.

**Must fix during implementation:**
- **Touch targets below 44px:** date nav buttons (34px), water segments (30px tall), photo include toggles (22px), search clear button (20px). Keep the visual size; expand the hit area with padding or a pseudo-element.
- **White-on-amber contrast:** `#FFFFFF` on `#F59E0B` ≈ 2.1:1 — fails AA. Amber fills must use `#111827` text, or amber must be restricted to non-text roles.
- **Green-on-white small text:** `#22C55E` on `#FFFFFF` ≈ 2.3:1 — currently used for 13px meal totals and the remaining caption, **fails AA for text**. Use `#15803D` (≈4.6:1) for green *text*, keep `#22C55E` for bars and fills.
- **Sheet focus management:** trap focus in an open sheet, restore focus to the trigger on close, support Escape. Not implemented — **required**.
- Announce toast messages via a polite live region.
- Never signal state by colour alone — the over-target state must keep its copy change.

---

## 12. Token vs component values

**Global tokens** (theme-level, shared app-wide): all of §2, §3.1, §4.1, §5, §6, §9.

**Component-specific values** (live beside the component, not in the theme): FoodIcon size ratios (0.42 / 0.52) and tint set; MacroBar bar height (5px) and value size (21px); water segment geometry (30px / radius 8 / gap 6); viewfinder heights (170 / 168) and reticle (200×104); sheet grab handle (36×4); nav insets (18/22) and raised-centre offset (−20px); scroll bottom padding (116px); toast auto-dismiss duration; photo confidence threshold (0.7).

---

## 13. Implementation guidance for Claude Code

1. **Ship tokens first.** Create the theme from §2/§3/§4/§5/§6/§9 as CSS custom properties (or a typed token object) *before* any component. **Rename the mis-named tokens (§14.1) in this same pass** — no component should ever reference `--lime-*` for indigo.
2. **Build primitives in this order:** Button → Field/Input → AmountField → Chip/Pill → FoodIcon → MacroBar → Card/GlassCard → Sheet → Toast → FloatingNav. Everything else composes from these.
3. **One derived-macro function.** `entryMacros(entry) = per100 × grams(amount, unit) / 100`. Never store computed macros; store `foodId + amount + unit`. All totals (row, meal, day) derive from it.
4. **One mutation surface.** `addEntry`, `addPhotoItems`, `addScanned`, `addRecipe`, `saveCustom`, `updateEntry`, `removeEntry`, `copyYesterday`, `setWater`. UI calls only these; swap their bodies for API calls without touching JSX.
5. **One sheet shell.** All flows (add-food, edit, photo, scan, recipes, custom) render inside the same `Sheet` — no bespoke modals.
6. **State shape:** `{ date, meals: { Breakfast: Entry[], Lunch: Entry[], Dinner: Entry[], Snacks: Entry[] }, water }` plus UI state `{ detail, adding, mode, targetMeal, query }`. Persist per date.
7. **Data contracts:**
   ```ts
   Food     = { id, name, per100: { kcal, protein, carbs, fat } }
   Entry    = { uid, foodId, name, per100, amount, unit, time }
   Recipe   = { id, name, items: Array<[foodId, amount, unit]> }
   Product  = { code, name, per100, amount, unit }
   Detected = { id, name, per100, amount, unit, confidence, on }
   ```
8. **Endpoint swap points:** `FOOD_DB` → food search; `BARCODES` → barcode lookup; `RECIPES` → user recipes; `seed()` → `GET /diary/{date}`; `PhotoEstimatePanel.analyze()` → vision estimate; `TARGETS` → user goals.
9. **Add what's missing** (§7 loading/error states, §11 focus management, safe-area insets) as part of the build, not after.
10. **Do not** introduce new colours, radii, durations or font sizes. If a need arises, add a token and document it here.

---

## 14. Known inconsistencies to resolve before development

### 14.1 Token names contradict their values *(highest priority)*
`--lime-*` holds **indigo**, `--violet-*` holds **green**, `--apricot-*` holds **amber**. These names survive from an earlier palette. This already caused a live bug: `MacroBar`'s tone map was written against the old meanings, so protein/carbs/fat rendered with inverted colours versus the rest of the page. **Rename to `--indigo-*` / `--green-*` / `--amber-*` in the first pass.**

### 14.2 Off-scale type sizes
9px, 9.5px, 10px, 10.5px and 21px are used outside the token scale. Decide: add `--text-nano` (10px) and `--text-stat` (21px), or snap all of them to 11px / 22px.

### 14.3 Off-scale spacing
6, 7, 10, 11, 13, 14, 18, 22, 26 and 30px appear alongside the 4/8/12/16/20/24 scale. Snap during implementation.

### 14.4 Off-scale radii
8, 10 and 12px small radii coexist without tokens. Add `--radius-xs` (8) and `--radius-sm` (12); drop the one-off 10px.

### 14.5 Two Log implementations exist
`LogScreenV2.jsx` (earlier food diary) and `LogPageV3.jsx` (current). **`LogPageV3` is canonical** — delete or archive the other so there is one source of truth.

### 14.6 Secondary-text token vs original brief
The brief specified `#64748B` as secondary text; the implementation uses `#475569` for secondary and `#64748B` for tertiary. Pick one convention and update either the tokens or the docs.

### 14.7 Contrast failures
Green and amber are used for small text on white (§11). Introduce text-safe variants (`#15803D` green text, `#B45309` amber text) and keep the bright values for fills only.

### 14.8 Missing states
No loading, error or offline state on this page. All three need design before implementation.

### 14.9 Favorites
Referenced in earlier product copy but absent from the design. Either design it or drop it from the entry-point set.

### 14.10 Fat and calories share green
Intentional today because they never appear together. Document the rule so a future chart doesn't break it.
