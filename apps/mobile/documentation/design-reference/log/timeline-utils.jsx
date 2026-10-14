/* Time helpers + WhenPicker for the timeline-based Log.
   Entries carry `time: "HH:MM"` (24h) instead of a meal bucket. */
(function () {
  const pad = (n) => String(n).padStart(2, '0');
  const nowHHMM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const fromMin = (m) => { const v = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(v / 60)) + ':' + pad(v % 60); };
  const fmtDur = (mins) => {
    const m = Math.max(0, Math.round(mins)), h = Math.floor(m / 60), r = m % 60;
    if (h === 0) return r + ' min';
    return r === 0 ? h + ' h' : h + ' h ' + r + ' min';
  };
  const OFFSETS = [['Now', 0], ['30 min ago', 30], ['1 h ago', 60], ['2 h ago', 120]];

  function WhenPicker({ value, onChange, label, compact }) {
    const now = toMin(nowHHMM());
    const v = value || nowHHMM();
    const activeOffset = OFFSETS.find(([, o]) => fromMin(now - o) === v);
    return (
      <div style={{ marginBottom: compact ? 10 : 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <span style={{ font: 'var(--weight-bold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-secondary)' }}>{label || 'When did you eat?'}</span>
          <label style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '0 12px', borderRadius: 'var(--radius-pill)', background: 'rgba(99,102,241,0.10)', color: 'var(--lime-500)', cursor: 'pointer' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            <input type="time" value={v} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Time eaten"
              style={{ border: 'none', outline: 'none', background: 'transparent', font: 'var(--weight-extrabold) 16px/1 var(--font-sans)', color: 'var(--lime-500)', width: 76, padding: 0 }} />
          </label>
        </div>
        <div role="radiogroup" aria-label="Quick time" style={{ display: 'flex', gap: 6 }}>
          {OFFSETS.map(([l, o]) => {
            const on = activeOffset && activeOffset[1] === o;
            return (
              <button key={l} role="radio" aria-checked={!!on} className="v2-press" onClick={() => onChange(fromMin(now - o))} style={{
                flex: 1, minHeight: 36, borderRadius: 'var(--radius-pill)', cursor: 'pointer', padding: '0 4px',
                border: on ? 'none' : '1px solid var(--border-subtle)', background: on ? 'var(--grad-lime)' : 'var(--bg-surface-solid)',
                color: on ? 'var(--text-onbrand)' : 'var(--text-secondary)', font: 'var(--weight-bold) 11px/1 var(--font-sans)', whiteSpace: 'nowrap'
              }}>{l}</button>
            );
          })}
        </div>
      </div>
    );
  }
  window.NoraTime = { nowHHMM, toMin, fromMin, fmtDur, WhenPicker };
})();
