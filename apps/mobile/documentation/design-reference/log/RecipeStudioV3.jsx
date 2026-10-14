/* Recipe Studio — full-screen recipe & custom-meal builder.
   Ingredients carry { id, amount, unit }; nutrition is always derived (never typed).
   Units are food-aware: g, oz, and each food's own servings ("breast", "medium", "cup cooked").
   A saved recipe becomes a food: NoraRecipeFood(recipe) registers its full per-100 g nutrient
   profile + servings ("1 serving", "whole recipe"), so it opens in Food Details, appears in
   search and logs exactly like any other food.
   Photo / link import are mocked — swap RS_PHOTO / RS_LINK for the real endpoints. */
const { FoodIcon: RSIcon } = window.NoraDesignSystem_a9ff6f;

const RS_PHOTO = {
  name: 'Chicken & Veg Stir-fry', servings: 2,
  items: [['chicken', 300, 'g', 0.93], ['rice', 1.5, 'cup cooked', 0.86], ['broccoli', 200, 'g', 0.81], ['pepper', 1, 'piece', 0.74], ['oliveoil', 15, 'g', 0.62], ['garlic', 10, 'g', 0.58]],
};
const RS_LINK = {
  name: 'Lemon Herb Salmon with Potatoes', servings: 4,
  items: [['salmon', 4, 'fillet'], ['potato', 500, 'g'], ['spinach', 200, 'g'], ['lemon', 1, 'piece'], ['oliveoil', 30, 'g'], ['garlic', 12, 'g'], [null, 10, 'g', null, '1 small bunch fresh dill']],
  steps: ['Heat the oven to 200 °C. Halve the potatoes and roast with half the oil for 20 minutes.', 'Season the salmon with lemon zest, garlic and dill.', 'Add the salmon to the tray and roast 12–15 minutes more.', 'Wilt the spinach in the pan juices and serve with lemon wedges.'],
};
let rsKey = 1;
const rsItem = ([id, amount, unit, confidence, raw]) => ({ key: rsKey++, id, amount, unit, confidence, raw, imported: true });
const rsHost = (url) => { try { const h = new URL(/^https?:/i.test(url) ? url : 'https://' + url).hostname.replace(/^www\./, ''); return h.includes('.') ? h : null; } catch (e) { return null; } };
const rsFmt = (n) => (Math.round(n * 10) / 10).toLocaleString();
const rsNut = () => window.NoraNutrition || { NUTRITION: {}, SERVINGS: {} };
const rsFood = (id) => window.NoraLogData.FOOD_DB.find(x => x.id === id);

// Food-aware units → [label, grams]. Serving labels drop their leading "1 ".
function rsUnits(id) {
  const own = (rsNut().SERVINGS[id] || []).map(([l, g]) => [l.replace(/^1 /, ''), g]);
  const generic = window.NoraLogData.UNITS.filter(u => u.label !== 'g').map(u => [u.label, u.grams]);
  return [['g', 1], ...own, ...generic.filter(([l]) => !own.some(([o]) => o === l))];
}
const rsGrams = (it) => {
  const u = rsUnits(it.id).find(([l]) => l === it.unit);
  return (Number(it.amount) || 0) * (u ? u[1] : 1);
};
const rsMacros = (f, grams) => { const k = grams / 100, p = f.per100; return { kcal: p.kcal * k, protein: p.protein * k, carbs: p.carbs * k, fat: p.fat * k }; };

function rsTotals(items) {
  return items.reduce((a, it) => {
    const f = it.id && rsFood(it.id); if (!f) return a;
    const g = rsGrams(it), m = rsMacros(f, g);
    return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat, grams: a.grams + g };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 });
}
window.NoraRecipeTotals = rsTotals;

// Whole-recipe nutrient profile, expressed per 100 g of finished dish.
// Macros always come from every ingredient (FOOD_DB per100). A detailed nutrient (fiber, vitamins…)
// is only shown when the ingredients that report it make up ≥ 90 % of the dish weight, so partial
// data never shows up as a misleading 0 or an undercount.
const RS_MACRO_KEYS = ['kcal', 'protein', 'carbs', 'fat'];
const RS_MIN_COVERAGE = 0.9;
function rsProfile(items) {
  const N = rsNut().NUTRITION;
  const sums = {}, covered = {};
  let grams = 0, detailed = 0, matched = 0;
  items.forEach(it => {
    const f = it.id && rsFood(it.id); if (!f) return;
    matched++;
    const g = rsGrams(it); grams += g;
    const n = N[it.id];
    if (n) detailed++;
    Object.entries(n || {}).forEach(([k, v]) => {
      if (v == null || RS_MACRO_KEYS.includes(k)) return;
      sums[k] = (sums[k] || 0) + v * g / 100;
      covered[k] = (covered[k] || 0) + g;
    });
  });
  const t = rsTotals(items);
  const per = (v) => grams ? v * 100 / grams : 0;
  const nutrients = {};
  Object.keys(sums).forEach(k => { if (grams && covered[k] / grams >= RS_MIN_COVERAGE) nutrients[k] = per(sums[k]); });
  const per100 = { kcal: per(t.kcal), protein: per(t.protein), carbs: per(t.carbs), fat: per(t.fat) };
  return { grams, per100, nutrients: { ...nutrients, ...per100 }, coverage: { detailed, matched } };
}

function rsRecipeFood(r) {
  const id = 'recipe-' + r.id;
  const p = rsProfile(r.items);
  const servings = Math.max(r.servings || 1, 0.5);
  const NN = rsNut();
  NN.NUTRITION[id] = p.nutrients;
  NN.SERVINGS[id] = [['1 serving', Math.round(p.grams / servings)], ['whole recipe', Math.round(p.grams)]];
  const first = r.items.find(i => i.id && rsFood(i.id));
  return { id, name: r.name, per100: p.per100, nutrients: p.nutrients, isRecipe: true, recipeId: r.id, iconName: first ? rsFood(first.id).name : r.name };
}
window.NoraRecipeFood = rsRecipeFood;

const rsLabel = { font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase' };
const rsCard = { background: 'var(--bg-surface-solid)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-1)' };
const rsNum = { fontVariantNumeric: 'tabular-nums' };
const rsField = { height: 40, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-primary)', outline: 'none' };

function RSStepper({ value, onChange, step, min, suffix, label }) {
  const dec = () => onChange(Math.max(min, Math.round((value - step) * 10) / 10));
  const inc = () => onChange(Math.round((value + step) * 10) / 10);
  const btn = (on, d, aria, off) => (
    <button className="v2-press" onClick={on} disabled={off} aria-label={aria} style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-solid)', cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d={d} /></svg>
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} role="group" aria-label={label}>
      {btn(dec, 'M5 12h14', 'Decrease ' + label, value <= min)}
      <div style={{ minWidth: 60, textAlign: 'center', font: 'var(--weight-extrabold) var(--text-h2)/1 var(--font-sans)', color: 'var(--text-primary)', ...rsNum }}>
        {rsFmt(value)}{suffix && <span style={{ display: 'block', font: 'var(--weight-semibold) 10px/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 4 }}>{suffix}</span>}
      </div>
      {btn(inc, 'M12 5v14M5 12h14', 'Increase ' + label)}
    </div>
  );
}

const RS_ICON = {
  camera: <><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 9 4h6a1 1 0 0 1 .9.6L16.8 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 9" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
};
const rsSvg = (icon, size, stroke) => <svg width={size || 17} height={size || 17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke || 2} strokeLinecap="round" strokeLinejoin="round">{icon}</svg>;
const RS_STEPS = ['Reading ingredients', 'Matching foods', 'Calculating nutrition'];

function RSImport({ start, onImported }) {
  const [kind, setKind] = React.useState(start === 'link' ? 'link' : start === 'photo' ? 'photo' : null);
  const [busy, setBusy] = React.useState(false);
  const [stage, setStage] = React.useState(0);
  const [url, setUrl] = React.useState('');
  const [err, setErr] = React.useState('');
  const run = (k) => {
    if (k === 'link' && !rsHost(url.trim())) { setErr('That doesn’t look like a link. Paste the full address, e.g. bbcgoodfood.com/recipes/…'); return; }
    setErr(''); setBusy(true); setStage(0);
    [1, 2].forEach(s => setTimeout(() => setStage(s), s * 550));
    setTimeout(() => {
      setBusy(false);
      const src = k === 'link' ? RS_LINK : RS_PHOTO;
      onImported({ name: src.name, servings: src.servings, items: src.items.map(rsItem), steps: src.steps || [], source: k === 'link' ? rsHost(url.trim()) : 'Photo' });
    }, 1700);
  };
  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) { setUrl(t.trim()); setErr(''); } }
    catch (e) { setErr('Clipboard access was blocked — long-press the field to paste.'); }
  };
  const tab = (k, label, icon) => (
    <button role="tab" aria-selected={kind === k} className="v2-press" onClick={() => { setKind(k); setErr(''); }} style={{
      flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)',
      background: kind === k ? 'var(--bg-surface-solid)' : 'transparent', boxShadow: kind === k ? 'var(--shadow-1)' : 'none',
      color: kind === k ? 'var(--text-primary)' : 'var(--text-secondary)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)'
    }}>{rsSvg(icon, 16)}{label}</button>
  );
  const bigBtn = (label, sub, icon, primary) => (
    <button className="v2-press" onClick={() => run('photo')} style={{
      flex: 1, minWidth: 0, minHeight: 84, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 8, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', borderRadius: 'var(--radius-md)',
      border: primary ? 'none' : '1px solid var(--border-subtle)', background: primary ? 'var(--grad-lime)' : 'var(--bg-surface-solid)', color: primary ? '#fff' : 'var(--text-primary)', boxShadow: primary ? 'var(--glow-lime)' : 'none'
    }}>
      {rsSvg(icon, 20)}
      <span>
        <span style={{ display: 'block', font: 'var(--weight-bold) var(--text-small)/1.2 var(--font-sans)' }}>{label}</span>
        <span style={{ display: 'block', font: 'var(--weight-medium) 11px/1.3 var(--font-sans)', opacity: primary ? 0.85 : 1, color: primary ? '#fff' : 'var(--text-tertiary)', marginTop: 2 }}>{sub}</span>
      </span>
    </button>
  );
  return (
    <div style={{ ...rsCard, padding: 16 }}>
      <div style={{ font: 'var(--weight-bold) var(--text-body)/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>Import a recipe</div>
      <div style={{ font: 'var(--weight-medium) var(--text-small)/1.4 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 14 }}>Nora reads the ingredients and amounts. You check them before saving.</div>
      {busy ? (
        <div role="status" aria-live="polite" style={{ padding: '14px 14px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.07)' }}>
          {RS_STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', opacity: i > stage ? 0.45 : 1, transition: 'opacity var(--dur-base) var(--ease-out)' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: i < stage ? 'var(--violet-500)' : 'transparent', color: '#fff' }}>
                {i < stage ? rsSvg(RS_ICON.check, 13, 3) : i === stage
                  ? <svg className="n-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lime-500)" strokeWidth="2.8" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
                  : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-strong)' }} />}
              </span>
              <span style={{ font: 'var(--weight-semibold) var(--text-small)/1.3 var(--font-sans)', color: 'var(--text-primary)' }}>{s}{i === stage ? '…' : ''}</span>
            </div>
          ))}
        </div>
      ) : (
        <React.Fragment>
          <div role="tablist" aria-label="Import source" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 'var(--radius-pill)', background: 'var(--track-empty)' }}>
            {tab('photo', 'Photo', RS_ICON.camera)}
            {tab('link', 'Link', RS_ICON.link)}
          </div>
          {kind === 'photo' && (
            <div className="v2-rise" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {bigBtn('Take photo', 'Recipe card or plate', RS_ICON.camera, true)}
                {bigBtn('Choose photo', 'From your library', RS_ICON.image, false)}
              </div>
              <div style={{ font: 'var(--weight-medium) 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 10 }}>Works with handwritten cards, cookbook pages and screenshots.</div>
            </div>
          )}
          {kind === 'link' && (
            <div className="v2-rise" style={{ marginTop: 12 }}>
              <div className="n-field" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px 4px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid ' + (err ? 'var(--rose-500)' : 'var(--border-subtle)'), background: 'var(--bg-app)' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'flex' }}>{rsSvg(RS_ICON.link, 16)}</span>
                <input value={url} onChange={(e) => { setUrl(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && run('link')} placeholder="Paste recipe link" inputMode="url" aria-label="Recipe link" aria-invalid={!!err}
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: 'var(--weight-medium) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)', padding: '10px 0' }} />
                {!url && <button className="v2-press" onClick={paste} style={{ minHeight: 40, padding: '0 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-solid)', color: 'var(--text-primary)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer', flexShrink: 0 }}>Paste</button>}
                <button className="v2-press" onClick={() => run('link')} disabled={!url.trim()} style={{ minHeight: 40, padding: '0 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: '#fff', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: url.trim() ? 'pointer' : 'default', opacity: url.trim() ? 1 : 0.5, flexShrink: 0 }}>Import</button>
              </div>
              {err
                ? <div role="alert" style={{ font: 'var(--weight-semibold) 11px/1.35 var(--font-sans)', color: '#DC2626', marginTop: 8, paddingLeft: 4 }}>{err}</div>
                : <div style={{ font: 'var(--weight-medium) 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 8, paddingLeft: 4 }}>Ingredients, servings and method are imported. Ads and stories are skipped.</div>}
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}

function RSFoodPicker({ exclude, placeholder, autoFocus, onPick }) {
  const D = window.NoraLogData;
  const [q, setQ] = React.useState('');
  const results = q.trim() ? D.FOOD_DB.filter(f => !exclude.includes(f.id) && f.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  return (
    <div>
      <div className="n-field" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 14px', borderRadius: 'var(--radius-pill)', background: 'rgba(99,102,241,0.06)', border: '1px dashed rgba(99,102,241,0.35)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lime-500)" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: 'var(--weight-semibold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }} />
      </div>
      {q.trim() && (
        <div style={{ marginTop: 6 }}>
          {results.length ? results.map(f => (
            <button key={f.id} className="v2-row" onClick={() => { onPick(f); setQ(''); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '6px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 12 }}>
              <RSIcon name={f.name} size={36} />
              <span style={{ flex: 1, minWidth: 0, font: 'var(--weight-semibold) var(--text-body)/1.25 var(--font-sans)', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{f.name}</span>
              <span style={{ font: 'var(--weight-medium) 11px/1 var(--font-sans)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', ...rsNum }}>{f.per100.kcal} kcal/100g</span>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--grad-lime)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </span>
            </button>
          )) : (
            <div style={{ padding: '12px 8px', font: 'var(--weight-medium) var(--text-small)/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>No food matches "{q.trim()}". Try a simpler name, like "dill" or "herbs".</div>
          )}
        </div>
      )}
    </div>
  );
}

function RSIngredientRow({ it, exclude, onChange, onRemove }) {
  const [matching, setMatching] = React.useState(false);
  const removeBtn = (name) => (
    <button className="v2-press" onClick={onRemove} aria-label={'Remove ' + name} style={{ width: 44, height: 44, marginTop: -4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
  );
  const f = it.id && rsFood(it.id);
  if (!f) {
    return (
      <div style={{ padding: '14px 4px 14px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(245,158,11,0.06)' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ width: 42, height: 42, borderRadius: 14, border: '1.5px dashed rgba(180,83,9,0.45)', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 8v5M12 16.5h.01" /><circle cx="12" cy="12" r="9" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: 'var(--weight-bold) var(--text-body)/1.25 var(--font-sans)', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{it.raw}</div>
            <div style={{ font: 'var(--weight-semibold) 11px/1.3 var(--font-sans)', color: '#B45309', marginTop: 5 }}>Not matched — not counted in nutrition yet</div>
            {!matching && (
              <button className="v2-press" onClick={() => setMatching(true)} style={{ marginTop: 10, minHeight: 36, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: '1px solid rgba(180,83,9,0.35)', background: 'var(--bg-surface-solid)', color: '#B45309', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer' }}>Match to a food</button>
            )}
          </div>
          {removeBtn(it.raw)}
        </div>
        {matching && (
          <div style={{ marginTop: 12, paddingRight: 12 }}>
            <RSFoodPicker autoFocus exclude={exclude} placeholder="Search for this ingredient" onPick={(food) => onChange({ ...it, id: food.id, unit: 'g', raw: null, confidence: null })} />
          </div>
        )}
      </div>
    );
  }
  const units = rsUnits(f.id);
  const g = rsGrams(it);
  const m = rsMacros(f, g);
  const low = it.confidence != null && it.confidence < 0.7;
  const showGrams = it.unit !== 'g';
  return (
    <div style={{ display: 'flex', gap: 12, padding: '14px 4px 14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
      <RSIcon name={f.name} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, font: 'var(--weight-bold) var(--text-body)/1.25 var(--font-sans)', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{f.name}</span>
          <span style={{ font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-primary)', flexShrink: 0, ...rsNum }}>{Math.round(m.kcal)} kcal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
          <input type="number" inputMode="decimal" min="0" value={it.amount} onChange={(e) => onChange({ ...it, amount: e.target.value, confidence: null })} aria-label={f.name + ' amount'}
            style={{ ...rsField, width: 70, padding: '0 10px', borderColor: low ? 'rgba(245,158,11,0.7)' : 'var(--border-subtle)', ...rsNum }} />
          <select value={it.unit} onChange={(e) => {
            const next = e.target.value, toG = (units.find(([l]) => l === next) || [0, 1])[1];
            const amt = Math.round((g / toG) * 10) / 10 || 1; // keep the same weight when switching units
            onChange({ ...it, unit: next, amount: next === 'g' ? Math.round(g) : amt, confidence: null });
          }} aria-label={f.name + ' unit'} style={{ ...rsField, minWidth: 0, maxWidth: 132, padding: '0 8px', fontWeight: 600 }}>
            {units.map(([l]) => <option key={l} value={l}>{l}</option>)}
          </select>
          {showGrams && <span style={{ font: 'var(--weight-semibold) 11px/1 var(--font-sans)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', ...rsNum }}>= {Math.round(g)} g</span>}
        </div>
        <div style={{ font: 'var(--weight-medium) 11px/1.3 var(--font-sans)', color: low ? '#B45309' : 'var(--text-tertiary)', marginTop: 8, ...rsNum }}>
          {low ? 'Low confidence — check the amount' : `P ${Math.round(m.protein)} g · C ${Math.round(m.carbs)} g · F ${Math.round(m.fat)} g`}
        </div>
      </div>
      {removeBtn(f.name)}
    </div>
  );
}

function RSMethod({ steps, onChange }) {
  const [open, setOpen] = React.useState(steps.length > 0);
  const [draft, setDraft] = React.useState('');
  const add = () => { if (!draft.trim()) return; onChange([...steps, draft.trim()]); setDraft(''); };
  return (
    <div style={{ ...rsCard, overflow: 'hidden' }}>
      <button className="v2-row" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ flex: 1, font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>Method</span>
        <span style={{ font: 'var(--weight-semibold) 11px/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>{steps.length ? steps.length + (steps.length === 1 ? ' step' : ' steps') : 'Optional'}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-fast) var(--ease-out)' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(99,102,241,0.10)', color: 'var(--lime-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, font: 'var(--weight-extrabold) 11px/1 var(--font-sans)' }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, font: 'var(--weight-medium) var(--text-small)/1.5 var(--font-sans)', color: 'var(--text-primary)', textWrap: 'pretty' }}>{s}</span>
              <button className="v2-press" onClick={() => onChange(steps.filter((_, j) => j !== i))} aria-label={'Remove step ' + (i + 1)} style={{ width: 32, height: 32, marginTop: -4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: steps.length ? 6 : 0 }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={'Step ' + (steps.length + 1)} aria-label="New step"
              style={{ ...rsField, flex: 1, minWidth: 0, height: 44, padding: '0 14px', fontWeight: 500 }} />
            <button className="v2-press" onClick={add} disabled={!draft.trim()} style={{ minWidth: 64, height: 44, borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)', color: 'var(--text-primary)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: draft.trim() ? 'pointer' : 'default', opacity: draft.trim() ? 1 : 0.5 }}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RecipeStudio({ initial, start, whenPicker, onClose, onSave, onLog, onDetails }) {
  const editing = !!(initial && initial.id);
  const [name, setName] = React.useState(initial ? initial.name : '');
  const [servings, setServings] = React.useState(initial ? initial.servings || 1 : 2);
  const [items, setItems] = React.useState(() => initial ? initial.items.map(i => ({ key: rsKey++, ...i })) : []);
  const [steps, setSteps] = React.useState(initial ? initial.steps || [] : []);
  const [source, setSource] = React.useState(initial ? initial.source || null : null);
  const [view, setView] = React.useState('serving');
  const [eat, setEat] = React.useState(1);
  const [nameErr, setNameErr] = React.useState(false);
  const [showImport, setShowImport] = React.useState(!initial && (start === 'photo' || start === 'link'));

  const t = rsTotals(items);
  const div = view === 'serving' ? Math.max(servings, 0.5) : 1;
  const shown = { kcal: Math.round(t.kcal / div), protein: t.protein / div, carbs: t.carbs / div, fat: t.fat / div };
  const perServingKcal = Math.round(t.kcal / Math.max(servings, 0.5));
  const gramsPerServing = t.grams / Math.max(servings, 0.5);
  const energy = shown.protein * 4 + shown.carbs * 4 + shown.fat * 9 || 1;
  const matched = items.filter(i => i.id && rsFood(i.id));
  const unmatched = items.length - matched.length;
  const toCheck = items.filter(i => i.confidence != null && i.confidence < 0.7).length;
  const hasItems = matched.length > 0;
  const ready = hasItems && unmatched === 0;
  const first = matched[0] ? rsFood(matched[0].id) : null;
  const cov = React.useMemo(() => rsProfile(items).coverage, [items]);

  const build = () => ({ id: initial && initial.id, name: name.trim(), servings, source, steps, items: items.map(({ id, amount, unit }) => ({ id, amount: Number(amount) || 0, unit })) });
  const guard = () => { if (!ready) return false; if (!name.trim()) { setNameErr(true); return false; } return true; };

  const macro = (label, v, color) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'var(--weight-semibold) 11px/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />{label}
      </div>
      <div style={{ font: 'var(--weight-extrabold) var(--text-h2)/1 var(--font-sans)', color: 'var(--text-primary)', marginTop: 7, ...rsNum }}>{rsFmt(v)}<span style={{ font: 'var(--weight-semibold) 11px/1 var(--font-sans)', color: 'var(--text-tertiary)', marginLeft: 2 }}>g</span></div>
    </div>
  );
  const ctaLabel = !hasItems ? 'Add an ingredient to continue'
    : unmatched ? `Match ${unmatched} ingredient${unmatched === 1 ? '' : 's'} to continue`
    : `Save & log · ${Math.round(perServingKcal * eat)} kcal`;

  return (
    <div className="n-fade" role="dialog" aria-modal="true" aria-label={editing ? 'Edit recipe' : 'New recipe'} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 8px', minHeight: 60 }}>
        <button className="v2-press" onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-solid)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <div style={{ flex: 1, textAlign: 'center', font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{editing ? 'Edit recipe' : 'New recipe'}</div>
        <button className="v2-press" onClick={() => guard() && onSave(build())} disabled={!ready} style={{ minWidth: 44, height: 44, padding: '0 14px', border: 'none', background: 'none', cursor: ready ? 'pointer' : 'default', font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: ready ? 'var(--lime-500)' : 'var(--text-tertiary)' }}>Save</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 132px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Identity */}
        <div className="v2-rise">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {first ? <RSIcon name={first.name} size={56} /> : <RSIcon generic size={56} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <input value={name} onChange={(e) => { setName(e.target.value); setNameErr(false); }} placeholder="Name your recipe" aria-label="Recipe name" aria-invalid={nameErr}
                style={{ width: '100%', border: 'none', borderBottom: '2px solid ' + (nameErr ? 'var(--rose-500)' : 'var(--border-subtle)'), outline: 'none', background: 'transparent', padding: '4px 0 10px', font: 'var(--weight-extrabold) var(--text-h1)/1.2 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: 'var(--track-tight)' }} />
              {nameErr && <div role="alert" style={{ font: 'var(--weight-semibold) 11px/1 var(--font-sans)', color: '#DC2626', marginTop: 8 }}>Give the recipe a name to save it.</div>}
            </div>
          </div>
          {source && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '6px 10px', borderRadius: 'var(--radius-pill)', background: 'rgba(34,197,94,0.10)', font: 'var(--weight-semibold) 11px/1 var(--font-sans)', color: '#15803D' }}>
              {rsSvg(source === 'Photo' ? RS_ICON.camera : RS_ICON.link, 12, 2.4)}Imported from {source}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18 }}>
            <div>
              <div style={{ font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>Servings</div>
              <div style={{ font: 'var(--weight-medium) 11px/1.3 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 5, ...rsNum }}>
                {hasItems ? `${Math.round(gramsPerServing)} g each · ${Math.round(t.grams).toLocaleString()} g total` : 'How many portions this makes'}
              </div>
            </div>
            <RSStepper value={servings} onChange={setServings} step={1} min={1} label="servings" />
          </div>
        </div>

        {showImport || (!items.length && !initial) ? (
          <RSImport start={start} onImported={(r) => { setName(n => n.trim() ? n : r.name); setServings(r.servings); setItems(r.items); setSteps(r.steps); setSource(r.source); setShowImport(false); }} />
        ) : !items.some(i => i.imported) && (
          <button className="v2-press" onClick={() => setShowImport(true)} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-solid)', color: 'var(--text-secondary)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer' }}>
            {rsSvg(RS_ICON.link, 15)}Import from photo or link
          </button>
        )}

        {/* Nutrition */}
        <div className="v2-rise v2-d1" style={{ ...rsCard, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
            <span style={rsLabel}>Nutrition</span>
            <div role="tablist" aria-label="Nutrition basis" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 'var(--radius-pill)', background: 'var(--track-empty)' }}>
              {[['serving', 'Per serving'], ['total', 'Whole recipe']].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} style={{ minHeight: 34, padding: '0 12px', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer', background: view === k ? 'var(--bg-surface-solid)' : 'transparent', boxShadow: view === k ? 'var(--shadow-1)' : 'none', font: 'var(--weight-bold) 11px/1 var(--font-sans)', color: view === k ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{l}</button>
              ))}
            </div>
          </div>
          {hasItems ? (
            <React.Fragment>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ font: 'var(--weight-extrabold) var(--text-display-2)/1 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: 'var(--track-tight)', ...rsNum }}>{shown.kcal.toLocaleString()}</span>
                <span style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>kcal {view === 'serving' ? 'per serving' : 'in total'}</span>
              </div>
              <div style={{ font: 'var(--weight-medium) 11px/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 6, ...rsNum }}>{Math.round(t.grams ? t.kcal * 100 / t.grams : 0)} kcal per 100 g</div>
              <div aria-hidden="true" style={{ display: 'flex', gap: 2, height: 8, borderRadius: 'var(--radius-pill)', overflow: 'hidden', margin: '16px 0' }}>
                <div style={{ width: (shown.protein * 4 / energy * 100) + '%', background: '#6366F1' }} />
                <div style={{ width: (shown.carbs * 4 / energy * 100) + '%', background: '#F59E0B' }} />
                <div style={{ width: (shown.fat * 9 / energy * 100) + '%', background: '#22C55E' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {macro('Protein', shown.protein, '#6366F1')}
                {macro('Carbs', shown.carbs, '#F59E0B')}
                {macro('Fat', shown.fat, '#22C55E')}
              </div>
              {unmatched > 0 && <div style={{ font: 'var(--weight-semibold) 11px/1.4 var(--font-sans)', color: '#B45309', marginTop: 14 }}>{unmatched} unmatched ingredient{unmatched === 1 ? ' isn’t' : 's aren’t'} counted yet.</div>}
              <button className="v2-press" onClick={() => guard() && onDetails(build())} disabled={!ready} style={{
                width: '100%', marginTop: 16, minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.5, textAlign: 'left'
              }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', font: 'var(--weight-bold) var(--text-small)/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>Full nutrition</span>
                  <span style={{ display: 'block', font: 'var(--weight-medium) 11px/1.3 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 2 }}>Vitamins, minerals and daily targets · {cov.detailed} of {cov.matched} ingredients have full data</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </React.Fragment>
          ) : (
            <div style={{ font: 'var(--weight-medium) var(--text-small)/1.45 var(--font-sans)', color: 'var(--text-secondary)' }}>Add ingredients and Nora calculates calories, macros, vitamins and minerals for the whole recipe and each serving.</div>
          )}
        </div>

        {/* Ingredients */}
        <div className="v2-rise v2-d2">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 2px 10px' }}>
            <span style={{ font: 'var(--weight-bold) var(--text-h2)/1 var(--font-sans)', color: 'var(--text-primary)' }}>Ingredients{items.length > 0 && <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}> · {items.length}</span>}</span>
            {hasItems && <span style={{ font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-secondary)', ...rsNum }}>{Math.round(t.kcal).toLocaleString()} kcal</span>}
          </div>
          {(unmatched > 0 || toCheck > 0) && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', marginBottom: 10, borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.10)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
              <span style={{ font: 'var(--weight-medium) var(--text-small)/1.4 var(--font-sans)', color: 'var(--text-primary)' }}>
                {[unmatched && `${unmatched} ingredient${unmatched === 1 ? '' : 's'} to match`, toCheck && `${toCheck} amount${toCheck === 1 ? '' : 's'} to check`].filter(Boolean).join(' · ')}. Review before you save.
              </span>
            </div>
          )}
          <div style={{ ...rsCard, overflow: 'hidden' }}>
            {items.map(it => (
              <RSIngredientRow key={it.key} it={it} exclude={items.map(i => i.id).filter(Boolean)}
                onChange={(n) => setItems(list => list.map(x => x.key === it.key ? n : x))}
                onRemove={() => setItems(list => list.filter(x => x.key !== it.key))} />
            ))}
            <div style={{ padding: 12 }}>
              <RSFoodPicker exclude={items.map(i => i.id).filter(Boolean)} placeholder="Add ingredient"
                onPick={(f) => { const sv = (rsNut().SERVINGS[f.id] || [])[0]; setItems(list => [...list, sv ? { key: rsKey++, id: f.id, amount: 1, unit: sv[0].replace(/^1 /, '') } : { key: rsKey++, id: f.id, amount: 100, unit: 'g' }]); }} />
            </div>
          </div>
        </div>

        <div className="v2-rise v2-d3"><RSMethod steps={steps} onChange={setSteps} /></div>

        {/* Log it now */}
        {hasItems && (
          <div className="v2-rise v2-d3" style={{ ...rsCard, padding: 18 }}>
            <div style={{ ...rsLabel, marginBottom: 14 }}>Log it now</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>You ate</div>
                <div style={{ font: 'var(--weight-medium) 11px/1.3 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 5, ...rsNum }}>{Math.round(gramsPerServing * eat)} g · {Math.round(perServingKcal * eat)} kcal</div>
              </div>
              <RSStepper value={eat} onChange={setEat} step={0.5} min={0.5} suffix={eat === 1 ? 'serving' : 'servings'} label="servings eaten" />
            </div>
            {whenPicker}
          </div>
        )}
      </div>

      {/* Sticky actions */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', gap: 10, padding: '12px 20px max(18px, env(safe-area-inset-bottom))', background: 'var(--bg-surface-solid)', borderTop: '1px solid var(--border-subtle)', boxShadow: '0 -8px 24px rgba(17,24,39,0.06)' }}>
        {ready && <button className="v2-press" onClick={() => guard() && onSave(build())} style={{ minHeight: 52, padding: '0 20px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)', color: 'var(--text-primary)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer' }}>Save</button>}
        <button className="v2-press" disabled={!ready} onClick={() => guard() && onLog(build(), eat)} style={{ flex: 1, minHeight: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: ready ? 'var(--grad-lime)' : 'var(--track-empty)', color: ready ? '#fff' : 'var(--text-secondary)', boxShadow: ready ? 'var(--glow-lime)' : 'none', font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', cursor: ready ? 'pointer' : 'default', ...rsNum }}>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
window.RecipeStudioV3 = RecipeStudio;
