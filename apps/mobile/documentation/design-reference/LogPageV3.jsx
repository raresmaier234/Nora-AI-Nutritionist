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
  { id: 'coffee', name: 'Coffee', per100: { kcal: 2, protein: 0.1, carbs: 0, fat: 0 } },
];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
// Saved recipes — swap for the user's recipe collection endpoint.
const RECIPES = [
  { id: 'r1', name: 'Chicken & Rice Bowl', items: [['chicken', 150, 'g'], ['rice', 180, 'g'], ['broccoli', 100, 'g']] },
  { id: 'r2', name: 'Yogurt Berry Bowl', items: [['yogurt', 200, 'g'], ['banana', 1, 'piece'], ['almonds', 20, 'g']] },
  { id: 'r3', name: 'Salmon Dinner', items: [['salmon', 140, 'g'], ['broccoli', 200, 'g']] },
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
const seed = () => ({
  Breakfast: [
    { uid: 1, ...FOOD_DB[0], amount: 150, unit: 'g', time: '08:10' },
    { uid: 2, ...FOOD_DB[1], amount: 1, unit: 'piece', time: '08:12' },
  ],
  Lunch: [
    { uid: 3, ...FOOD_DB[3], amount: 150, unit: 'g', time: '13:05' },
    { uid: 4, ...FOOD_DB[4], amount: 180, unit: 'g', time: '13:06' },
  ],
  Dinner: [{ uid: 5, ...FOOD_DB[6], amount: 120, unit: 'g', time: '19:20' }],
  Snacks: [],
});

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
  return (
    <div>
      <div style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase', marginBottom: 8 }}>Add to</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {MEALS.map(m => (
          <button key={m} className="v2-press" onClick={() => onChange(m)} style={{
            flex: 1, padding: '9px 4px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
            border: value === m ? 'none' : '1px solid var(--border-subtle)',
            background: value === m ? 'var(--grad-lime)' : 'var(--ink-900)',
            color: value === m ? 'var(--text-onbrand)' : 'var(--text-secondary)',
            font: 'var(--weight-bold) 10.5px/1 var(--font-sans)'
          }}>{m}</button>
        ))}
      </div>
    </div>
  );
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
          <button className="v2-press" onClick={() => onAdd(product)} style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: 'var(--text-onbrand)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer', boxShadow: 'var(--glow-lime)' }}>Add {product.amount}{product.unit} to {meal}</button>
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

function RecipesPanel({ meal, onMeal, onAddRecipe }) {
  const [tab, setTab] = React.useState('saved');
  const [name, setName] = React.useState('');
  const [picked, setPicked] = React.useState([]);
  const recipeTotals = (items) => items.reduce((a, [id, amount, unit]) => {
    const f = FOOD_DB.find(x => x.id === id); if (!f) return a;
    const m = entryMacros({ ...f, amount, unit });
    return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const draftTotals = recipeTotals(picked);
  return (
    <div>
      <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)', marginBottom: 14 }}>Recipes</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['saved', 'Saved'], ['new', 'Build new']].map(([k, l]) => (
          <button key={k} className="v2-press" onClick={() => setTab(k)} style={{
            flex: 1, padding: '9px 6px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
            border: tab === k ? 'none' : '1px solid var(--border-subtle)',
            background: tab === k ? 'var(--grad-lime)' : 'var(--ink-900)',
            color: tab === k ? 'var(--text-onbrand)' : 'var(--text-secondary)',
            font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)'
          }}>{l}</button>
        ))}
      </div>
      <MealPicker value={meal} onChange={onMeal} />
      {tab === 'saved' ? (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
          {RECIPES.map((r, i) => {
            const t = recipeTotals(r.items);
            return (
              <div key={r.id} className="v2-row" onClick={() => onAddRecipe(r, t)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', borderBottom: i < RECIPES.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime-500)', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.5 6.5 19.5l1-6.3L3 8.9 9 8z" /></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: 'var(--weight-bold) var(--text-body)/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{r.name}</div>
                  <div style={{ font: 'var(--weight-medium) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 3 }}>{r.items.length} ingredients · P{t.protein} C{t.carbs} F{t.fat}</div>
                </div>
                <span style={{ font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{t.kcal} kcal</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name"
            style={{ width: '100%', padding: '13px 15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--ink-900)', font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)', outline: 'none', marginBottom: 12 }} />
          <div style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase', marginBottom: 8 }}>Ingredients ({picked.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {FOOD_DB.slice(0, 8).map(f => {
              const on = picked.some(([id]) => id === f.id);
              return (
                <button key={f.id} className="v2-press" onClick={() => setPicked(p => on ? p.filter(([id]) => id !== f.id) : [...p, [f.id, 100, 'g']])} style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                  border: on ? 'none' : '1px solid var(--border-subtle)', background: on ? 'var(--grad-lime)' : 'var(--ink-900)',
                  color: on ? 'var(--text-onbrand)' : 'var(--text-secondary)', font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)'
                }}>{on ? '✓ ' : '+ '}{f.name}</button>
              );
            })}
          </div>
          {picked.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(34,197,94,0.10)', borderRadius: 'var(--radius-md)', marginBottom: 14 }}>
              <span style={{ font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{draftTotals.kcal} kcal</span>
              <span style={{ font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-secondary)' }}>auto-calculated · P{draftTotals.protein} C{draftTotals.carbs} F{draftTotals.fat}</span>
            </div>
          )}
          <button className="v2-press" disabled={!picked.length} onClick={() => onAddRecipe({ name: name || 'My recipe', items: picked }, draftTotals)} style={{
            width: '100%', padding: '14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: 'var(--text-onbrand)',
            font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: picked.length ? 'pointer' : 'default', opacity: picked.length ? 1 : 0.5
          }}>Save & add to {meal}</button>
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
      <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)', marginBottom: 4 }}>Custom food</div>
      <div style={{ font: 'var(--weight-medium) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginBottom: 16 }}>Enter the values from the label, per the serving below</div>
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
      }}>Save food & add to {meal}</button>
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
            }}>Confirm & add to {meal}</button>
            <button className="v2-press" onClick={() => { setItems([]); setPhase('capture'); }} style={{ padding: '14px 18px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)', color: 'var(--text-primary)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer' }}>Retake</button>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function LogPage({ onNotify }) {
  const [dayOffset, setDayOffset] = React.useState(0);
  const [entries, setEntries] = React.useState(seed);
  const [water, setWater] = React.useState(5);
  const [detail, setDetail] = React.useState(null);   // { meal, entry }
  const [adding, setAdding] = React.useState(null);   // meal name → add-food sheet
  const [mode, setMode] = React.useState(null);       // 'scan' | 'recipes' | 'custom'
  const [targetMeal, setTargetMeal] = React.useState('Breakfast');
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
  const pct = Math.min(100, (totals.kcal / TARGETS.kcal) * 100);
  const over = totals.kcal > TARGETS.kcal;

  const addEntry = (meal, food, amount = 100, unit = 'g') => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    setEntries(s => ({ ...s, [meal]: [...s[meal], { uid: Date.now(), ...food, amount, unit, time }] }));
    setAdding(null); setQuery('');
    onNotify && onNotify('success', `${food.name} added to ${meal}.`);
  };
  const updateEntry = (meal, uid, patch) => setEntries(s => ({ ...s, [meal]: s[meal].map(e => e.uid === uid ? { ...e, ...patch } : e) }));
  const removeEntry = (meal, uid, name) => {
    setEntries(s => ({ ...s, [meal]: s[meal].filter(e => e.uid !== uid) }));
    setDetail(null);
    onNotify && onNotify('info', `${name} removed.`);
  };
  const copyYesterday = () => { setEntries(seed()); onNotify && onNotify('success', "Yesterday's meals copied."); };

  const addRecipe = (recipe, totals) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const per100 = { kcal: totals.kcal, protein: totals.protein, carbs: totals.carbs, fat: totals.fat };
    setEntries(s => ({ ...s, [targetMeal]: [...s[targetMeal], { uid: Date.now(), id: recipe.id || 'custom-recipe', name: recipe.name, per100, amount: 100, unit: 'g', time }] }));
    setMode(null);
    onNotify && onNotify('success', `${recipe.name} added to ${targetMeal} — ${totals.kcal} kcal.`);
  };
  const addScanned = (product) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    setEntries(s => ({ ...s, [targetMeal]: [...s[targetMeal], { uid: Date.now(), id: product.code, name: product.name, per100: product.per100, amount: product.amount, unit: product.unit, time }] }));
    setMode(null);
    onNotify && onNotify('success', `${product.name} scanned into ${targetMeal}.`);
  };
  const addPhotoItems = (list) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const added = list.map((i, n) => ({ uid: Date.now() + n, id: i.id, name: i.name, per100: i.per100, amount: i.amount, unit: i.unit, time }));
    setEntries(s => ({ ...s, [targetMeal]: [...s[targetMeal], ...added] }));
    setMode(null);
    const kcal = added.reduce((a, e) => a + entryMacros(e).kcal, 0);
    onNotify && onNotify('success', `${added.length} items added to ${targetMeal} — ${kcal} kcal.`);
  };
  const saveCustom = (form) => {
    const grams = toGrams(Number(form.amount) || 100, form.unit) || 100;
    const scale = 100 / grams;
    const per100 = {
      kcal: Math.round((Number(form.kcal) || 0) * scale), protein: Math.round((Number(form.protein) || 0) * scale),
      carbs: Math.round((Number(form.carbs) || 0) * scale), fat: Math.round((Number(form.fat) || 0) * scale),
    };
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    setEntries(s => ({ ...s, [targetMeal]: [...s[targetMeal], { uid: Date.now(), id: 'custom-' + Date.now(), name: form.name.trim(), per100, amount: Number(form.amount) || 100, unit: form.unit, time }] }));
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
          <button className="v2-press" onClick={copyYesterday} style={{ border: '1px solid var(--border-subtle)', background: 'var(--ink-900)', borderRadius: 'var(--radius-pill)', padding: '7px 13px', cursor: 'pointer', font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-secondary)' }}>Copy yesterday</button>
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

      {/* Quick entry points */}
      <div className="v2-rise v2-d2" style={{ display: 'flex', gap: 8 }}>
        {[['Search', 'search'], ['Photo', 'camera'], ['Scan', 'barcode'], ['Recipes', 'recipe'], ['Custom', 'plus']].map(([label, icon]) => (
          <button key={label} className="v2-press" onClick={() => {
            if (label === 'Search') setAdding(targetMeal);
            else setMode(label === 'Photo' ? 'photo' : label === 'Scan' ? 'scan' : label === 'Recipes' ? 'recipes' : 'custom');
          }} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '12px 4px',
            border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-solid)', borderRadius: 'var(--radius-md)', cursor: 'pointer', boxShadow: 'var(--shadow-1)'
          }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime-500)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {icon === 'search' && <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>}
                {icon === 'camera' && <><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 9 4h6a1 1 0 0 1 .9.6L16.8 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>}
                {icon === 'barcode' && <path d="M4 5v14M8 5v14M11 5v14M14 5v14M17 5v3M17 16v3M20 5v14" />}
                {icon === 'recipe' && <path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.5 6.5 19.5l1-6.3L3 8.9 9 8z" />}
                {icon === 'plus' && <path d="M12 5v14M5 12h14" />}
              </svg>
            </div>
            <span style={{ font: 'var(--weight-bold) 9.5px/1 var(--font-sans)', color: 'var(--text-primary)' }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Meal sections */}
      {MEALS.map((meal, mi) => {
        const items = entries[meal];
        const mealKcal = items.reduce((a, e) => a + entryMacros(e).kcal, 0);
        return (
          <div key={meal} className="v2-rise">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 2px 10px' }}>
              <span style={{ font: 'var(--weight-bold) var(--text-h2)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{meal}</span>
              <span style={{ font: 'var(--weight-extrabold) var(--text-small)/1 var(--font-sans)', color: 'var(--violet-500)' }}>{mealKcal} kcal</span>
            </div>
            <div style={{ background: 'var(--bg-surface-solid)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-1)' }}>
              {items.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 16px' }}>
                  <span style={{ font: 'var(--weight-medium) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>No food added yet</span>
                  <button className="v2-press" onClick={() => setAdding(meal)} style={{ border: 'none', background: 'none', cursor: 'pointer', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: 'var(--lime-500)' }}>+ Add food</button>
                </div>
              ) : (
                <React.Fragment>
                  {items.map((e, i) => {
                    const m = entryMacros(e);
                    return (
                      <div key={e.uid} className="v2-row" onClick={() => setDetail({ meal, entry: e })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}>
                        <FoodIcon name={e.name} size={46} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: 'var(--weight-bold) var(--text-body)/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{e.name}</div>
                          <div style={{ font: 'var(--weight-medium) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 3 }}>{e.amount} {e.unit} · {e.time}</div>
                        </div>
                        <span style={{ font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)', flexShrink: 0 }}>{m.kcal} kcal</span>
                      </div>
                    );
                  })}
                  <button className="v2-press v2-row" onClick={() => setAdding(meal)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: 'var(--lime-500)', textAlign: 'left' }}>+ Add food</button>
                </React.Fragment>
              )}
            </div>
          </div>
        );
      })}

      {/* Water tracking */}
      <GlassCard className="v2-rise" padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>Water</span>
          <span style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>{water} / 8 glasses</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <button key={i} className="v2-press" onClick={() => setWater(i + 1)} aria-label={`${i + 1} glasses`} style={{
              flex: 1, height: 30, borderRadius: 8, cursor: 'pointer', border: '1px solid ' + (i < water ? 'transparent' : 'var(--border-subtle)'),
              background: i < water ? 'rgba(99,102,241,0.85)' : 'var(--ink-900)'
            }} />
          ))}
        </div>
      </GlassCard>

      <div style={{ display: 'flex', gap: 26, padding: '4px 4px 8px' }}>
        <Stat value={Object.values(entries).flat().length} label="entries" />
        <Stat value={`${totals.protein}g`} label="protein" color="var(--lime-500)" />
        <Stat value={`${water * 250}ml`} label="water" color="var(--violet-500)" />
      </div>

      {/* Food detail / edit sheet */}
      {detail && (() => {
        const e = entries[detail.meal].find(x => x.uid === detail.entry.uid) || detail.entry;
        const m = entryMacros(e);
        return (
          <Sheet onClose={() => setDetail(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <FoodIcon name={e.name} size={72} />
              <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1.15 var(--font-sans)', color: 'var(--text-primary)', textAlign: 'center' }}>{e.name}</div>
              <span style={{ font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>{detail.meal} · {e.time}</span>
            </div>
            <div style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase', marginBottom: 8 }}>Amount</div>
            <AmountField amount={e.amount} unit={e.unit} onChange={(q) => updateEntry(detail.meal, e.uid, q)} />
            <div style={{ display: 'flex', gap: 10, margin: '18px 0 22px' }}>
              {[['Calories', m.kcal, 'var(--text-primary)'], ['Protein', m.protein + 'g', 'var(--lime-500)'], ['Carbs', m.carbs + 'g', 'var(--apricot-500)'], ['Fat', m.fat + 'g', 'var(--violet-500)']].map(([l, v, c]) => (
                <div key={l} style={{ flex: 1, background: 'var(--ink-900)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ font: 'var(--weight-extrabold) var(--text-h2)/1 var(--font-sans)', color: c }}>{v}</div>
                  <div style={{ font: 'var(--weight-semibold) 9px/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 5, letterSpacing: 'var(--track-wide)', textTransform: 'uppercase' }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="v2-press" onClick={() => setDetail(null)} style={{ flex: 1, padding: '13px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: 'var(--text-onbrand)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer', boxShadow: 'var(--glow-lime)' }}>Save</button>
              <button className="v2-press" onClick={() => removeEntry(detail.meal, e.uid, e.name)} style={{ padding: '13px 20px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--rose-500)', background: 'transparent', color: 'var(--rose-500)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer' }}>Delete</button>
            </div>
          </Sheet>
        );
      })()}

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
          <RecipesPanel meal={targetMeal} onMeal={setTargetMeal} onAddRecipe={addRecipe} />
        </Sheet>
      )}
      {mode === 'custom' && (
        <Sheet onClose={() => setMode(null)}>
          <CustomFoodForm meal={targetMeal} onMeal={setTargetMeal} onSave={saveCustom} />
        </Sheet>
      )}

      {/* Add food sheet */}
      {adding && (
        <Sheet onClose={() => { setAdding(null); setQuery(''); }}>
          <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)', marginBottom: 4 }}>Add to {adding}</div>
          <div style={{ font: 'var(--weight-medium) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginBottom: 16 }}>Search, scan, or pick a recent food</div>          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ink-900)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', padding: '13px 16px', marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input autoFocus value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Search food..." style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: 'var(--weight-medium) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {[['Photo estimate', 'photo'], ['Scan barcode', 'scan'], ['Recipes', 'recipes'], ['Custom food', 'custom']].map(([a, m]) => (
              <button key={a} className="v2-press" onClick={() => { setTargetMeal(adding); setAdding(null); setQuery(''); setMode(m); }} style={{ flex: 1, padding: '10px 4px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'var(--ink-900)', cursor: 'pointer', font: 'var(--weight-semibold) 9.5px/1.2 var(--font-sans)', color: 'var(--text-secondary)' }}>{a}</button>
            ))}
          </div>
          <div style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase', marginBottom: 10 }}>
            {query.trim() ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Recently added'}
          </div>
          {query.trim() && results.length === 0 ? (
            <div style={{ padding: '22px 10px', textAlign: 'center' }}>
              <div style={{ font: 'var(--weight-bold) var(--text-body)/1.3 var(--font-sans)', color: 'var(--text-primary)' }}>No match for "{query.trim()}"</div>
              <div style={{ font: 'var(--weight-medium) var(--text-small)/1.4 var(--font-sans)', color: 'var(--text-secondary)', marginTop: 6 }}>Scan the barcode or create it as a custom food.</div>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
              {(query.trim() ? results : FOOD_DB.slice(0, 5)).map((f, i, arr) => (
                <div key={f.id} className="v2-row" onClick={() => addEntry(adding, f)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <FoodIcon name={f.name} size={40} />
                  <span style={{ flex: 1, font: 'var(--weight-semibold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{f.name}</span>
                  <span style={{ font: 'var(--weight-medium) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>{f.per100.kcal} kcal/100g</span>
                </div>
              ))}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
window.LogPageV3 = LogPage;
