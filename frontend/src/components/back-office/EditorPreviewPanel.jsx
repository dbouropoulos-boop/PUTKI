/**
 * EditorPreviewPanel — slide-in iframe preview for back-office editors.
 *
 * Designed for editors that map 1:1 to a public route (e.g. MittariCopy
 * → /mittari, MestariCopy → /mestari, RaffleEditor → /voita/{slug}).
 *
 * UX:
 *   - A "PREVIEW" toggle button + autosave status pill live in a sticky
 *     header strip the host editor can render via <PreviewToggle/>.
 *   - When toggled on, a fixed right-side drawer (380px wide, full
 *     viewport height, slides in 220ms) renders an <iframe src={url}>.
 *   - Whenever `reloadKey` changes (operator passes
 *     `autosave.lastSavedAt` from useFormAutosave), the iframe is
 *     re-mounted with a cache-buster so the preview shows the just-
 *     saved state without manual refresh.
 *   - A toolbar inside the drawer offers manual refresh + open-in-new-
 *     tab + close.
 *
 * The drawer is z-index 60, sitting above the back-office shell's
 * z-index 50 sidebar; it stacks above on mobile too.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, X, Eye, EyeOff } from 'lucide-react';

const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

export const EditorPreviewPanel = ({
  open,
  onClose,
  url,
  reloadKey,
  title = 'PREVIEW',
  testid = 'editor-preview-panel',
}) => {
  // Bump a local counter on every manual refresh so the iframe re-mounts
  // even when `reloadKey` is unchanged.
  const [manualRefresh, setManualRefresh] = useState(0);
  // Combine reloadKey + manualRefresh into the iframe key. Add a
  // cache-buster query so the embedded page picks up fresh data even
  // if the CDN/server has stale headers.
  const iframeKey = `${reloadKey || 'init'}::${manualRefresh}`;
  const src = useMemo(() => {
    if (!url) return '';
    const u = new URL(url, window.location.origin);
    u.searchParams.set('_preview', String(Date.now()) + ':' + manualRefresh);
    // Note: reloadKey intentionally excluded — it's already part of
    // iframeKey above which forces the iframe to remount, so URL
    // recomputation isn't needed for it.
    return u.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, manualRefresh]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    if (window.innerWidth <= 720) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <aside data-testid={testid}
      className="bo-editor-preview-panel"
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(420px, 90vw)',
        background: 'var(--bg)',
        borderLeft: '1px solid var(--line-strong)',
        boxShadow: '-12px 0 32px rgba(11,10,9,0.18)',
        zIndex: 60,
        display: 'flex', flexDirection: 'column',
        animation: 'bo-preview-slide-in 220ms ease',
      }}>
      <style>{`
        @keyframes bo-preview-slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @media (max-width: 720px) {
          .bo-editor-preview-panel { width: 100vw !important; }
        }
      `}</style>
      <header style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--surface)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em',
          color: 'var(--ember)', fontWeight: 800,
        }}>{title}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setManualRefresh((n) => n + 1)}
          data-testid={`${testid}-refresh`}
          aria-label="Refresh preview"
          style={iconBtn}>
          <RefreshCw size={13} strokeWidth={2} />
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer"
          data-testid={`${testid}-open`}
          aria-label="Open preview in a new tab"
          style={{ ...iconBtn, textDecoration: 'none' }}>
          <ExternalLink size={13} strokeWidth={2} />
        </a>
        <button type="button" onClick={onClose}
          data-testid={`${testid}-close`}
          aria-label="Close preview"
          style={iconBtn}>
          <X size={14} strokeWidth={2} />
        </button>
      </header>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#fff' }}>
        <iframe key={iframeKey}
          data-testid={`${testid}-iframe`}
          src={src}
          title={title}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
      </div>
      <footer style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--line)',
        background: 'var(--surface)',
        fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em',
        color: 'var(--ink-3)', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        AUTO-REFRESH ON SAVE · KEY {String(iframeKey).slice(0, 18)}
      </footer>
    </aside>
  );
};


/**
 * PreviewToggle — convenience button that flips the panel open/closed.
 * The host editor controls the open state so multi-button toolbars
 * stay coherent.
 */
export const PreviewToggle = ({ open, onClick, testid = 'editor-preview-toggle' }) => (
  <button type="button" onClick={onClick} data-testid={testid}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', border: '1px solid var(--line)',
      borderRadius: 4, background: open ? 'var(--ember-soft)' : 'var(--bg)',
      color: open ? 'var(--ember-strong)' : 'var(--ink-2)', cursor: 'pointer',
      fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em',
      fontWeight: 700, textTransform: 'uppercase',
    }}>
    {open ? <EyeOff size={12} strokeWidth={2} /> : <Eye size={12} strokeWidth={2} />}
    {open ? 'HIDE PREVIEW' : 'SHOW PREVIEW'}
  </button>
);


const iconBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: '1px solid var(--line)',
  borderRadius: 4, padding: '5px 7px', cursor: 'pointer',
  color: 'var(--ink-2)',
};


export default EditorPreviewPanel;
