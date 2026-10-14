/* Log page (v3) — a complete, implementation-ready food diary.
   Single local state object per day; every mutation goes through the helpers at the top so a real
   backend can replace them without touching the UI. */
const { GlassCard, FoodIcon, MacroBar } = window.NoraDesignSystem_a9ff6f;

const TARGETS = { kcal: 2000, protein: 150, carbs: 220, fat: 70 };
const UNITS = [
  { label: 'g', grams: 1 }, { label: 'oz', grams: 28.35 }, { label: 'slice', grams: 30 },
  { label: 'piece', grams: 50 }, { label: 'cup', grams: 150 }, { label: 'serving', grams: 100 },
];
const toGrams = (amount, unit) => amount * ((UNITS.find(u => u.label === unit) || UNITS[0]).grams);
// per-100g reference data — swap for an API-backed food database.
const FOOD_DB = [
  { id: 'yogurt', name: 'Greek Yogurt', per100: { kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 } },
  { id: 'banana', name: 'Banana', per100: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 } },
  { id: 'almonds', name: 'Almonds', per100: { kcal: 579, protein: 21, carbs: 22, fat: 50 } },
  { id: 'chicken', name: 'Chicken Breast', per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 } },
  { id: 'rice', name: 'Rice', per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
  { id: 'salad', name: 'Salad', per100: { kcal: 60, protein: 1.4, carbs: 6.5, fat: 2.7 } },
  { id: 'salmon', name: 'Salmon', per100: { kcal: 208, protein: 20, carbs: 0, fat: 13 } },
  { id: 'broccoli', name: 'Vegetables', per100: { kcal: 50, protein: 2, carbs: 9, fat: 0.5 } },
  { id: 'apple', name: 'Apple', per100: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 } },
  { id: 'oats', name: 'Oatmeal', per100: { kcal: 68, protein: 2.4, carbs: 12, fat: 1.4 } },
  { id: 'egg', name: 'Egg', per100: { kcal: 155, protein: 13, carbs: 1.1, fat: 11 } },
  { id: 'coffee', name: 'Coffee', per100: { kcal: 1, protein: 0.1, carbs: 0, fat: 0 } },
  { id: 'chocolate', name: 'Dark Chocolate', per100: { kcal: 598, protein: 7.8, carbs: 45.9, fat: 42.6 } },
  { id: 'wine', name: 'Red Wine', per100: { kcal: 85, protein: 0.1, carbs: 2.6, fat: 0 } },
  { id: 'oliveoil', name: 'Olive Oil', per100: { kcal: 884, protein: 0, carbs: 0, fat: 100 } },
  { id: 'garlic', name: 'Garlic', per100: { kcal: 149, protein: 6.4, carbs: 33, fat: 0.5 } },
  { id: 'onion', name: 'Onion', per100: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 } },
  { id: 'tomato', name: 'Tomato', per100: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 } },
  { id: 'spinach', name: 'Spinach', per100: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 } },
  { id: 'potato', name: 'Potato', per100: { kcal: 77, protein: 2, carbs: 17, fat: 0.1 } },
  { id: 'pasta', name: 'Pasta', per100: { kcal: 158, protein: 5.8, carbs: 31, fat: 0.9 } },
  { id: 'lemon', name: 'Lemon', per100: { kcal: 29, protein: 1.1, carbs: 9.3, fat: 0.3 } },
  { id: 'parmesan', name: 'Parmesan Cheese', per100: { kcal: 431, protein: 38, carbs: 4.1, fat: 29 } },
  { id: 'butter', name: 'Butter', per100: { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 } },
  { id: 'pepper', name: 'Bell Pepper', per100: { kcal: 31, protein: 1, carbs: 6, fat: 0.3 } },
  { id: 'milk', name: 'Milk', per100: { kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 } },
];
// Saved recipes — swap for the user's recipe collection endpoint.
const RECIPES = [
  { id: 'r1', name: 'Chicken & Rice Bowl', servings: 2, items: [{ id: 'chicken', amount: 300, unit: 'g' }, { id: 'rice', amount: 360, unit: 'g' }, { id: 'broccoli', amount: 200, unit: 'g' }, { id: 'oliveoil', amount: 10, unit: 'g' }] },
  { id: 'r2', name: 'Yogurt Berry Bowl', servings: 1, items: [{ id: 'yogurt', amount: 200, unit: 'g' }, { id: 'banana', amount: 1, unit: 'piece' }, { id: 'almonds', amount: 20, unit: 'g' }] },
  { id: 'r3', name: 'Salmon Dinner', servings: 2, source: 'bbcgoodfood.com', items: [{ id: 'salmon', amount: 280, unit: 'g' }, { id: 'potato', amount: 300, unit: 'g' }, { id: 'broccoli', amount: 200, unit: 'g' }] },
];
// Barcode → product lookup, mocked. Swap for a real barcode/product API.
const BARCODES = [
  { code: '5901234123457', name: 'Greek Yogurt 0%', per100: { kcal: 57, protein: 10, carbs: 4, fat: 0.2 }, amount: 170, unit: 'g' },
  { code: '4006381333931', name: 'Protein Bar', per100: { kcal: 350, protein: 30, carbs: 32, fat: 9 }, amount: 60, unit: 'g' },
];
const entryMacros = (e) => {
  const f = toGrams(e.amount, e.unit) / 100;
  return { kcal: Math.round(e.per100.kcal * f), protein: Math.round(e.per100.protein * f), carbs: Math.round(e.per100.carbs * f), fat: Math.round(e.per100.fat * f) };
};
window.NoraLogData = { FOOD_DB, UNITS, toGrams, entryMacros };
// The day is one timeline — every entry carries the time it was eaten (24h "HH:MM").
const seed = () => [
  { uid: 1, ...FOOD_DB[0], amount: 150, unit: 'g', time: '08:10' },
  { uid: 2, ...FOOD_DB[1], amount: 1, unit: 'piece', time: '08:12' },
  { uid: 6, ...FOOD_DB[2], amount: 20, unit: 'g', time: '10:45' },
  { uid: 3, ...FOOD_DB[3], amount: 150, unit: 'g', time: '13:05' },
  { uid: 4, ...FOOD_DB[4], amount: 180, unit: 'g', time: '13:06' },
  { uid: 5, ...FOOD_DB[6], amount: 120, unit: 'g', time: '19:20' },
];
const byTime = (a, b) => window.NoraTime.toMin(a.time) - window.NoraTime.toMin(b.time) || a.uid - b.uid;
// Entries eaten within 30 min of each other form one eating moment on the timeline.
const groupMoments = (list) => {
  const out = [];
  [...list].sort(byTime).forEach(e => {
    const last = out[out.length - 1], t = window.NoraTime.toMin(e.time);
    if (last && t - last.end <= 30) { last.items.push(e); last.end = t; }
    else out.push({ start: t, end: t, time: e.time, items: [e] });
  });
  return out;
};

function Stat({ value, label, color }) {
  return (
    <div>
      <div style={{ font: 'var(--weight-extrabold) var(--text-h2)/1 var(--font-sans)', color: color || 'var(--text-primary)', letterSpacing: 'var(--track-tight)' }}>{value}</div>
      <div style={{ font: 'var(--weight-bold) 9px/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase', marginTop: 5 }}>{label}</div>
    </div>
  );
}

function AmountField({ amount, unit, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input type="number" min="0" value={amount} onChange={(e) => onChange({ amount: Number(e.target.value), unit })}
        style={{ width: 88, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--ink-900)', font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)', outline: 'none' }} />
      <select value={unit} onChange={(e) => onChange({ amount, unit: e.target.value })}
        style={{ flex: 1, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--ink-900)', font: 'var(--weight-semibold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)', outline: 'none' }}>
        {UNITS.map(u => <option key={u.label} value={u.label}>{u.label}</option>)}
      </select>
    </div>
  );
}

function Sheet({ children, onClose }) {
  return (
    <div className="n-fade" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.34)', display: 'flex', alignItems: 'flex-end', zIndex: 40 }}>
      <div className="n-sheet" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '88%', overflowY: 'auto', background: 'var(--bg-surface-solid)', borderRadius: '24px 24px 0 0', padding: '10px 22px 30px', boxShadow: 'var(--shadow-3)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 'var(--radius-pill)', background: 'var(--border-strong)', margin: '0 auto 18px' }} />
        {children}
      </div>
    </div>
  );
}

function MealPicker({ value, onChange }) {
  const W = window.NoraTime.WhenPicker;
  return <W value={value} onChange={onChange} />;
}

function BarcodeScanner({ meal, onMeal, onAdd }) {
  const [phase, setPhase] = React.useState('scanning'); // scanning | found | manual
  const [code, setCode] = React.useState('');
  const [product, setProduct] = React.useState(null);
  React.useEffect(() => {
    if (phase !== 'scanning') return;
    const t = setTimeout(() => { setProduct(BARCODES[0]); setPhase('found'); }, 1600);
    return () => clearTimeout(t);
  }, [phase]);
  const lookup = () => {
    const hit = BARCODES.find(b => b.code === code.trim());
    if (hit) { setProduct(hit); setPhase('found'); }
    else { setProduct(null); setPhase('notfound'); }
  };
  return (
    <div>
      <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)', marginBottom: 4 }}>Scan barcode</div>
      <div style={{ font: 'var(--weight-medium) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginBottom: 16 }}>Point your camera at the product barcode</div>
      <div style={{ position: 'relative', height: 168, borderRadius: 'var(--radius-lg)', background: '#111827', overflow: 'hidden', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 200, height: 104, border: '2.5px solid rgba(255,255,255,0.75)', borderRadius: 12, position: 'relative' }}>
          {phase === 'scanning' && <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'var(--lime-400)', boxShadow: '0 0 12px 2px var(--lime-400)' }} />}
        </div>
        <span style={{ position: 'absolute', bottom: 12, font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'rgba(255,255,255,0.8)' }}>
          {phase === 'scanning' ? 'Scanning…' : phase === 'found' ? 'Product found' : 'No match'}
        </span>
      </div>
      {phase === 'found' && product && (
        <React.Fragment>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
            <FoodIcon name={product.name} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ font: 'var(--weight-bold) var(--text-body)/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{product.name}</div>
              <div style={{ font: 'var(--weight-medium) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 3 }}>{product.code} · {product.per100.kcal} kcal/100g</div>
            </div>
          </div>
          <MealPicker value={meal} onChange={onMeal} />
          <button className="v2-press" onClick={() => onAdd(product)} style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: 'var(--text-onbrand)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer', boxShadow: 'var(--glow-lime)' }}>Add {product.amount}{product.unit} at {meal}</button>
        </React.Fragment>
      )}
      {(phase === 'notfound' || phase === 'manual') && (
        <div style={{ font: 'var(--weight-medium) var(--text-small)/1.4 var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 12 }}>That barcode isn't in the database yet — enter it manually or create a custom food.</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter barcode number"
          style={{ flex: 1, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--ink-900)', font: 'var(--weight-medium) var(--text-small)/1 var(--font-sans)', color: 'var(--text-primary)', outline: 'none' }} />
        <button className="v2-press" onClick={lookup} style={{ padding: '12px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-primary)', cursor: 'pointer' }}>Look up</button>
      </div>
    </div>
  );
}

function RecipesPanel({ recipes, onOpen, onView }) {
  const opt = (start, title, sub, icon, tint, ink) => (
    <button className="v2-row" onClick={() => onOpen(null, start)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, minHeight: 64, padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 40, height: 40, borderRadius: 13, background: tint, color: ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: 'var(--weight-bold) var(--text-body)/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ display: 'block', font: 'var(--weight-medium) var(--text-micro)/1.35 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 3 }}>{sub}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  );
  return (
    <div>
      <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)' }}>Recipes</div>
      <div style={{ font: 'var(--weight-medium) var(--text-small)/1.4 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 6, marginBottom: 18 }}>Build a meal from its ingredients or import one. Saved recipes log like any food.</div>
      <div style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase', marginBottom: 10 }}>Create</div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 22 }}>
        {opt('scratch', 'Build from ingredients', 'Search and add each ingredient', <path d="M12 5v14M5 12h14" />, 'rgba(99,102,241,0.10)', 'var(--lime-500)')}
        {opt('photo', 'Import from photo', 'Recipe card, cookbook page or plate', <><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 9 4h6a1 1 0 0 1 .9.6L16.8 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>, 'rgba(245,158,11,0.12)', '#B45309')}
        {opt('link', 'Import from link', 'Paste a recipe from any website', <><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></>, 'rgba(34,197,94,0.12)', '#15803D')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase' }}>Your recipes</span>
        <span style={{ font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>{recipes.length}</span>
      </div>
      {recipes.length === 0 ? (
        <div style={{ padding: '22px 16px', textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-lg)', font: 'var(--weight-medium) var(--text-small)/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>Recipes you save appear here, ready to log in one tap.</div>
      ) : (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {recipes.map((r, i) => {
            const t = window.NoraRecipeTotals(r.items);
            const per = Math.round(t.kcal / (r.servings || 1));
            const first = FOOD_DB.find(f => f.id === (r.items[0] || {}).id);
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center' }}>
              <button className="v2-row" onClick={() => onView(r)} aria-label={'Open ' + r.name} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, minHeight: 72, padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: i < recipes.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <FoodIcon name={first ? first.name : r.name} size={44} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', font: 'var(--weight-bold) var(--text-body)/1.25 var(--font-sans)', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{r.name}</span>
                  <span style={{ display: 'block', font: 'var(--weight-medium) var(--text-micro)/1.35 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 4 }}>{r.items.length} ingredients · {r.servings} {r.servings === 1 ? 'serving' : 'servings'}{r.source ? ' · ' + r.source : ''}</span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ display: 'block', font: 'var(--weight-extrabold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{per}</span>
                  <span style={{ display: 'block', font: 'var(--weight-medium) 10px/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 4 }}>kcal/serving</span>
                </span>
              </button>
              <button className="v2-press" onClick={() => onOpen(r)} aria-label={'Edit ' + r.name} style={{ width: 48, height: 48, marginRight: 6, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
              </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomFoodForm({ meal, onMeal, onSave }) {
  const [form, setForm] = React.useState({ name: '', amount: 100, unit: 'g', kcal: '', protein: '', carbs: '', fat: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.name.trim() && Number(form.kcal) > 0;
  const field = (label, key, suffix) => (
    <div style={{ flex: 1 }}>
      <div style={{ font: 'var(--weight-semibold) 10px/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <input type="number" min="0" value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder="0"
        style={{ width: '100%', padding: '11px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--ink-900)', font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)', outline: 'none' }} />
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <FoodIcon name={form.name} generic={!form.name.trim()} size={56} />
        <div>
          <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)', marginBottom: 6 }}>Custom food</div>
          <div style={{ font: 'var(--weight-medium) var(--text-small)/1.3 var(--font-sans)', color: 'var(--text-tertiary)' }}>Enter the values from the label, per the serving below</div>
        </div>
      </div>
      <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Food name"
        style={{ width: '100%', padding: '13px 15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--ink-900)', font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)', outline: 'none', marginBottom: 14 }} />
      <div style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase', marginBottom: 8 }}>Serving</div>
      <div style={{ marginBottom: 14 }}>
        <AmountField amount={form.amount} unit={form.unit} onChange={(q) => setForm(f => ({ ...f, ...q }))} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>{field('Kcal', 'kcal')}{field('Protein', 'protein')}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>{field('Carbs', 'carbs')}{field('Fat', 'fat')}</div>
      <MealPicker value={meal} onChange={onMeal} />
      <button className="v2-press" disabled={!valid} onClick={() => onSave(form)} style={{
        width: '100%', padding: '14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: 'var(--text-onbrand)',
        font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: valid ? 'pointer' : 'default', opacity: valid ? 1 : 0.5
      }}>Save food & add at {meal}</button>
    </div>
  );
}

function PhotoEstimatePanel({ meal, onMeal, onAdd }) {
  const [phase, setPhase] = React.useState('capture'); // capture | analyzing | result
  const [items, setItems] = React.useState([]);
  const analyze = () => {
    setPhase('analyzing');
    setTimeout(() => {
      // Mocked vision estimate — swap for the meal-recognition endpoint.
      setItems([
        { id: 'chicken', name: 'Chicken Breast', per100: FOOD_DB.find(f => f.id === 'chicken').per100, amount: 140, unit: 'g', confidence: 0.92, on: true },
        { id: 'rice', name: 'Rice', per100: FOOD_DB.find(f => f.id === 'rice').per100, amount: 160, unit: 'g', confidence: 0.87, on: true },
        { id: 'broccoli', name: 'Vegetables', per100: FOOD_DB.find(f => f.id === 'broccoli').per100, amount: 90, unit: 'g', confidence: 0.64, on: true },
      ]);
      setPhase('result');
    }, 1700);
  };
  const toggle = (id) => setItems(list => list.map(i => i.id === id ? { ...i, on: !i.on } : i));
  const setAmount = (id, amount) => setItems(list => list.map(i => i.id === id ? { ...i, amount } : i));
  const chosen = items.filter(i => i.on);
  const totals = chosen.reduce((a, i) => {
    const m = entryMacros(i);
    return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  return (
    <div>
      <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)', marginBottom: 4 }}>Photo estimate</div>
      <div style={{ font: 'var(--weight-medium) var(--text-small)/1.4 var(--font-sans)', color: 'var(--text-tertiary)', marginBottom: 16 }}>
        {phase === 'result' ? 'Nora’s estimate — check the amounts before saving' : 'Snap your plate and Nora estimates what’s on it'}
      </div>
      <div style={{ position: 'relative', height: 170, borderRadius: 'var(--radius-lg)', background: '#111827', overflow: 'hidden', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'capture' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.85)' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 9 4h6a1 1 0 0 1 .9.6L16.8 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></svg>
            <span style={{ font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)' }}>Center the whole plate in frame</span>
          </div>
        )}
        {phase === 'analyzing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#fff' }}>
            <svg className="n-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--lime-400)" strokeWidth="2.6" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
            <span style={{ font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'rgba(255,255,255,0.85)' }}>Analyzing your plate…</span>
          </div>
        )}
        {phase === 'result' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {chosen.slice(0, 3).map(i => <FoodIcon key={i.id} name={i.name} size={52} />)}
          </div>
        )}
      </div>
      {phase === 'capture' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="v2-press" onClick={analyze} style={{ flex: 1, padding: '14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: 'var(--text-onbrand)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer', boxShadow: 'var(--glow-lime)' }}>Take photo</button>
          <button className="v2-press" onClick={analyze} style={{ padding: '14px 18px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)', color: 'var(--text-primary)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer' }}>Upload</button>
        </div>
      )}
      {phase === 'result' && (
        <React.Fragment>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', marginBottom: 14 }}>
            {items.map((i, idx) => {
              const m = entryMacros(i);
              const low = i.confidence < 0.7;
              return (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: i.on ? 1 : 0.5 }}>
                  <button className="v2-press" onClick={() => toggle(i.id)} aria-label={i.on ? 'Exclude' : 'Include'} style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    border: i.on ? 'none' : '2px solid var(--border-strong)', background: i.on ? 'var(--violet-500)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                  }}>
                    {i.on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                  </button>
                  <FoodIcon name={i.name} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: 'var(--weight-bold) var(--text-small)/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{i.name}</div>
                    <div style={{ font: 'var(--weight-semibold) 10px/1 var(--font-sans)', color: low ? 'var(--apricot-500)' : 'var(--text-tertiary)', marginTop: 4 }}>
                      {low ? 'Low confidence — check this' : `${Math.round(i.confidence * 100)}% confident`} · {m.kcal} kcal
                    </div>
                  </div>
                  <input type="number" min="0" value={i.amount} onChange={(e) => setAmount(i.id, Number(e.target.value))}
                    style={{ width: 62, padding: '8px 9px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--ink-900)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-primary)', outline: 'none', flexShrink: 0 }} />
                  <span style={{ font: 'var(--weight-semibold) 10px/1 var(--font-sans)', color: 'var(--text-tertiary)', flexShrink: 0 }}>{i.unit}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(34,197,94,0.10)', borderRadius: 'var(--radius-md)', marginBottom: 14 }}>
            <span style={{ font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{totals.kcal} kcal</span>
            <span style={{ font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-secondary)' }}>{chosen.length} items · P{totals.protein} C{totals.carbs} F{totals.fat}</span>
          </div>
          <MealPicker value={meal} onChange={onMeal} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="v2-press" disabled={!chosen.length} onClick={() => onAdd(chosen)} style={{
              flex: 1, padding: '14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: 'var(--text-onbrand)',
              font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: chosen.length ? 'pointer' : 'default', opacity: chosen.length ? 1 : 0.5, boxShadow: 'var(--glow-lime)'
            }}>Confirm & add at {meal}</button>
            <button className="v2-press" onClick={() => { setItems([]); setPhase('capture'); }} style={{ padding: '14px 18px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)', color: 'var(--text-primary)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer' }}>Retake</button>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function LogPage({ onNotify }) {
  const [dayOffset, setDayOffset] = React.useState(0);
  const [showNight, setShowNight] = React.useState(false);
  const [entries, setEntries] = React.useState(seed);
  const [water, setWater] = React.useState(5);
  const [detail, setDetail] = React.useState(null);   // { entry } → full-screen details (edit)
  const [foodView, setFoodView] = React.useState(null); // { food, time } → full-screen details (add)
  const [adding, setAdding] = React.useState(null);   // "HH:MM" → full-screen search, logging at that time
  const [recipes, setRecipes] = React.useState(RECIPES);
  const [studio, setStudio] = React.useState(null); // { recipe, start } → full-screen Recipe Studio
  const [mode, setMode] = React.useState(null);       // 'photo' | 'scan' | 'recipes' | 'custom'
  const [targetMeal, setTargetMeal] = React.useState(() => window.NoraTime.nowHHMM()); // time for photo/scan/recipe/custom
  const [nowTick, setNowTick] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => setNowTick(t => t + 1), 60000); return () => clearInterval(id); }, []);
  const [query, setQuery] = React.useState('');

  const dayLabel = React.useMemo(() => {
    const d = new Date(2026, 7, 11 + dayOffset);
    if (dayOffset === 0) return 'Today';
    if (dayOffset === -1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }, [dayOffset]);
  const dateLabel = new Date(2026, 7, 11 + dayOffset).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const totals = React.useMemo(() => Object.values(entries).flat().reduce((a, e) => {
    const m = entryMacros(e);
    return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [entries]);
  const remaining = Math.max(0, TARGETS.kcal - totals.kcal);
  // Every tracked nutrient for the day, so Food Details can show eaten → +this food → target for each.
  const dayNutrients = React.useMemo(() => {
    const NN = window.NoraNutrition, out = { ...totals };
    if (!NN) return out;
    for (const e of Object.values(entries).flat()) {
      const p = NN.profileFor(e.id, toGrams(e.amount, e.unit), e.per100);
      for (const k in p) if (!(k in totals)) out[k] = (out[k] || 0) + p[k];
    }
    return out;
  }, [entries, totals]);
  const dayExcept = (e) => {
    const NN = window.NoraNutrition, out = { ...dayNutrients }, m = entryMacros(e);
    out.kcal -= m.kcal; out.protein -= m.protein; out.carbs -= m.carbs; out.fat -= m.fat;
    if (NN) { const p = NN.profileFor(e.id, toGrams(e.amount, e.unit), e.per100); for (const k in p) if (!(k in totals)) out[k] = Math.max(0, (out[k] || 0) - p[k]); }
    return out;
  };
  const pct = Math.min(100, (totals.kcal / TARGETS.kcal) * 100);
  const over = totals.kcal > TARGETS.kcal;

  const push = (list) => setEntries(st => [...st, ...list].sort(byTime));
  const addEntry = (time, food, amount = 100, unit = 'g') => {
    push([{ uid: Date.now(), ...food, amount, unit, time }]);
    setAdding(null); setQuery('');
    onNotify && onNotify('success', `${food.name} logged at ${time}.`);
  };
  // Quick-add from search: logs the default serving and keeps search open for the next item.
  const quickAdd = (time, food, grams) => {
    push([{ uid: Date.now(), ...food, amount: grams, unit: 'g', time }]);
    onNotify && onNotify('success', `${food.name} logged at ${time}.`);
  };
  const updateEntry = (uid, patch) => setEntries(st => st.map(e => e.uid === uid ? { ...e, ...patch } : e).sort(byTime));
  const removeEntry = (uid, name) => {
    setEntries(st => st.filter(e => e.uid !== uid));
    setDetail(null);
    onNotify && onNotify('info', `${name} removed.`);
  };

  const saveRecipe = (r) => {
    const id = r.id || 'r' + Date.now();
    const rec = { ...r, id };
    setRecipes(list => list.some(x => x.id === id) ? list.map(x => x.id === id ? rec : x) : [rec, ...list]);
    return rec;
  };
  // Logs the recipe as one entry: per-100 g density of the whole dish × grams eaten.
  // A saved recipe is a food: full per-100 g profile + "1 serving" / "whole recipe" servings.
  const logRecipe = (r, servingsEaten) => {
    const rec = saveRecipe(r);
    const food = window.NoraRecipeFood(rec);
    const grams = Math.round(window.NoraNutrition.SERVINGS[food.id][0][1] * servingsEaten);
    const time = targetMeal || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    push([{ uid: Date.now(), id: food.id, name: food.name, per100: food.per100, amount: grams, unit: 'g', time }]);
    setStudio(null);
    onNotify && onNotify('success', `${rec.name} logged at ${time} — ${Math.round(food.per100.kcal * grams / 100)} kcal.`);
  };
  const viewRecipe = (r, save) => {
    const rec = save ? saveRecipe(r) : r;
    setStudio(null); setMode(null);
    setFoodView({ food: window.NoraRecipeFood(rec), time: targetMeal });
  };
  const recipeFoods = React.useMemo(() => recipes.map(r => window.NoraRecipeFood(r)), [recipes]);
  const addScanned = (product) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    push([{ uid: Date.now(), id: product.code, name: product.name, per100: product.per100, amount: product.amount, unit: product.unit, time }]);
    setMode(null);
    onNotify && onNotify('success', `${product.name} logged at ${targetMeal}.`);
  };
  const addPhotoItems = (list) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const added = list.map((i, n) => ({ uid: Date.now() + n, id: i.id, name: i.name, per100: i.per100, amount: i.amount, unit: i.unit, time }));
    push(added);
    setMode(null);
    const kcal = added.reduce((a, e) => a + entryMacros(e).kcal, 0);
    onNotify && onNotify('success', `${added.length} items logged at ${targetMeal} — ${kcal} kcal.`);
  };
  const saveCustom = (form) => {
    const grams = toGrams(Number(form.amount) || 100, form.unit) || 100;
    const scale = 100 / grams;
    const per100 = {
      kcal: Math.round((Number(form.kcal) || 0) * scale), protein: Math.round((Number(form.protein) || 0) * scale),
      carbs: Math.round((Number(form.carbs) || 0) * scale), fat: Math.round((Number(form.fat) || 0) * scale),
    };
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    push([{ uid: Date.now(), id: 'custom-' + Date.now(), name: form.name.trim(), per100, amount: Number(form.amount) || 100, unit: form.unit, time }]);
    setMode(null);
    onNotify && onNotify('success', `${form.name.trim()} saved to your foods.`);
  };

  const results = query.trim() ? FOOD_DB.filter(f => f.name.toLowerCase().includes(query.trim().toLowerCase())) : [];

  return (
    <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
      {/* Date navigation */}
      <div className="v2-rise" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="v2-press" onClick={() => setDayOffset(o => o - 1)} aria-label="Previous day" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-solid)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: 'var(--track-tight)' }}>{dayLabel}</div>
          <div style={{ font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 5 }}>{dateLabel}</div>
        </div>
        <button className="v2-press" onClick={() => setDayOffset(o => o + 1)} aria-label="Next day" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-solid)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* Calorie + macro summary */}
      <GlassCard className="v2-rise v2-d1" padding={18}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ font: 'var(--weight-extrabold) var(--text-display-2)/1 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: 'var(--track-tight)' }}>{totals.kcal.toLocaleString()}</span>
              <span style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>/ {TARGETS.kcal.toLocaleString()} kcal</span>
            </div>
            <div style={{ font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: over ? 'var(--rose-500)' : 'var(--violet-500)', marginTop: 6 }}>
              {over ? `${(totals.kcal - TARGETS.kcal).toLocaleString()} kcal over` : `${remaining.toLocaleString()} kcal remaining`}
            </div>
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 'var(--radius-pill)', background: 'var(--track-empty)', overflow: 'hidden' }}>
          <div className="n-bar" style={{ width: pct + '%', height: '100%', borderRadius: 'var(--radius-pill)', background: over ? 'var(--rose-500)' : 'var(--grad-violet)' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <MacroBar tone="protein" label="Protein" current={totals.protein} target={TARGETS.protein} unit="g" />
          <MacroBar tone="carbs" label="Carbs" current={totals.carbs} target={TARGETS.carbs} unit="g" />
          <MacroBar tone="fat" label="Fat" current={totals.fat} target={TARGETS.fat} unit="g" />
        </div>
      </GlassCard>


      {/* Timeline — hour-by-hour day view. Every hour is a row; tap any hour to log at that time. */}
      {(() => {
        const T = window.NoraTime;
        const list = [...entries].sort(byTime);
        const moments = groupMoments(entries);
        const nowMin = T.toMin(T.nowHHMM());
        const isToday = dayOffset === 0;
        const nowH = Math.floor(nowMin / 60);
        const past = isToday ? list.filter(e => T.toMin(e.time) <= nowMin) : list;
        const lastE = past[past.length - 1];
        const sinceLast = isToday && lastE ? Math.max(0, nowMin - T.toMin(lastE.time)) : null;
        const hourOf = (e) => Math.floor(T.toMin(e.time) / 60);
        const firstH = list.length ? hourOf(list[0]) : 24;
        const DAY_START = 6;
        const start = showNight ? 0 : Math.min(DAY_START, firstH, isToday ? nowH : 24);
        const hours = Array.from({ length: 24 - start }, (_, i) => start + i);
        const hh = (h) => String(h).padStart(2, '0') + ':00';
        const COL = 64;
        const num = { fontVariantNumeric: 'tabular-nums' };

        const row = (e) => {
          const m = entryMacros(e);
          const later = isToday && T.toMin(e.time) > nowMin;
          return (
            <div key={e.uid} className="v2-row" role="button" tabIndex={0} onClick={() => setDetail({ entry: e })} onKeyDown={(ev) => ev.key === 'Enter' && setDetail({ entry: e })}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', minHeight: 58, cursor: 'pointer', opacity: later ? 0.6 : 1 }}>
              <FoodIcon name={e.name} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: 'var(--weight-bold) var(--text-body)/1.25 var(--font-sans)', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{e.name}</div>
                <div style={{ font: 'var(--weight-medium) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 4, ...num }}>{e.time} · {e.amount} {e.unit}{later ? ' · planned' : ''}</div>
              </div>
              <span style={{ flexShrink: 0, textAlign: 'right', ...num }}>
                <span style={{ font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{m.kcal}</span>
                <span style={{ font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginLeft: 3 }}>kcal</span>
              </span>
            </div>
          );
        };
        const nowLine = (
          <button key="now" className="v2-press" onClick={() => setAdding(T.nowHHMM())} aria-label={'Log food now, ' + T.nowHHMM()}
            style={{ width: '100%', minHeight: 44, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 0 0' }}>
            <span style={{ position: 'relative', flex: 1, height: 2, borderRadius: 1, background: 'var(--lime-500)' }}>
              <span className="v2-pulse" style={{ position: 'absolute', left: -6, top: -5, width: 12, height: 12, borderRadius: '50%', background: 'var(--lime-500)', border: '2px solid var(--bg-surface-solid)' }} />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 'var(--radius-pill)', background: 'var(--lime-500)', color: '#fff', font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', whiteSpace: 'nowrap', ...num }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Now · {T.nowHHMM()}
            </span>
          </button>
        );

        return (
          <div className="v2-rise v2-d3">
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, margin: '0 2px 12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: 'var(--weight-bold) var(--text-h2)/1 var(--font-sans)', color: 'var(--text-primary)' }}>Timeline</div>
                <div style={{ font: 'var(--weight-medium) var(--text-small)/1.3 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 5 }}>
                  {list.length ? moments.length + (moments.length === 1 ? ' time' : ' times') + ' eaten' : 'Tap any hour to log what you ate then'}
                </div>
              </div>
              {sinceLast != null && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ font: 'var(--weight-bold) 10px/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase' }}>Last ate</div>
                  <div style={{ font: 'var(--weight-extrabold) var(--text-body)/1 var(--font-sans)', color: 'var(--lime-500)', marginTop: 5, ...num }}>{T.fmtDur(sinceLast)} ago</div>
                </div>
              )}
            </div>

            <div role="tablist" aria-label="Hours shown" style={{ display: 'flex', gap: 4, padding: 4, marginBottom: 12, borderRadius: 'var(--radius-pill)', background: 'var(--track-empty)' }}>
              {[[false, 'Waking hours', '06:00 – 24:00'], [true, 'Full day', '00:00 – 24:00']].map(([full, label, range]) => {
                const on = showNight === full;
                return (
                  <button key={label} role="tab" aria-selected={on} className="v2-press" onClick={() => setShowNight(full)} style={{
                    flex: 1, minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                    border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)',
                    background: on ? 'var(--bg-surface-solid)' : 'transparent', boxShadow: on ? 'var(--shadow-1)' : 'none',
                    transition: 'background-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)'
                  }}>
                    <span style={{ font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ font: 'var(--weight-medium) 10px/1 var(--font-sans)', color: 'var(--text-tertiary)', ...num }}>{range}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ background: 'var(--bg-surface-solid)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-1)', overflow: 'hidden' }}>
              {hours.map((h, hi) => {
                const items = list.filter(e => hourOf(e) === h);
                const isNowHour = isToday && h === nowH;
                const future = isToday && h > nowH;
                const kcal = items.reduce((acc, e) => acc + entryMacros(e).kcal, 0);
                const before = isNowHour ? items.filter(e => T.toMin(e.time) <= nowMin) : items;
                const after = isNowHour ? items.filter(e => T.toMin(e.time) > nowMin) : [];
                return (
                  <div key={h} style={{ display: 'flex', borderTop: hi ? '1px solid var(--border-subtle)' : 'none', background: isNowHour ? 'rgba(99,102,241,0.04)' : 'transparent' }}>
                    <div style={{ width: COL, flexShrink: 0, padding: '15px 0 10px 16px' }}>
                      <div style={{ font: 'var(--weight-bold) 12px/1 var(--font-sans)', color: isNowHour ? 'var(--lime-500)' : future ? 'var(--text-tertiary)' : 'var(--text-secondary)', ...num }}>{hh(h)}</div>
                      {kcal > 0 && <div style={{ font: 'var(--weight-bold) 10px/1 var(--font-sans)', color: '#15803D', marginTop: 6, ...num }}>{kcal} kcal</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, borderLeft: '1px solid var(--border-subtle)' }}>
                      {items.length === 0 && !isNowHour ? (
                        <button className="v2-row" onClick={() => setAdding(hh(h))} aria-label={'Log food at ' + hh(h)}
                          style={{ width: '100%', minHeight: 48, height: '100%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 12px' }}>
                          <span style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                          </span>
                        </button>
                      ) : (
                        <div style={{ padding: '4px 0' }}>
                          {before.map(row)}
                          {isNowHour && nowLine}
                          {after.map(row)}
                          {items.length > 0 && !isNowHour && (
                            <button className="v2-row" onClick={() => setAdding(T.fromMin(Math.max(...items.map(e => T.toMin(e.time)))))}
                              style={{ width: '100%', minHeight: 40, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', border: 'none', background: 'none', cursor: 'pointer', font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--lime-500)', textAlign: 'left' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                              <span>{'Add at ' + hh(h)}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}


      {/* Food details — full-screen nutrition screen (mobile). Edit an entry or add a searched food. */}
      {detail && (() => {
        const e = entries.find(x => x.uid === detail.entry.uid) || detail.entry;
        return (
          <FoodDetailsV3 key={'edit' + e.uid} mode="edit" food={e} meal={e.time} initialGrams={toGrams(e.amount, e.unit)}
            targets={TARGETS} consumed={dayExcept(e)}
            onClose={() => setDetail(null)}
            onSave={(q) => { updateEntry(e.uid, q); setDetail(null); onNotify && onNotify('success', `${e.name} updated.`); }}
            onDelete={() => removeEntry(e.uid, e.name)} />
        );
      })()}
      {foodView && (
        <FoodDetailsV3 key={'add' + foodView.food.id} mode="add" food={foodView.food} meal={foodView.time}
          targets={TARGETS} consumed={dayNutrients}
          onClose={() => setFoodView(null)}
          onAdd={({ time, amount, unit }) => { addEntry(time, foodView.food, amount, unit); setFoodView(null); }} />
      )}

      {/* Photo estimate / barcode scan / recipes / custom food */}
      {mode === 'photo' && (
        <Sheet onClose={() => setMode(null)}>
          <PhotoEstimatePanel meal={targetMeal} onMeal={setTargetMeal} onAdd={addPhotoItems} />
        </Sheet>
      )}
      {mode === 'scan' && (
        <Sheet onClose={() => setMode(null)}>
          <BarcodeScanner meal={targetMeal} onMeal={setTargetMeal} onAdd={addScanned} />
        </Sheet>
      )}
      {mode === 'recipes' && (
        <Sheet onClose={() => setMode(null)}>
          <RecipesPanel recipes={recipes} onView={(r) => viewRecipe(r, false)} onOpen={(recipe, start) => { setMode(null); setStudio({ recipe: recipe || null, start: start || null }); }} />
        </Sheet>
      )}
      {studio && (
        <RecipeStudioV3 key={(studio.recipe && studio.recipe.id) || 'new-' + studio.start} initial={studio.recipe} start={studio.start}
          whenPicker={<MealPicker value={targetMeal} onChange={setTargetMeal} />}
          onClose={() => setStudio(null)}
          onSave={(r) => { const rec = saveRecipe(r); setStudio(null); onNotify && onNotify('success', `"${rec.name}" saved to your recipes.`); }}
          onLog={logRecipe}
          onDetails={(r) => viewRecipe(r, true)} />
      )}
      {mode === 'custom' && (
        <Sheet onClose={() => setMode(null)}>
          <CustomFoodForm meal={targetMeal} onMeal={setTargetMeal} onSave={saveCustom} />
        </Sheet>
      )}

      {/* Add food — full-screen search */}
      {adding && (
        <FoodSearchV3 meal={adding} foods={[...recipeFoods, ...FOOD_DB]} entries={entries} remainingKcal={TARGETS.kcal - totals.kcal}
          onMealChange={setAdding}
          onOpenFood={(f) => setFoodView({ food: f, time: adding })}
          onQuickAdd={(f, grams) => quickAdd(adding, f, grams)}
          onMode={(m) => { setTargetMeal(adding); setAdding(null); setQuery(''); setMode(m); }}
          onClose={() => { setAdding(null); setQuery(''); }} />
      )}
      {/* Sticky primary action — always reachable above the nav while the timeline scrolls */}
      <div style={{ position: 'sticky', bottom: -14, /* scroll container has 116px bottom padding; sticky offset is measured from its content box → sits ~14px above the nav */ zIndex: 20, margin: '4px -20px 0', padding: '18px 20px 0', background: 'linear-gradient(to bottom, rgba(248,250,252,0) 0%, var(--bg-app) 42%)', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          {/* Single entry point → full-screen food search (photo, barcode, recipes, custom live inside it) */}
          <button className="v2-press" onClick={() => setAdding(window.NoraTime.nowHHMM())} aria-label={'Log food at ' + window.NoraTime.nowHHMM()} style={{
            width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 14, padding: '8px 8px 8px 20px', textAlign: 'left',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', background: 'var(--bg-surface-solid)',
            boxShadow: '0 10px 28px rgba(17,24,39,0.12), 0 2px 6px rgba(17,24,39,0.06)', cursor: 'pointer'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: 'var(--weight-bold) var(--text-body)/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>Log food</span>
              <span style={{ display: 'block', font: 'var(--weight-medium) var(--text-micro)/1.3 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 2 }}>Search, scan or snap a photo</span>
            </span>
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--lime-500)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
window.LogPageV3 = LogPage;
