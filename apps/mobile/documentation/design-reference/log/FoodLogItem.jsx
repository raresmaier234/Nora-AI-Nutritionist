import React from 'react';
import { getFoodIcon, foodIconUrl } from './foodIcons.js';
export function FoodLogItem({ name, time, kcal, icon, onClick }) {
  const ic = icon || getFoodIcon(name);
  return (
    <button className="n-row" onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
      borderBottom: '1px solid var(--border-subtle)', textAlign: 'left'
    }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: ic.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={foodIconUrl(ic.slug)} alt="" width="19" height="19" style={{ filter: 'invert(1) brightness(1.3)' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ font: 'var(--weight-medium) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{name}</div>
        <div style={{ font: 'var(--weight-medium) var(--text-micro)/1 var(--font-sans)', color: 'var(--text-tertiary)', marginTop: 2 }}>{time}</div>
      </div>
      <span style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-secondary)' }}>{kcal} kcal</span>
    </button>
  );
}
