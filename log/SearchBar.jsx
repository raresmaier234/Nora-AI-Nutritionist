import React from 'react';
export function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="n-field" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface)', borderRadius: 'var(--radius-pill)', padding: '11px 16px', boxShadow: 'var(--shadow-1)', border: '1px solid var(--border-subtle)' }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder || 'Search foods'}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: 'var(--weight-medium) var(--text-body)/1 var(--font-sans)', color: 'var(--text-primary)' }}
      />
      {value && (
        <button className="n-press" onClick={() => onChange && onChange('')} aria-label="Clear search" style={{ border: 'none', background: 'var(--track-empty)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}
