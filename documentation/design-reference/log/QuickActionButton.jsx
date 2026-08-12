import React from 'react';
const ICONS = {
  camera: <><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 9 4h6a1 1 0 0 1 .9.6L16.8 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
};
export function QuickActionButton({ icon, label, onClick }) {
  return (
    <button className="n-press n-lift" onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px',
      border: '1px solid var(--border-subtle)', cursor: 'pointer', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-1)'
    }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--nora-green-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary-strong)' }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
      </div>
      <span style={{ font: 'var(--weight-semibold) var(--text-small)/1 var(--font-sans)', color: 'var(--text-primary)' }}>{label}</span>
    </button>
  );
}
