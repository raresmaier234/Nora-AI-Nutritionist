import React from 'react';
import { AmountUnitInput, unitToGrams } from './AmountUnitInput.jsx';
export function IngredientRow({ name, icon, amount, unit, kcal, onQtyChange, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: icon.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <img src={`https://unpkg.com/lucide-static@0.462.0/icons/${icon.slug}.svg`} width="15" height="15" style={{ filter: 'invert(1) brightness(1.3)' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ font: 'var(--weight-medium) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)', marginBottom: 4 }}>{name}</div>
        <AmountUnitInput amount={amount} unit={unit} onChange={onQtyChange} />
      </div>
      <span style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-secondary)', flexShrink: 0 }}>{kcal} kcal</span>
      <button onClick={onRemove} aria-label="Remove ingredient" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
