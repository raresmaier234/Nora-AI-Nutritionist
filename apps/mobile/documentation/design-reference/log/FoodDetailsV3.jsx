/* Food Details — full-screen mobile nutrition screen (v3 · visual pass).
   Structure: compact hero (icon left of title) → calories + macros → quantity → good source of → nutrition sections → sticky Add to Log.
   Data: ./nutrition-data.js (per 100 g). Values scale live to serving × quantity.
   null / missing nutrients are never rendered; empty sections disappear. */
const { FoodIcon: FDIcon, FOOD_CATEGORIES: FD_CATS, GENERIC_FOOD_ICON: FD_GENERIC } = window.NoraDesignSystem_a9ff6f;
const { DV: FD_DV, SECTIONS: FD_SECTIONS, NUTRITION: FD_NUTRITION, SERVINGS: FD_SERVINGS, TARGETS: FD_TARGETS } = window.NoraNutrition;

const FD_GOALS = { kcal: 2000, protein: 150, carbs: 220, fat: 70, fiber: 28 };
const FD_MICRO_KEYS = ['vitA','vitC','vitD','vitE','vitK','thiamin','riboflavin','niacin','b6','folate','b12','choline','pantothenic','calcium','iron','magnesium','phosphorus','potassium','zinc','copper','manganese','selenium'];
const FD_VITAMINS = new Set(FD_MICRO_KEYS.slice(0, 13));

// Same precedence the FoodIcon library uses ("Chicken burrito" → burrito, "Chicken breast" → chicken).
const FD_ORDER = ['drinks', 'sweets', 'baked', 'other', 'seafood', 'meat', 'nuts', 'dairy', 'veg', 'fruit'];
const FD_ITEMS = FD_ORDER.flatMap(id => { const c = FD_CATS.find(x => x.id === id); return c ? c.items.map(it => ({ ...it, cat: c })) : []; });
function fdArt(name) {
  const hit = FD_ITEMS.find(it => it.match.test(name || ''));
  if (hit) return { src: hit.src, cat: hit.cat };
  const kw = FD_CATS.find(c => c.keywords && c.keywords.test(name || ''));
  return kw ? { src: kw.src, cat: kw } : { src: FD_GENERIC, cat: null };
}
const FD_HERO = {
  amber: ['#FFF4E4', '#FFDDB0'], green: ['#EAF9F0', '#BFEFD2'], indigo: ['#EFF0FF', '#D3D8FF'], neutral: ['#F3F5F9', '#DDE3EC'],
};

// Section identity: family colour + small line glyph.
const FD_SECTION_META = {
  macros:   { c: 'kcal',    icon: <><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M15.5 3.7A9 9 0 0 1 20.3 8.5H15.5z" /></> },
  sugars:   { c: 'carbs',   icon: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12 4 7.5" /></> },
  fats:     { c: 'fat',     icon: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /> },
  amino:    { c: 'protein', icon: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.3 10.9l7.4-3.8M8.3 13.1l7.4 3.8" /></> },
  vitamins: { c: 'vitamin', icon: <><path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 1 1 7-7l7 7a4.95 4.95 0 1 1-7 7z" /><path d="M8.5 8.5l7 7" /></> },
  minerals: { c: 'mineral', icon: <><path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20M12 21 8 9l4-6 4 6-4 12" /></> },
  other:    { c: 'other',   icon: <><path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7 15h10" /></> },
};
const nu = (family, kind) => `var(--nu-${family}${kind ? '-' + kind : ''})`;

const fdFmt = (v) => {
  if (v === 0) return '0';
  if (v < 0.1) return '<0.1';
  if (v < 10) return (Math.round(v * 10) / 10).toString();
  return Math.round(v).toLocaleString();
};
function fdResolve(food) {
  const base = { ...(FD_NUTRITION[food.id] || {}), ...(food.nutrients || {}) };
  const p = food.per100 || {};
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) if (base[k] == null && p[k] != null) base[k] = p[k];
  if (base.unsaturated == null && (base.mono != null || base.poly != null)) base.unsaturated = (base.mono || 0) + (base.poly || 0);
  return base;
}

// ---- Pieces ---------------------------------------------------------------------
function FDCalorieRing({ kcal, beforePct, addPct }) {
  const size = 124, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const b = Math.max(0, Math.min(1, (beforePct || 0) / 100));
  const n = Math.max(b, Math.min(1, ((beforePct || 0) + (addPct || 0)) / 100));
  const addLen = c * (n - b);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="fdKcalGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFA37F" /><stop offset="100%" stopColor="#F25C3B" /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--nu-kcal-tint)" strokeWidth={stroke} />
        {b > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--nu-kcal)" strokeOpacity={0.35} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={on ? c * (1 - b) : c} style={{ transition: 'stroke-dashoffset var(--dur-slow) var(--ease-out)' }} />}
        {addLen > 0.5 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#fdKcalGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={(on ? addLen : 0) + ' ' + c} strokeDashoffset={-c * b}
          style={{ transition: 'stroke-dasharray var(--dur-slow) var(--ease-out) 120ms' }} />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ font: 'var(--weight-extrabold) 32px/1 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: 'var(--track-tight)' }}>{kcal.toLocaleString()}</span>
        <span style={{ font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: nu('kcal', 'ink'), marginTop: 4 }}>kcal</span>
      </div>
    </div>
  );
}

// Daily target bar: full width = daily goal. Faded = eaten today, solid = this food.
function FDMacroBar({ family, label, add, before, goal }) {
  const has = before != null;
  const b = has ? Math.max(0, before) : 0;
  const a = Math.max(0, add || 0);
  const total = b + a;
  const bPct = Math.min(100, (b / goal) * 100);
  const nPct = Math.min(100, (total / goal) * 100);
  const aPct = a > 0 ? Math.max(nPct - bPct, bPct >= 100 ? 0 : 2) : 0;
  const left = goal - total;
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--weight-semibold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: nu(family) }} />{label}
        </span>
        <span>
          <span style={{ font: 'var(--weight-extrabold) var(--text-h2)/1 var(--font-sans)', color: has ? nu(family, 'ink') : 'var(--text-primary)', letterSpacing: 'var(--track-tight)' }}>{has ? '+' : ''}{fdFmt(a)}</span>
          <span style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginLeft: 2 }}>g</span>
        </span>
      </div>
      <div role="img" aria-label={label + ': ' + fdFmt(b) + ' g eaten, plus ' + fdFmt(a) + ' g, ' + fdFmt(total) + ' of ' + goal + ' g target'}
        style={{ display: 'flex', gap: b > 0 && a > 0 && bPct < 100 ? 2 : 0, height: 12, borderRadius: 'var(--radius-pill)', background: nu(family, 'tint'), overflow: 'hidden' }}>
        <div style={{ width: (on ? bPct : 0) + '%', background: nu(family), opacity: 0.35, flexShrink: 0, transition: 'width var(--dur-slow) var(--ease-out)' }} />
        <div style={{ width: (on ? aPct : 0) + '%', background: nu(family), flexShrink: 0, transition: 'width var(--dur-slow) var(--ease-out) 120ms' }} />
      </div>
      {has && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 7, font: 'var(--weight-medium) var(--text-micro)/1.3 var(--font-sans)', color: 'var(--text-tertiary)' }}>
          <span>{fdFmt(b)} → <b style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{fdFmt(total)}</b> of {goal} g</span>
          {left >= 0
            ? <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{fdFmt(left)} g left</span>
            : <span style={{ fontWeight: 800, color: '#DC2626' }}>{fdFmt(-left)} g over</span>}
        </div>
      )}
    </div>
  );
}

// Nutrient row. With a daily target → compact target bar (eaten faded · this food solid · track = target).
// Without a target → value only. One component for every section.
function FDRow({ label, value, unit, sub, family, first, nKey, eaten, hasDay }) {
  const t = nKey && FD_TARGETS[nKey];
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const border = first ? 'none' : '1px solid var(--nu-other-tint)';
  const labelEl = <span style={{ flex: 1, minWidth: 0, font: (sub ? 'var(--weight-medium)' : 'var(--weight-semibold)') + ' var(--text-body)/1.25 var(--font-sans)', color: sub ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{label}</span>;
  if (!t) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 46, paddingLeft: sub ? 16 : 0, borderTop: border }}>
        {labelEl}
        <span style={{ flexShrink: 0 }}>
          <span style={{ font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{fdFmt(value)}</span>
          <span style={{ font: 'var(--weight-medium) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginLeft: 3 }}>{unit}</span>
        </span>
      </div>
    );
  }
  const target = t.v, limit = t.kind === 'limit';
  const b = hasDay ? Math.max(0, eaten || 0) : 0;
  const a = Math.max(0, value || 0);
  const total = b + a;
  const bPct = Math.min(100, (b / target) * 100);
  const nPct = Math.min(100, (total / target) * 100);
  const aPct = a > 0 ? Math.max(nPct - bPct, bPct >= 100 ? 0 : 1.5) : 0;
  const left = target - total;
  const over = left < 0;
  const n = (v) => fdFmt(v);
  return (
    <div style={{ padding: '12px 0', paddingLeft: sub ? 16 : 0, borderTop: border }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        {labelEl}
        <span style={{ flexShrink: 0, font: 'var(--weight-extrabold) var(--text-small)/1 var(--font-sans)', color: nu(family, 'ink') }}>+{n(a)} {unit}</span>
      </div>
      <div role="img" aria-label={label + ': ' + (hasDay ? n(b) + ' ' + unit + ' eaten, plus ' + n(a) + ', ' : '') + n(total) + ' of ' + n(target) + ' ' + unit + (limit ? ' limit' : ' target')}
        style={{ display: 'flex', gap: b > 0 && a > 0 && bPct < 100 ? 2 : 0, height: 8, borderRadius: 'var(--radius-pill)', background: nu(family, 'tint'), overflow: 'hidden', margin: '9px 0 7px' }}>
        <div style={{ width: (on ? bPct : 0) + '%', background: over ? '#DC2626' : nu(family), opacity: 0.35, flexShrink: 0, transition: 'width var(--dur-slow) var(--ease-out)' }} />
        <div style={{ width: (on ? aPct : 0) + '%', background: over ? '#DC2626' : nu(family), flexShrink: 0, transition: 'width var(--dur-slow) var(--ease-out) 120ms' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, font: 'var(--weight-medium) var(--text-micro)/1.3 var(--font-sans)', color: 'var(--text-tertiary)' }}>
        <span><b style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{n(total)}</b> / {n(target)} {unit}{limit ? ' limit' : ''}</span>
        {over
          ? <span style={{ fontWeight: 800, color: '#DC2626' }}>{n(-left)} {unit} over</span>
          : <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{n(left)} {unit} {limit ? 'under limit' : 'remaining'}</span>}
      </div>
    </div>
  );
}

function FDSection({ section, values, defaultOpen, summary, eaten, hasDay }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const rows = section.rows.filter(([k]) => values[k] != null);
  if (!rows.length) return null;
  const meta = FD_SECTION_META[section.id] || FD_SECTION_META.other;
  const useDV = section.id === 'vitamins' || section.id === 'minerals';
  let seen = false;
  return (
    <div style={{ background: 'var(--bg-surface-solid)', borderRadius: 22, border: '1px solid #EEF1F5', overflow: 'hidden' }}>
      <button className="v2-row" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{
        width: '100%', minHeight: 72, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left'
      }}>
        <span style={{ width: 44, height: 44, borderRadius: 14, background: nu(meta.c, 'tint'), color: nu(meta.c, 'ink'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{meta.icon}</svg>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', font: 'var(--weight-bold) var(--text-body)/1.2 var(--font-sans)', fontSize: 16, color: 'var(--text-primary)' }}>{section.label}</span>
          <span style={{ display: 'block', font: 'var(--weight-medium) var(--text-small)/1.2 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 4 }}>{summary || `${rows.length} nutrients`}</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur-base) var(--ease-out)' }}><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows var(--dur-base) var(--ease-out)' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0 16px 10px' }}>
            {rows.map(([k, label, unit, sub, group]) => {
              const first = !seen || !!group; seen = true;
              return (
                <React.Fragment key={section.id + k}>
                  {group && <div style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: nu(meta.c, 'ink'), letterSpacing: 'var(--track-wide)', textTransform: 'uppercase', padding: '14px 0 6px' }}>{group}</div>}
                  <FDRow label={label} value={values[k]} unit={unit} sub={!!sub} nKey={k} eaten={eaten && eaten[k]} hasDay={hasDay}
                    family={useDV ? (FD_VITAMINS.has(k) ? 'vitamin' : 'mineral') : meta.c} first={first} />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Impact bar: eaten (solid) + this food (striped, same family) + left (tint), with a target tick.
// Over target: the scale stretches to the new total so the tick moves left; copy stays neutral.
function FDImpactBar({ family, label, unit, eaten, add, target }) {
  const total = eaten + add;
  const scale = Math.max(target, total) || 1;
  const over = total - target;
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const w = (v) => (on ? (v / scale) * 100 : 0) + '%';
  const n = (v) => Math.round(v).toLocaleString();
  const ease = 'width var(--dur-slow) var(--ease-out), left var(--dur-slow) var(--ease-out)';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: nu(family) }} />{label}
        </span>
        <span style={{ whiteSpace: 'nowrap' }}>
          <span style={{ font: 'var(--weight-extrabold) 22px/1 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: 'var(--track-tight)' }}>{n(total)}</span>
          <span style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}> / {n(target)} {unit}</span>
        </span>
      </div>
      <div style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginBottom: 10, paddingLeft: 18 }}>
        {n(eaten)} <span style={{ color: nu(family, 'ink'), fontWeight: 800 }}>+ {n(add)}</span>
      </div>
      <div style={{ position: 'relative', height: 14 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-pill)', background: nu(family, 'tint'), overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: w(eaten), height: '100%', background: nu(family), transition: ease }} />
          <div style={{ width: w(add), height: '100%', transition: ease,
            background: `repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 3px, rgba(255,255,255,0) 3px 7px), ${nu(family)}`, opacity: 0.85,
            boxShadow: add > 0 ? 'inset 2px 0 0 rgba(255,255,255,0.9)' : 'none' }} />
        </div>
        <div aria-hidden="true" style={{ position: 'absolute', top: -4, bottom: -4, width: 3, marginLeft: -1.5, borderRadius: 2, background: 'var(--text-primary)', opacity: 0.75,
          left: (on ? (target / scale) * 100 : 100) + '%', transition: ease, boxShadow: '0 0 0 2px #fff' }} />
      </div>
      <div style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', marginTop: 9, color: over > 0 ? nu(family, 'ink') : 'var(--text-tertiary)' }}>
        {over > 0 ? `+${n(over)} ${unit} over target` : `${n(-over)} ${unit} remaining`}
      </div>
    </div>
  );
}

// ---- Screen -----------------------------------------------------------------------
const FD_ZERO = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
function FoodDetails({ food, mode, meal, initialGrams, consumed, targets, onClose, onAdd, onSave, onDelete }) {
  const eaten = consumed || FD_ZERO;
  const goal = { ...FD_GOALS, ...(targets || {}) };
  const servings = React.useMemo(() => [['g', 1], ['100 g', 100], ...(FD_SERVINGS[food.id] || [['1 serving', 100]])], [food.id]);
  const startGrams = initialGrams || (FD_SERVINGS[food.id] ? FD_SERVINGS[food.id][0][1] : 100);
  const startIdx = initialGrams ? 0 : 2;
  const [servingIdx, setServingIdx] = React.useState(startIdx);
  const [qty, setQty] = React.useState(startIdx === 0 ? Math.round(startGrams) : 1);
  const [targetMeal, setTargetMeal] = React.useState(meal || window.NoraTime.nowHHMM()); // time eaten
  const [scrolled, setScrolled] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [artSrc, setArtSrc] = React.useState(null);

  const art = React.useMemo(() => fdArt(food.name), [food.name]);
  const hero = FD_HERO[(art.cat && art.cat.tint) || 'neutral'] || FD_HERO.neutral;
  const [servingLabel, servingGrams] = servings[servingIdx];
  const isGrams = servingIdx === 0;
  const step = isGrams ? 10 : 0.5;
  const grams = Math.max(0, (Number(qty) || 0) * servingGrams);
  const per100 = React.useMemo(() => fdResolve(food), [food]);
  const values = React.useMemo(() => {
    const f = grams / 100, out = {};
    for (const k in per100) if (per100[k] != null) out[k] = per100[k] * f;
    return out;
  }, [per100, grams]);

  const pickServing = (i) => {
    if (i === 1) { setServingIdx(0); setQty(100); return; } // "100 g" = grams mode at 100
    setQty(i === 0 ? (Math.round(grams) || 100) : 1); setServingIdx(i);
  };
  const close = () => { setClosing(true); setTimeout(onClose, 180); };
  const kcal = Math.round(values.kcal || 0);
  const kcalPct = Math.round((kcal / goal.kcal) * 100);
  const C = consumed || null; // day so far (edit mode: excluding this entry)
  const beforeKcal = C ? Math.max(0, Math.round(eaten.kcal || 0)) : 0;
  const afterKcal = beforeKcal + kcal;
  const kcalLeft = goal.kcal - afterKcal;
  const pK = (values.protein || 0) * 4, cK = (values.carbs || 0) * 4, fK = (values.fat || 0) * 9;
  const tK = pK + cK + fK || 1;
  const split = [['protein', 'Protein', pK], ['carbs', 'Carbs', cK], ['fat', 'Fat', fK]].map(([f, l, k]) => ({ f, l, pct: Math.round((k / tK) * 100) }));
  const rowLabel = (k) => (FD_SECTIONS.flatMap(s => s.rows).find(r => r[0] === k) || [])[1];
  const keyMicros = FD_MICRO_KEYS.filter(k => values[k] != null)
    .map(k => ({ k, pct: Math.round((values[k] / FD_DV[k]) * 100), label: rowLabel(k), fam: FD_VITAMINS.has(k) ? 'vitamin' : 'mineral' }))
    .filter(x => x.pct >= 10).sort((a, b) => b.pct - a.pct).slice(0, 4);
  const sectionSummary = {
    macros: `${fdFmt(values.protein || 0)} g protein · ${fdFmt(values.carbs || 0)} g carbs · ${fdFmt(values.fat || 0)} g fat`,
    sugars: values.sugar != null ? `${fdFmt(values.sugar)} g total sugars` : null,
    fats: values.fat != null ? `${fdFmt(values.fat)} g total${values.cholesterol != null ? ` · ${fdFmt(values.cholesterol)} mg cholesterol` : ''}` : null,
    minerals: values.sodium != null ? `${fdFmt(values.sodium)} mg sodium` : null,
    other: values.caffeine ? `${fdFmt(values.caffeine)} mg caffeine` : values.alcohol ? `${fdFmt(values.alcohol)} g alcohol` : null,
  };
  // A gram-based unit ("100 g") is shown as plain grams — never "1 × 100 g · 100 g".
  const unitIsGrams = isGrams || /^\d+(\.\d+)?\s*g$/i.test(servingLabel);
  const unitName = servingLabel.replace(/^1 /, '');
  const qtyLabel = unitIsGrams ? `${fdFmt(grams)} g` : `${Number(qty) === 1 ? servingLabel : `${qty} × ${unitName}`} · ${fdFmt(grams)} g`;

  const screen = (
    <div className={closing ? '' : 'n-fade'} style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', background: 'rgba(17,24,39,0.3)', opacity: closing ? 0 : 1, transition: 'opacity 180ms var(--ease-out)' }}>
      <div className="n-sheet" role="dialog" aria-modal="true" aria-label={food.name} style={{
        position: 'absolute', inset: 0, background: 'var(--bg-surface-solid)', overflow: 'hidden',
        transform: closing ? 'translateY(100%)' : 'none', transition: 'transform 180ms var(--ease-in-out)'
      }}>
        {/* Floating top bar — transparent over the hero, solid once the hero scrolls away */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3, display: 'flex', alignItems: 'center', gap: 8,
          padding: 'calc(10px + env(safe-area-inset-top)) 12px 10px',
          background: scrolled ? 'rgba(255,255,255,0.94)' : 'transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: '1px solid ' + (scrolled ? 'var(--border-subtle)' : 'transparent'),
          transition: 'background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)'
        }}>
          <button className="v2-press" onClick={close} aria-label="Close" style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.9)', boxShadow: scrolled ? 'none' : 'var(--shadow-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div style={{ flex: 1, textAlign: 'center', font: 'var(--weight-bold) var(--text-body)/1.2 var(--font-sans)', color: 'var(--text-primary)', opacity: scrolled ? 1 : 0, transform: scrolled ? 'none' : 'translateY(4px)', transition: 'opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)', minWidth: 0, overflowWrap: 'anywhere', textWrap: 'balance' }}>
            {food.name} · <span style={{ color: nu('kcal', 'ink') }}>{kcal} kcal</span>
          </div>
          <div style={{ width: 44, flexShrink: 0 }} />
        </div>

        <div onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 90)} style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingBottom: 176, WebkitOverflowScrolling: 'touch' }}>
          {/* Hero — compact: small icon left of the title so the details stay in view */}
          <div style={{
            position: 'relative', padding: 'calc(64px + env(safe-area-inset-top)) 20px 46px',
            background: `linear-gradient(180deg, ${hero[0]} 0%, #FFFFFF 100%)`
          }}>
            <div className="v2-rise" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 20, background: 'rgba(255,255,255,0.9)', boxShadow: `0 8px 20px ${hero[1]}, inset 0 1px 0 #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={artSrc || art.src} alt="" width="40" height="40" onError={() => setArtSrc(FD_GENERIC)} style={{ display: 'block', filter: 'drop-shadow(0 3px 5px rgba(17,24,39,0.14))' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: 'var(--weight-extrabold) 22px/1.15 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: 'var(--track-tight)', textWrap: 'pretty' }}>{food.name}</div>
                <div style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 6 }}>{qtyLabel}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '0 18px', marginTop: -30, position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Level 1 — calories ring + where the energy comes from + macro bars */}
            <div className="v2-rise v2-d2" style={{ background: 'var(--bg-surface-solid)', borderRadius: 28, padding: 20, boxShadow: '0 12px 32px rgba(17,24,39,0.08)', border: '1px solid #EEF1F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <FDCalorieRing kcal={kcal} beforePct={(beforeKcal / goal.kcal) * 100} addPct={(kcal / goal.kcal) * 100} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {C ? (
                    <React.Fragment>
                      <div style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase' }}>Your day</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <span style={{ font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>{beforeKcal.toLocaleString()}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                        <span style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: nu('kcal', 'ink'), letterSpacing: 'var(--track-tight)' }}>{afterKcal.toLocaleString()}</span>
                      </div>
                      <div style={{ font: 'var(--weight-medium) var(--text-small)/1.35 var(--font-sans)', color: 'var(--text-secondary)', marginTop: 6 }}>
                        of {goal.kcal.toLocaleString()} kcal · {kcalLeft >= 0
                          ? <b style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{kcalLeft.toLocaleString()} left</b>
                          : <b style={{ color: '#DC2626', fontWeight: 800 }}>{(-kcalLeft).toLocaleString()} over</b>}
                      </div>
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                  <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: nu('kcal', 'ink'), letterSpacing: 'var(--track-tight)' }}>{kcalPct}%</div>
                  <div style={{ font: 'var(--weight-medium) var(--text-small)/1.35 var(--font-sans)', color: 'var(--text-secondary)', marginTop: 4 }}>of your {goal.kcal.toLocaleString()} kcal day</div>
                    </React.Fragment>
                  )}
                  <div style={{ display: 'flex', height: 8, borderRadius: 'var(--radius-pill)', overflow: 'hidden', gap: 2, margin: '14px 0 8px', background: 'var(--nu-other-tint)' }}>
                    {split.map(s => <div key={s.f} style={{ flex: s.pct, background: nu(s.f), transition: 'flex var(--dur-slow) var(--ease-out)' }} />)}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {split.map(s => (
                      <span key={s.f} style={{ font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>
                        <b style={{ color: nu(s.f, 'ink'), fontWeight: 800 }}>{s.pct}%</b> {s.l.toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: 'var(--nu-other-tint)', margin: '20px 0 18px' }} />
              {C && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--nu-other)', opacity: 0.35 }} />Eaten today</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--nu-other)' }} />This food</span>
                  <span style={{ marginLeft: 'auto' }}>Full bar = goal</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <FDMacroBar family="protein" label="Protein" add={values.protein || 0} before={C ? eaten.protein || 0 : null} goal={goal.protein} />
                <FDMacroBar family="carbs" label="Carbs" add={values.carbs || 0} before={C ? eaten.carbs || 0 : null} goal={goal.carbs} />
                <FDMacroBar family="fat" label="Fat" add={values.fat || 0} before={C ? eaten.fat || 0 : null} goal={goal.fat} />
                {values.fiber != null && <FDMacroBar family="fiber" label="Fiber" add={values.fiber} before={C && eaten.fiber != null ? eaten.fiber : null} goal={goal.fiber || FD_GOALS.fiber} />}
              </div>
              {!C && <div style={{ font: 'var(--weight-medium) var(--text-micro)/1.4 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 14 }}>Bars show this portion's share of your daily goal.</div>}
            </div>

            {/* Quantity — serving + thumb-sized stepper */}
            <div className="v2-rise v2-d3" style={{ background: 'var(--nu-protein-tint)', borderRadius: 26, padding: 18 }}>
              <div style={{ font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: nu('protein', 'ink'), marginBottom: 12 }}>Serving size</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {servings.map(([label, g], i) => {
                  const on = i === 1 ? (servingIdx === 0 && Number(qty) === 100) : i === 0 ? (servingIdx === 0 && Number(qty) !== 100) : i === servingIdx;
                  return (
                    <button key={label} className="v2-press" onClick={() => pickServing(i)} aria-pressed={on} style={{
                      minHeight: 44, padding: '0 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                      border: on ? 'none' : '1px solid rgba(99,102,241,0.18)',
                      background: on ? 'var(--grad-lime)' : 'var(--bg-surface-solid)',
                      boxShadow: on ? '0 6px 14px rgba(99,102,241,0.28)' : 'none',
                      color: on ? '#fff' : 'var(--text-primary)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)'
                    }}>{label}{i > 1 && <span style={{ opacity: on ? 0.85 : 1, color: on ? '#fff' : 'var(--text-tertiary)', fontWeight: 500 }}> · {g} g</span>}</button>
                  );
                })}
              </div>
              <div style={{ font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: nu('protein', 'ink'), marginBottom: 12 }}>Quantity</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="v2-press" onClick={() => setQty(q => Math.max(0, Math.round(((Number(q) || 0) - step) * 10) / 10))} aria-label="Decrease" style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: 'var(--bg-surface-solid)', boxShadow: 'var(--shadow-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--nu-protein-ink)" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h14" /></svg>
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, height: 56, borderRadius: 18, background: 'var(--bg-surface-solid)', boxShadow: 'var(--shadow-1)', paddingTop: 13 }}>
                  <input type="number" inputMode="decimal" min="0" step={step} value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity"
                    style={{ width: 90, border: 'none', outline: 'none', background: 'transparent', textAlign: 'right', font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)', padding: 0 }} />
                  <span style={{ font: 'var(--weight-semibold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-tertiary)', minWidth: 60 }}>{isGrams ? 'g' : unitIsGrams ? '× ' + servingLabel : unitName}</span>
                </div>
                <button className="v2-press" onClick={() => setQty(q => Math.round(((Number(q) || 0) + step) * 10) / 10)} aria-label="Increase" style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: 'var(--grad-lime)', boxShadow: 'var(--glow-lime)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                <span style={{ padding: '7px 12px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,0.7)', font: 'var(--weight-medium) var(--text-small)/1 var(--font-sans)', color: 'var(--text-secondary)' }}>
                  All values are for <b style={{ color: nu('protein', 'ink'), fontWeight: 800 }}>{fdFmt(grams)} g</b>
                </span>
              </div>
            </div>

            {/* Impact on your day — eaten → + this portion → new total vs target. Updates live with quantity. */}
            <div className="v2-rise v2-d3" style={{ background: 'var(--bg-surface-solid)', borderRadius: 26, padding: '18px 18px 20px', border: '1px solid #EEF1F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18 }}>
                <span style={{ font: 'var(--weight-extrabold) var(--text-h2)/1 var(--font-sans)', color: 'var(--text-primary)' }}>Impact on your day</span>
                <span style={{ display: 'flex', gap: 10, font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><i style={{ width: 10, height: 6, borderRadius: 3, background: 'var(--text-secondary)' }} />Eaten</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><i style={{ width: 10, height: 6, borderRadius: 3, background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.55) 0 2px, rgba(255,255,255,0) 2px 4px), var(--text-secondary)', opacity: 0.85 }} />This food</span>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <FDImpactBar family="kcal" label="Calories" unit="kcal" eaten={eaten.kcal} add={values.kcal || 0} target={goal.kcal} />
                <FDImpactBar family="protein" label="Protein" unit="g" eaten={eaten.protein} add={values.protein || 0} target={goal.protein} />
                <FDImpactBar family="carbs" label="Carbs" unit="g" eaten={eaten.carbs} add={values.carbs || 0} target={goal.carbs} />
                <FDImpactBar family="fat" label="Fat" unit="g" eaten={eaten.fat} add={values.fat || 0} target={goal.fat} />
              </div>
            </div>

            {/* Level 2 — standout vitamins & minerals */}
            {keyMicros.length > 0 && (
              <div className="v2-rise v2-d3">
                <div style={{ font: 'var(--weight-extrabold) var(--text-h2)/1 var(--font-sans)', color: 'var(--text-primary)', margin: '6px 2px 12px' }}>Good source of</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
                  {keyMicros.map(m => (
                    <div key={m.k} style={{ background: nu(m.fam, 'tint'), borderRadius: 20, padding: '14px 14px 13px' }}>
                      <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: nu(m.fam, 'ink'), letterSpacing: 'var(--track-tight)' }}>{m.pct}%</div>
                      <div style={{ font: 'var(--weight-semibold) var(--text-small)/1.25 var(--font-sans)', color: 'var(--text-primary)', marginTop: 6 }}>{m.label}</div>
                      <div style={{ height: 5, borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,0.75)', marginTop: 10, overflow: 'hidden' }}>
                        <div style={{ width: Math.min(100, m.pct) + '%', height: '100%', borderRadius: 'var(--radius-pill)', background: nu(m.fam) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nutrition cards — Macronutrients open, advanced detail collapsed */}
            <div className="v2-rise v2-d4">
              <div style={{ font: 'var(--weight-extrabold) var(--text-h2)/1 var(--font-sans)', color: 'var(--text-primary)', margin: '6px 2px 12px' }}>Full nutrition</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {FD_SECTIONS.map(s => <FDSection key={s.id} section={s} values={values} defaultOpen={s.open} summary={sectionSummary[s.id]} eaten={eaten} hasDay={!!consumed} />)}
              </div>
              <div style={{ padding: '16px 4px 0', font: 'var(--weight-medium) var(--text-micro)/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>
                % DV based on a 2,000 kcal diet. Nutrients without data for this food are not shown.
              </div>
            </div>
          </div>
        </div>

        {/* Sticky action area — always reachable, clears the home indicator */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3, padding: '12px 20px calc(14px + env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border-subtle)' }}>
          {mode === 'edit' ? (
            <React.Fragment>
            {(() => { const W = window.NoraTime.WhenPicker; return <W value={targetMeal} onChange={setTargetMeal} label="Eaten at" compact />; })()}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="v2-press" onClick={() => onDelete && onDelete()} aria-label="Delete from log" style={{ width: 56, height: 56, borderRadius: 'var(--radius-pill)', border: 'none', background: '#FEECEC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
              </button>
              <button className="v2-press" onClick={() => onSave && onSave({ amount: Math.round(grams), unit: 'g', time: targetMeal })} disabled={!grams} style={{ flex: 1, height: 56, borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: '#fff', boxShadow: 'var(--glow-lime)', font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', cursor: grams ? 'pointer' : 'default', opacity: grams ? 1 : 0.5 }}>
                Save changes · {kcal} kcal
              </button>
            </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              {(() => { const W = window.NoraTime.WhenPicker; return <W value={targetMeal} onChange={setTargetMeal} label="Eaten at" compact />; })()}
              <button className="v2-press" onClick={() => onAdd && onAdd({ time: targetMeal, amount: Math.round(grams), unit: 'g' })} disabled={!grams} style={{
                width: '100%', height: 56, borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: '#fff', boxShadow: 'var(--glow-lime)',
                font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', cursor: grams ? 'pointer' : 'default', opacity: grams ? 1 : 0.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}>
                Add to Log
                <span style={{ padding: '5px 10px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 13 }}>{kcal} kcal</span>
              </button>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
  const host = document.getElementById('nora-overlay');
  return host ? ReactDOM.createPortal(screen, host) : screen;
}

window.FoodDetailsV3 = FoodDetails;
