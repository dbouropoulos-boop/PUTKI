/**
 * /back-office/runbook - in-app viewer for /app/memory/OPS.md.
 *
 * The file is the source of truth (committed to the repo for review).
 * The FE fetches the raw markdown via `/api/admin/docs/runbook` and
 * renders it client-side with a minimal converter - no marked/remark
 * dependency, keeps the bundle lean. Tables, headings, lists, code,
 * bold, italic, and pipe-delimited tables are all this page renders;
 * anything fancier should be moved into a dedicated docs framework.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'putki_back_office_token';


// ─── Tiny markdown renderer ────────────────────────────────────────
// Handles: # / ## / ### headings, **bold**, *italic*, `code`,
// > blockquotes, --- hr, unordered lists, fenced ``` blocks, and
// pipe-style tables with a header-separator row.
const renderInline = (text) => {
  // Escape HTML first, then re-introduce the markdown markup we support.
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
};

const splitRow = (row) => row.split('|').slice(1, -1).map((c) => c.trim());

const Markdown = ({ src }) => {
  const blocks = useMemo(() => {
    const lines = (src || '').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];

      // Fenced code block
      if (ln.startsWith('```')) {
        const buf = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          buf.push(lines[i]); i++;
        }
        i++; // consume closing fence
        out.push({ type: 'code', text: buf.join('\n') });
        continue;
      }

      // Pipe table (needs a separator row underneath the header)
      if (ln.startsWith('|') && lines[i + 1] && /^\|[\s:|-]+\|/.test(lines[i + 1])) {
        const header = splitRow(ln);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].startsWith('|')) {
          rows.push(splitRow(lines[i])); i++;
        }
        out.push({ type: 'table', header, rows });
        continue;
      }

      // Headings
      const h = /^(#{1,6})\s+(.*)/.exec(ln);
      if (h) { out.push({ type: 'h', level: h[1].length, text: h[2] }); i++; continue; }

      // Horizontal rule
      if (/^---+$/.test(ln.trim())) { out.push({ type: 'hr' }); i++; continue; }

      // Unordered list (contiguous lines starting with - or *)
      if (/^\s*[-*]\s+/.test(ln)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
          i++;
        }
        out.push({ type: 'ul', items });
        continue;
      }

      // Blockquote
      if (ln.startsWith('>')) {
        const buf = [ln.replace(/^>\s?/, '')];
        i++;
        while (i < lines.length && lines[i].startsWith('>')) {
          buf.push(lines[i].replace(/^>\s?/, '')); i++;
        }
        out.push({ type: 'quote', text: buf.join(' ') });
        continue;
      }

      // Empty line → paragraph break
      if (!ln.trim()) { out.push({ type: 'br' }); i++; continue; }

      // Default: paragraph (collect contiguous non-empty non-special lines)
      const para = [ln];
      i++;
      while (i < lines.length && lines[i].trim()
        && !lines[i].startsWith('#')
        && !lines[i].startsWith('|')
        && !lines[i].startsWith('```')
        && !/^---+$/.test(lines[i].trim())
        && !/^\s*[-*]\s+/.test(lines[i])
        && !lines[i].startsWith('>')) {
        para.push(lines[i]); i++;
      }
      out.push({ type: 'p', text: para.join(' ') });
    }
    return out;
  }, [src]);

  const h = (lvl) => ({
    fontFamily: 'Georgia, serif',
    fontSize: lvl === 1 ? 32 : lvl === 2 ? 24 : lvl === 3 ? 18 : 15,
    fontWeight: 700, lineHeight: 1.2,
    margin: lvl === 1 ? '0 0 14px' : lvl === 2 ? '36px 0 12px' : '22px 0 8px',
    letterSpacing: lvl === 1 ? '-0.02em' : '-0.01em',
    color: 'var(--ink, #F2EBE0)',
  });

  return (
    <article data-testid="runbook-md" style={{ maxWidth: 880 }}>
      {blocks.map((b, i) => {
        if (b.type === 'h') return <h1 key={i} style={h(b.level)} dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />;
        if (b.type === 'hr') return <hr key={i} style={{ border: 0, borderTop: '1px solid var(--border, #2a2722)', margin: '32px 0' }} />;
        if (b.type === 'p') return <p key={i} style={{ fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.65, color: 'var(--ink-soft, #D8CDB9)', margin: '0 0 14px' }} dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />;
        if (b.type === 'br') return null;
        if (b.type === 'quote') return <blockquote key={i} style={{ borderLeft: '3px solid #E8C26E', padding: '4px 14px', margin: '14px 0', fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted, #9C8B6B)', fontStyle: 'italic' }} dangerouslySetInnerHTML={{ __html: renderInline(b.text) }} />;
        if (b.type === 'code') return <pre key={i} style={{ background: '#0B0A09', border: '1px solid var(--border)', padding: 14, overflowX: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.6, color: '#F2EBE0', margin: '14px 0' }}>{b.text}</pre>;
        if (b.type === 'ul') return (
          <ul key={i} style={{ fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.65, color: 'var(--ink-soft, #D8CDB9)', margin: '0 0 14px', paddingLeft: 22 }}>
            {b.items.map((it, j) => <li key={j} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: renderInline(it) }} />)}
          </ul>
        );
        if (b.type === 'table') return (
          <div key={i} style={{ overflowX: 'auto', margin: '14px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
              <thead><tr style={{ background: '#13110d' }}>
                {b.header.map((c, j) => (
                  <th key={j} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}
                      dangerouslySetInnerHTML={{ __html: renderInline(c) }} />
                ))}
              </tr></thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((c, j) => (
                      <td key={j} style={{ padding: '8px 12px', fontFamily: j === 0 ? 'ui-monospace, monospace' : 'Georgia, serif', fontSize: j === 0 ? 11.5 : 13, color: j === 0 ? 'var(--ink)' : 'var(--ink-soft)', borderBottom: '1px solid var(--border)' }}
                          dangerouslySetInnerHTML={{ __html: renderInline(c) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        return null;
      })}
    </article>
  );
};


const BackOfficeRunbook = () => {
  const ctx = useOutletContext() || {};
  const inShell = !!ctx.token;
  const [token, setToken] = useState(() => ctx.token || (typeof window !== 'undefined' && window.localStorage.getItem(TOKEN_KEY)) || '');
  useEffect(() => { if (ctx.token && ctx.token !== token) setToken(ctx.token); }, [ctx.token, token]);
  const [md, setMd] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    setBusy(true); setErr(null);
    fetch(`${BACKEND}/api/admin/docs/runbook`, { headers: { 'X-Admin-Token': token } })
      .then((r) => r.ok ? r.json() : Promise.reject(`auth ${r.status}`))
      .then((b) => setMd(b.markdown))
      .catch((e) => setErr(String(e)))
      .finally(() => setBusy(false));
  }, [token]);

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #0B0A09)', color: 'var(--ink, #F2EBE0)', padding: 48 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, margin: '0 0 24px' }}>Operator&apos;s runbook</h1>
        <input type="password" placeholder="Admin token"
          onChange={(e) => setToken(e.target.value)}
          data-testid="runbook-token-input"
          style={{ padding: 12, width: 340, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border, #2a2722)', fontFamily: 'ui-monospace, monospace' }} />
        <button onClick={() => window.localStorage.setItem(TOKEN_KEY, token)}
          data-testid="runbook-login"
          style={{ marginLeft: 8, padding: '12px 22px', background: '#E8C26E', color: '#0B0A09', border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', fontWeight: 800, cursor: 'pointer' }}>
          UNLOCK
        </button>
      </div>
    );
  }

  return (
    <div data-testid="runbook-page" style={inShell ? {} : {
      minHeight: '100vh', background: 'var(--bg, #0B0A09)', color: 'var(--ink, #F2EBE0)',
      padding: '32px 28px 80px', maxWidth: 960, margin: '0 auto',
    }}>
      {!inShell && (
        <Link to="/back-office/bot-routing" data-testid="runbook-back"
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted, #9C8B6B)', textDecoration: 'none' }}>← BOT & ROUTING</Link>
      )}
      {busy && <div data-testid="runbook-loading" style={{ marginTop: 24, fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--muted)' }}>Loading…</div>}
      {err && <div data-testid="runbook-error" style={{ marginTop: 24, padding: 12, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#FF8A7F', fontFamily: 'ui-monospace, monospace' }}>{err}</div>}
      {md && <div style={{ marginTop: 16 }}><Markdown src={md} /></div>}
    </div>
  );
};

export default BackOfficeRunbook;
