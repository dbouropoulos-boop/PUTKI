/**
 * BackOfficeOgImages - admin page for inspecting + managing Open Graph
 * social-share cards.
 *
 * Surfaces three controls on top of the existing og_image_generator and
 * /api/admin/og-images/* admin router:
 *   - Preview the current OG card for any article slug
 *   - Regenerate via Gemini Nano Banana (force re-render)
 *   - Upload a custom PNG/JPG/WEBP for a specific slug
 *
 * Renders inside <BackOfficeShell /> via Outlet context, so auth comes
 * from the shared token and no per-page AuthGate is needed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Image as ImageIcon, RefreshCcw, Upload, Trash2, Search, Sparkles } from 'lucide-react';
import { adminFetch } from '../lib/fetchAdmin';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

const Pill = ({ label, value, testid }) => (
  <div data-testid={testid} style={{
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '6px 12px', background: 'var(--surface)',
    border: '1px solid var(--line)', borderRadius: 999,
    fontFamily: MONO, fontSize: 10.5,
  }}>
    <span style={{
      color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.14em',
      textTransform: 'uppercase', fontSize: 9.5,
    }}>{label}</span>
    <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{value}</span>
  </div>
);

const BackOfficeOgImages = () => {
  const { token } = useOutletContext() || {};
  const [slug, setSlug] = useState('');
  const [headline, setHeadline] = useState('');
  const [category, setCategory] = useState('');
  const [preview, setPreview] = useState(null);
  const [cached, setCached] = useState({ items: [], count: 0, enabled: false });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const fileInput = useRef(null);

  const headers = useMemo(() => ({ 'X-Admin-Token': token || '' }), [token]);

  const refreshList = useCallback(async () => {
    if (!token) return;
    try {
      const r = await adminFetch(`/api/admin/og-images/list?limit=200`, { headers });
      if (r.ok) setCached(await r.json());
    } catch { /* swallow */ }
  }, [token, headers]);

  useEffect(() => { refreshList(); }, [refreshList]);

  const doPreview = async (override) => {
    const target = (override ?? (slug || '')).trim();
    if (!target) { setFeedback({ ok: false, text: 'Enter a slug first.' }); return; }
    setBusy(true); setFeedback(null);
    try {
      const r = await fetch(
        `${BACKEND}/api/admin/og-images/preview?slug=${encodeURIComponent(target)}`,
        { headers },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setPreview(data); setSlug(data.slug);
      setFeedback({ ok: true, text: data.exists ? 'Cached card found.' : 'No cached card yet for this slug.' });
    } catch (e) {
      setFeedback({ ok: false, text: `Preview failed: ${String(e?.message || e)}` });
    } finally { setBusy(false); }
  };

  const doRegenerate = async () => {
    if (!slug.trim()) { setFeedback({ ok: false, text: 'Enter a slug first.' }); return; }
    if (!headline.trim()) { setFeedback({ ok: false, text: 'Headline required for regeneration.' }); return; }
    setBusy(true); setFeedback(null);
    try {
      const r = await adminFetch(`/api/admin/og-images/regenerate`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },body: JSON.stringify({ slug: slug.trim(), headline: headline.trim(), category: category.trim() || null })});
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`HTTP ${r.status}: ${txt}`);
      }
      const data = await r.json();
      setFeedback({
        ok: !!data.url,
        text: data.url
          ? `Regenerated · ${data.url}`
          : 'Generator returned no URL (LLM budget exhausted or category fallback hit).',
      });
      await doPreview(data.slug);
      await refreshList();
    } catch (e) {
      setFeedback({ ok: false, text: `Regenerate failed: ${String(e?.message || e)}` });
    } finally { setBusy(false); }
  };

  const doUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!slug.trim()) { setFeedback({ ok: false, text: 'Enter a slug first.' }); e.target.value = ''; return; }
    setBusy(true); setFeedback(null);
    try {
      const fd = new FormData();
      fd.append('slug', slug.trim());
      fd.append('file', file);
      const r = await adminFetch(`/api/admin/og-images/upload`, {
        method: 'POST', headers, body: fd});
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`HTTP ${r.status}: ${txt}`);
      }
      const data = await r.json();
      setFeedback({ ok: true, text: `Uploaded · ${(data.size_bytes / 1024).toFixed(1)} KB · ${data.url}` });
      await doPreview(data.slug);
      await refreshList();
    } catch (e2) {
      setFeedback({ ok: false, text: `Upload failed: ${String(e2?.message || e2)}` });
    } finally {
      setBusy(false);
      if (e.target) e.target.value = '';
    }
  };

  const doDelete = async (target) => {
    if (!target) return;
    setBusy(true); setFeedback(null);
    try {
      const r = await adminFetch(`/api/admin/og-images/${encodeURIComponent(target)}`, {
        method: 'DELETE', headers});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setFeedback({ ok: true, text: data.deleted ? `Deleted ${target}` : `No cached file for ${target}` });
      if (preview?.slug === target) setPreview({ ...preview, exists: false, url: null });
      await refreshList();
    } catch (e) {
      setFeedback({ ok: false, text: `Delete failed: ${String(e?.message || e)}` });
    } finally { setBusy(false); }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: 'var(--bg)',
    color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: 4,
    fontFamily: MONO, fontSize: 13, boxSizing: 'border-box',
  };

  const btnPrimary = {
    padding: '10px 16px', background: 'var(--ember)', color: '#FFFFFF',
    border: 0, fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em',
    fontWeight: 700, cursor: busy ? 'wait' : 'pointer', borderRadius: 4,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    opacity: busy ? 0.65 : 1, transition: 'opacity 100ms ease',
  };
  const btnSecondary = {
    ...btnPrimary, background: 'transparent', color: 'var(--ink)',
    border: '1px solid var(--line-strong)',
  };

  return (
    <div data-testid="bo-og-images-page">
      <header style={{ marginBottom: 22 }}>
        <h1 style={{
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: 28,
          fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)',
        }}>OG images</h1>
        <p style={{
          color: 'var(--ink-3)', fontFamily: MONO, fontSize: 11,
          letterSpacing: '0.06em', marginTop: 6,
        }}>
          Preview · regenerate via Gemini Nano Banana · upload custom card per article slug.
        </p>
      </header>

      {/* Summary */}
      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <Pill testid="og-pill-cached" label="CACHED CARDS" value={cached.count} />
        <Pill testid="og-pill-status" label="GENERATOR"
          value={cached.enabled ? 'READY' : 'DISABLED (no key)'} />
      </section>

      {/* Controls */}
      <section style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 6, padding: 20, marginBottom: 24,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label data-testid="og-input-slug-label" style={{
              display: 'block', fontFamily: MONO, fontSize: 10.5,
              letterSpacing: '0.14em', color: 'var(--ink-3)', fontWeight: 700,
              textTransform: 'uppercase', marginBottom: 6,
            }}>ARTICLE SLUG</label>
            <input data-testid="og-input-slug" value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="esim. veikkauksen-monopoli-purkautuu"
              style={inputStyle} />
          </div>
          <div>
            <label style={{
              display: 'block', fontFamily: MONO, fontSize: 10.5,
              letterSpacing: '0.14em', color: 'var(--ink-3)', fontWeight: 700,
              textTransform: 'uppercase', marginBottom: 6,
            }}>CATEGORY (optional)</label>
            <input data-testid="og-input-category" value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="urheilijat | striimaajat | saannot | kasinot | raha"
              style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block', fontFamily: MONO, fontSize: 10.5,
            letterSpacing: '0.14em', color: 'var(--ink-3)', fontWeight: 700,
            textTransform: 'uppercase', marginBottom: 6,
          }}>HEADLINE (used by generator)</label>
          <input data-testid="og-input-headline" value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="The exact headline Nano Banana sees"
            style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button data-testid="og-btn-preview" onClick={() => doPreview()}
            disabled={busy} style={btnSecondary}>
            <Search size={12} /> PREVIEW
          </button>
          <button data-testid="og-btn-regenerate" onClick={doRegenerate}
            disabled={busy} style={btnPrimary}>
            <Sparkles size={12} /> REGENERATE
          </button>
          <input ref={fileInput} type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={doUpload}
            data-testid="og-file-input"
            style={{ display: 'none' }} />
          <button data-testid="og-btn-upload"
            onClick={() => fileInput.current?.click()}
            disabled={busy} style={btnSecondary}>
            <Upload size={12} /> UPLOAD CUSTOM
          </button>
        </div>

        {feedback && (
          <div data-testid="og-feedback" style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 4,
            fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em',
            background: feedback.ok ? 'var(--ember-soft)' : '#FBEDEC',
            color: feedback.ok ? 'var(--ember-strong)' : 'var(--dial-myrsky)',
            border: `1px solid ${feedback.ok ? 'var(--ember-soft)' : '#F5C4BF'}`,
            wordBreak: 'break-all',
          }}>{feedback.text}</div>
        )}
      </section>

      {/* Preview panel */}
      {preview && (
        <section data-testid="og-preview-section" style={{
          background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6,
          padding: 20, marginBottom: 24,
        }}>
          <div style={{
            fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em',
            color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase',
            marginBottom: 12,
          }}>CURRENT CARD · {preview.slug}</div>
          {preview.exists && preview.url ? (
            <img src={preview.url}
              alt={`OG card for ${preview.slug}`}
              data-testid="og-preview-img"
              style={{
                maxWidth: '100%', height: 'auto', border: '1px solid var(--line)',
                borderRadius: 4, display: 'block',
              }} />
          ) : (
            <div style={{
              padding: '32px 16px', background: 'var(--surface)',
              border: '1px dashed var(--line-strong)', borderRadius: 4,
              fontFamily: MONO, fontSize: 12, color: 'var(--ink-3)',
              textAlign: 'center',
            }}>
              No cached card yet. Click REGENERATE or UPLOAD CUSTOM above.
            </div>
          )}
        </section>
      )}

      {/* Cached list */}
      <section data-testid="og-cached-section">
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
        }}>
          <h2 style={{
            fontFamily: 'Inter, system-ui, sans-serif', fontSize: 18,
            fontWeight: 700, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)',
          }}>Cached cards</h2>
          <span style={{
            fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em',
            color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase',
          }}>· {cached.count}</span>
          <span style={{ flex: 1 }} />
          <button data-testid="og-btn-refresh" onClick={refreshList}
            style={{ ...btnSecondary, fontSize: 10 }}>
            <RefreshCcw size={11} /> REFRESH
          </button>
        </header>
        {cached.items.length === 0 ? (
          <div style={{
            padding: '24px 16px', background: 'var(--surface)',
            border: '1px dashed var(--line)', borderRadius: 4,
            fontFamily: MONO, fontSize: 11, color: 'var(--ink-3)',
            textAlign: 'center',
          }}>No cached cards yet.</div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}>
            {cached.items.map((item) => (
              <article key={item.slug} data-testid={`og-card-${item.slug}`}
                style={{
                  background: 'var(--bg)', border: '1px solid var(--line)',
                  borderRadius: 6, padding: 12,
                }}>
                <img src={item.url} alt={`OG card for ${item.slug}`}
                  loading="lazy"
                  style={{
                    width: '100%', height: 'auto', border: '1px solid var(--line)',
                    borderRadius: 4, display: 'block', marginBottom: 8,
                  }} />
                <div style={{
                  fontFamily: MONO, fontSize: 10.5, color: 'var(--ink)',
                  fontWeight: 600, marginBottom: 4, wordBreak: 'break-all',
                }}>{item.slug}</div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.08em',
                  color: 'var(--ink-3)',
                }}>
                  <span>{(item.size_bytes / 1024).toFixed(0)} KB</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => doPreview(item.slug)}
                      data-testid={`og-card-${item.slug}-preview`}
                      style={{
                        background: 'transparent', border: '1px solid var(--line)',
                        color: 'var(--ink)', cursor: 'pointer', padding: '3px 8px',
                        fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em',
                        borderRadius: 3, textTransform: 'uppercase',
                      }}>USE</button>
                    <button onClick={() => doDelete(item.slug)}
                      data-testid={`og-card-${item.slug}-delete`}
                      style={{
                        background: 'transparent', border: '1px solid var(--line)',
                        color: 'var(--dial-myrsky)', cursor: 'pointer', padding: '3px 6px',
                        borderRadius: 3, display: 'inline-flex', alignItems: 'center',
                      }}><Trash2 size={11} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default BackOfficeOgImages;
