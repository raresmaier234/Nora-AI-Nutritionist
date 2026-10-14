/* Food Search — full-screen mobile search for the Log page (v3).
   Header (back · title · time · search) stays pinned; results scroll beneath it.
   Tap a row → Food Details. Tap + → quick-add the default serving without leaving search. */
const { FoodIcon: FSIcon } = window.NoraDesignSystem_a9ff6f;
const FS_SERVINGS = (window.NoraNutrition && window.NoraNutrition.SERVINGS) || {};
const FS_ACTIONS = [
  { mode: 'photo', label: 'Photo', tint: 'rgba(99,102,241,0.10)', ink: 'var(--lime-500)', icon: <><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 9 4h6a1 1 0 0 1 .9.6L16.8 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></> },
  { mode: 'scan', label: 'Barcode', tint: 'rgba(245,158,11,0.12)', ink: '#B45309', icon: <path d="M4 5v14M8 5v14M11 5v14M14 5v14M17 5v3M17 16v3M20 5v14" /> },
  { mode: 'recipes', label: 'Recipes', tint: 'rgba(34,197,94,0.12)', ink: '#15803D', icon: <path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.5 6.5 19.5l1-6.3L3 8.9 9 8z" /> },
  { mode: 'custom', label: 'Custom', tint: '#F1F5F9', ink: 'var(--text-secondary)', icon: <path d="M12 5v14M5 12h14" /> },
];

function fsServing(food) {
  const s = FS_SERVINGS[food.id];
  if (s && s[0]) return { label: s[0][0], grams: s[0][1] };
  return { label: null, grams: 100 };
}
const fsRound = (v) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);

function FSHighlight({ text, query }) {
  const q = query.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return text;
  return (
    <React.Fragment>
      {text.slice(0, i)}<span style={{ color: 'var(--lime-500)' }}>{text.slice(i, i + q.length)}</span>{text.slice(i + q.length)}
    </React.Fragment>
  );
}

function FSRow({ food, query, onOpen, onQuickAdd }) {
  const sv = fsServing(food);
  const f = sv.grams / 100;
  const kcal = Math.round(food.per100.kcal * f);
  const [added, setAdded] = React.useState(false);
  React.useEffect(() => { if (!added) return; const t = setTimeout(() => setAdded(false), 1400); return () => clearTimeout(t); }, [added]);
  const macros = [['P', food.per100.protein, 'var(--lime-500)'], ['C', food.per100.carbs, 'var(--apricot-500)'], ['F', food.per100.fat, 'var(--violet-500)']];
  return (
    <div className="v2-row" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', minHeight: 76 }}>
      <FSIcon name={food.name} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: 'var(--weight-bold) var(--text-body)/1.3 var(--font-sans)', color: 'var(--text-primary)', overflowWrap: 'anywhere', textWrap: 'pretty' }}>
          <FSHighlight text={food.name} query={query} />
        </div>
        <div style={{ font: 'var(--weight-medium) var(--text-small)/1.3 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 3 }}>
          {sv.label ? `${sv.label} · ${sv.grams} g` : '100 g'}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          {macros.map(([k, v, c]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-secondary)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />{fsRound(v * f)}g {k}
            </span>
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ font: 'var(--weight-extrabold) var(--text-h2)/1 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: 'var(--track-tight)' }}>{kcal}</div>
        <div style={{ font: 'var(--weight-semibold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 3 }}>kcal</div>
      </div>
      <button className="v2-press" aria-label={added ? `${food.name} added` : `Quick add ${food.name}`}
        onClick={(e) => { e.stopPropagation(); if (added) return; setAdded(true); onQuickAdd(food, sv.grams); }}
        style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: added ? 'var(--violet-500)' : 'rgba(99,102,241,0.10)', color: added ? '#fff' : 'var(--lime-500)',
          transition: 'background-color var(--dur-fast) var(--ease-out)' }}>
        {added
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'pop-check var(--dur-base) var(--ease-spring) both' }}><path d="M20 6 9 17l-5-5" /></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
      </button>
    </div>
  );
}

function FSSkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', minHeight: 76 }}>
      <div className="n-skeleton" style={{ width: 48, height: 48, borderRadius: 20, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="n-skeleton" style={{ height: 13, width: '62%' }} />
        <div className="n-skeleton" style={{ height: 10, width: '38%' }} />
      </div>
      <div className="n-skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
    </div>
  );
}

function FoodSearchV3({ meal, foods, entries, remainingKcal, onMealChange, onOpenFood, onQuickAdd, onMode, onClose }) {
  const [query, setQuery] = React.useState('');
  const [tab, setTab] = React.useState('recent');
  const [pending, setPending] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => { const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 240); return () => clearTimeout(t); }, []);
  React.useEffect(() => {
    if (!query.trim()) { setPending(false); return; }
    setPending(true);
    const t = setTimeout(() => setPending(false), 260); // stands in for the network round-trip
    return () => clearTimeout(t);
  }, [query]);

  const close = () => { setClosing(true); setTimeout(onClose, 180); };
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const all = Object.values(entries || {}).flat();
  const recent = React.useMemo(() => {
    const seen = new Set(); const out = [];
    [...all].sort((a, b) => b.uid - a.uid).forEach(e => { if (!seen.has(e.id)) { seen.add(e.id); const f = foods.find(x => x.id === e.id); if (f) out.push(f); } });
    foods.forEach(f => { if (out.length < 8 && !seen.has(f.id)) { seen.add(f.id); out.push(f); } });
    return out.slice(0, 8);
  }, [entries, foods]);
  const frequent = React.useMemo(() => {
    const n = {}; all.forEach(e => { n[e.id] = (n[e.id] || 0) + 1; });
    return [...foods].sort((a, b) => (n[b.id] || 0) - (n[a.id] || 0) || a.name.localeCompare(b.name)).slice(0, 8);
  }, [entries, foods]);

  const q = query.trim().toLowerCase();
  const results = q ? foods
    .filter(f => f.name.toLowerCase().includes(q))
    .sort((a, b) => (a.name.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) ? 0 : 1) || a.name.localeCompare(b.name)) : [];
  const list = q ? results : tab === 'recent' ? recent : frequent;

  const screen = (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', background: 'rgba(17,24,39,0.3)', opacity: closing ? 0 : 1, transition: 'opacity 180ms var(--ease-out)' }}>
      <div className="n-sheet" role="dialog" aria-modal="true" aria-label={`Log food eaten at ${meal}`} style={{
        position: 'absolute', inset: 0, background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column',
        transform: closing ? 'translateY(100%)' : 'none', transition: 'transform 180ms var(--ease-in-out)'
      }}>
        {/* Pinned header */}
        <div style={{ padding: 'max(14px, env(safe-area-inset-top)) 20px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-solid)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button className="v2-press" onClick={close} aria-label="Close search" style={{ width: 44, height: 44, marginLeft: -10, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: 'var(--weight-extrabold) var(--text-h1)/1.1 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: 'var(--track-tight)' }}>Add food</div>
              <div style={{ font: 'var(--weight-medium) var(--text-small)/1.3 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 3 }}>
                {remainingKcal >= 0
                  ? <><b style={{ color: '#15803D', fontWeight: 700 }}>{remainingKcal.toLocaleString()} kcal</b> left today</>
                  : <><b style={{ color: '#DC2626', fontWeight: 700 }}>{(-remainingKcal).toLocaleString()} kcal</b> over today</>}
              </div>
            </div>
          </div>
          {/* When — every item lands on the timeline at this time */}
          {(() => { const W = window.NoraTime.WhenPicker; return <W value={meal} onChange={onMealChange} label="Eaten at" compact />; })()}
          {/* Search field */}
          <div className="n-field" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '0 8px 0 16px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-subtle)', background: 'var(--bg-app)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods" aria-label="Search foods" enterKeyHint="search"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: 'var(--weight-medium) 16px/1 var(--font-sans)', color: 'var(--text-primary)' }} />
            {query && (
              <button className="v2-press" onClick={() => { setQuery(''); inputRef.current && inputRef.current.focus(); }} aria-label="Clear search" style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Scrolling body */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          {!q && (
            <div className="v2-rise" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, padding: '18px 20px 6px' }}>
              {FS_ACTIONS.map(a => (
                <button key={a.mode} className="v2-press" onClick={() => onMode(a.mode)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 4px 11px',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-solid)', cursor: 'pointer'
                }}>
                  <span style={{ width: 40, height: 40, borderRadius: 14, background: a.tint, color: a.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{a.icon}</svg>
                  </span>
                  <span style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{a.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* List header: tabs when browsing, count when searching */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: q ? '18px 20px 6px' : '16px 20px 0', borderBottom: q ? 'none' : '1px solid var(--border-subtle)' }}>
            {q ? (
              <span style={{ font: 'var(--weight-bold) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'var(--track-wide)', textTransform: 'uppercase' }}>
                {pending ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'}`}
              </span>
            ) : [['recent', 'Recent'], ['frequent', 'Frequent']].map(([k, l]) => {
              const on = tab === k;
              return (
                <button key={k} onClick={() => setTab(k)} aria-pressed={on} style={{
                  border: 'none', background: 'none', cursor: 'pointer', padding: '10px 0 12px', minHeight: 44,
                  font: 'var(--weight-bold) var(--text-body)/1 var(--font-sans)', color: on ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  boxShadow: on ? 'inset 0 -2.5px 0 var(--lime-500)' : 'none', transition: 'color var(--dur-fast) var(--ease-out)'
                }}>{l}</button>
              );
            })}
          </div>

          {pending ? (
            <div>{[0, 1, 2].map(i => <FSSkeletonRow key={i} />)}</div>
          ) : q && results.length === 0 ? (
            <div className="v2-rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '36px 32px 20px' }}>
              <FSIcon generic size={64} />
              <div style={{ font: 'var(--weight-extrabold) var(--text-h2)/1.25 var(--font-sans)', color: 'var(--text-primary)', marginTop: 16, overflowWrap: 'anywhere' }}>No results for "{query.trim()}"</div>
              <div style={{ font: 'var(--weight-medium) var(--text-small)/1.45 var(--font-sans)', color: 'var(--text-secondary)', marginTop: 8, maxWidth: 270, textWrap: 'pretty' }}>Check the spelling, scan the package, or add it yourself — it'll be saved for next time.</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22, width: '100%' }}>
                <button className="v2-press" onClick={() => onMode('scan')} style={{ flex: 1, minHeight: 48, borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)', color: 'var(--text-primary)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer' }}>Scan barcode</button>
                <button className="v2-press" onClick={() => onMode('custom')} style={{ flex: 1, minHeight: 48, borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--grad-lime)', color: 'var(--text-onbrand)', font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', cursor: 'pointer', boxShadow: 'var(--glow-lime)' }}>Create food</button>
              </div>
            </div>
          ) : (
            <div key={q ? 'results' : tab} className="n-fade">
              {list.map((f, i) => (
                <div key={f.id} style={{ borderBottom: i < list.length - 1 ? '1px solid var(--border-subtle)' : 'none', marginLeft: i < list.length - 1 ? 0 : 0 }}>
                  <FSRow food={f} query={query} onOpen={() => onOpenFood(f)} onQuickAdd={onQuickAdd} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
  const host = document.getElementById('nora-overlay');
  return host ? ReactDOM.createPortal(screen, host) : screen;
}
window.FoodSearchV3 = FoodSearchV3;
