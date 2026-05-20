/**
 * Back-office copy editor atoms.
 *
 * Shared low-level form primitives used by editors that pipe the
 * `settings.*_copy` singletons (Mittari, Mestari, future Voita hero +
 * Voyager rotation copy). Keeping them here means each editor page
 * doesn't reimplement the SectionTitle / Field / Row / Card stack and
 * we get consistent visual + accessibility behaviour for free.
 */
import React from 'react';

export const SectionTitle = ({ children, sub, onReset, testid }) => (
  <div style={{ margin: '36px 0 14px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
    <div>
      <h2 style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.24em', fontWeight: 700, color: 'var(--ink)',
        margin: 0, textTransform: 'uppercase',
      }} data-testid={testid}>{children}</h2>
      {sub && <p style={{
        margin: '6px 0 0', fontFamily: 'ui-monospace, monospace',
        fontSize: 10.5, color: 'var(--muted)', letterSpacing: '0.04em',
      }}>{sub}</p>}
    </div>
    {onReset && (
      <button type="button" onClick={onReset}
        data-testid={`${testid}-reset`}
        style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.16em', fontWeight: 700, color: 'var(--muted)',
          background: 'transparent', border: '1px solid var(--border-strong)',
          padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase',
        }}>↺ RESET SECTION</button>
    )}
  </div>
);

export const Field = ({ label, value, onChange, multiline, placeholder, idScope, testidPrefix = 'mec' }) => {
  const id = `${testidPrefix}-field-${idScope ? `${idScope}-` : ''}${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const sharedStyle = {
    background: 'var(--bg)', color: 'var(--ink)',
    border: '1px solid var(--border)', padding: '9px 12px',
    fontFamily: 'ui-monospace, monospace', fontSize: 12, outline: 'none',
  };
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
        letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 700,
        textTransform: 'uppercase',
      }}>{label}</span>
      {multiline ? (
        <textarea id={id} data-testid={id} rows={3} value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...sharedStyle, lineHeight: 1.5, resize: 'vertical' }} />
      ) : (
        <input id={id} data-testid={id} type="text" value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={sharedStyle} />
      )}
    </label>
  );
};

export const Row = ({ children, cols = 2 }) => (
  <div style={{
    display: 'grid', gap: 12, marginBottom: 12,
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  }}>{children}</div>
);

export const Card = ({ children, label, testid }) => (
  <div style={{
    background: 'var(--surface)', border: '1px solid var(--border)',
    padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
  }} data-testid={testid}>
    {label && (
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.2em', color: '#5B8DEE', fontWeight: 700,
        textTransform: 'uppercase',
      }}>{label}</div>
    )}
    {children}
  </div>
);
