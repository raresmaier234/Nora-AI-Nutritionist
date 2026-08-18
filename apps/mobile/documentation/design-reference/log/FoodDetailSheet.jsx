import React from 'react';
import { AmountUnitInput, unitToGrams } from './AmountUnitInput.jsx';
export function FoodDetailSheet({ food, editable, onChange, onClose, onConfirm, confirmLabel }) {
  const hasPer100 = !!food.per100;
  const amount = food.amount ?? 100;
  const unit = food.unit ?? 'g';
  const grams = hasPer100 ? unitToGrams(amount, unit) : null;
  const factor = grams != null ? grams / 100 : 1;
  const computed = hasPer100 ? {
    kcal: Math.round(food.per100.kcal * factor), protein: Math.round(food.per100.protein * factor),
    carbs: Math.round(food.per100.carbs * factor), fat: Math.round(food.per100.fat * factor),
  } : food;
  const set = (k, v) => onChange && onChange({ ...food, [k]: v });
  const setQty = ({ amount, unit }) => onChange && onChange({ ...food, amount, unit });
  return (
    <div className="n-fade" style={{ position: 'absolute', inset: 0, background: 'rgba(43,52,38,0.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 20 }} onClick={onClose}>
      <div className="n-sheet" onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg-surface)', borderRadius: '24px 24px 0 0', padding: '20px 20px 28px', boxShadow: 'var(--shadow-3)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 'var(--radius-pill)', background: 'var(--border-subtle)', margin: '0 auto 16px' }} />
        <div style={{ width: '100%', height: 120, borderRadius: 'var(--radius-md)', background: 'var(--nora-green-100)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary-strong)' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 9 4h6a1 1 0 0 1 .9.6L16.8 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></svg>
        </div>
        {editable ? (
          <input value={food.name} onChange={(e) => set('name', e.target.value)} placeholder="Meal name"
            style={{ width: '100%', border: 'none', outline: 'none', font: 'var(--weight-bold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)', marginBottom: 14, padding: 0 }} />
        ) : (
          <div style={{ font: 'var(--weight-bold) var(--text-h1)/1 var(--font-sans)', color: 'var(--text-primary)', marginBottom: 14 }}>{food.name}</div>
        )}
        {hasPer100 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 6 }}>Amount</div>
            <AmountUnitInput amount={amount} unit={unit} onChange={setQty} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
          {[['kcal', 'kcal', 'var(--text-primary)'], ['protein', 'g protein', 'var(--accent-protein)'], ['carbs', 'g carbs', 'var(--brand-primary-strong)'], ['fat', 'g fat', 'var(--warn-fat)']].map(([key, unitLabel, color]) => (
            <div key={key} style={{ flex: 1, background: 'var(--bg-surface-warm)', borderRadius: 'var(--radius-sm)', padding: '10px 8px', textAlign: 'center' }}>
              {editable && !hasPer100 ? (
                <input type="number" value={food[key]} onChange={(e) => set(key, Number(e.target.value))}
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', font: `var(--weight-bold) var(--text-h2)/1 var(--font-sans)`, color }} />
              ) : (
                <div style={{ font: 'var(--weight-bold) var(--text-h2)/1 var(--font-sans)', color }}>{computed[key]}</div>
              )}
              <div style={{ font: 'var(--weight-medium) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 2 }}>{unitLabel}</div>
            </div>
          ))}
        </div>
        <button className="n-press" onClick={() => onConfirm && onConfirm(hasPer100 ? { ...food, ...computed, amount, unit } : food)} style={{ width: '100%', marginTop: 18, border: 'none', cursor: 'pointer', padding: '14px', borderRadius: 'var(--radius-pill)', background: 'var(--brand-primary)', color: 'var(--text-onbrand)', font: 'var(--weight-bold) var(--text-h2)/1 var(--font-sans)' }}>
          {confirmLabel || 'Add to log'}
        </button>
      </div>
    </div>
  );
}
