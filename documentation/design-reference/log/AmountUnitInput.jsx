import React from 'react';
export const UNIT_OPTIONS = [
  { label: 'g', grams: 1 },
  { label: 'oz', grams: 28.35 },
  { label: 'slice', grams: 30 },
  { label: 'piece', grams: 50 },
  { label: 'cup', grams: 150 },
  { label: 'serving', grams: 100 },
];
export function AmountUnitInput({ amount, unit, onChange }) {
  return (
    <div className="n-field" style={{ display: 'flex', gap: 8 }}>
      <input type="number" min="0" value={amount} onChange={(e) => onChange && onChange({ amount: Number(e.target.value), unit })}
        style={{ width: 72, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', font: 'var(--weight-semibold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)', outline: 'none' }} />
      <select value={unit} onChange={(e) => onChange && onChange({ amount, unit: e.target.value })}
        style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', font: 'var(--weight-semibold) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)', outline: 'none' }}>
        {UNIT_OPTIONS.map(u => <option key={u.label} value={u.label}>{u.label}</option>)}
      </select>
    </div>
  );
}
export function unitToGrams(amount, unit) {
  const u = UNIT_OPTIONS.find(o => o.label === unit) || UNIT_OPTIONS[0];
  return amount * u.grams;
}
