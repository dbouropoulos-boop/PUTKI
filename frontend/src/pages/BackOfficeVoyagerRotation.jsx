/**
 * BackOfficeVoyagerRotation - edits the /voyager weekly rotation calendar.
 *
 * Backend: GET/PUT /api/admin/voyager/rotation
 *   { raw, sanitised, defaults, updated_at }
 *
 * UI shape: a left-side list of weeks (with an "active" radio) and a
 * right-side form to edit the currently-selected week. Each save is
 * an atomic overwrite of the full rotation doc - that's intentional;
 * the editor's intent ("ship this calendar exactly") wins.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';
import { adminFetch } from '../lib/fetchAdmin';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// ── Atoms (deliberately local - small page, no need to extract) ────────
const Field = ({ label, value, onChange, multiline, placeholder, type = 'text', idScope }) => {
  const id = `voy-${idScope}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
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
        <input id={id} data-testid={id} type={type} value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={sharedStyle} />
      )}
    </label>
  );
};

const Row = ({ children, cols = 2 }) => (
  <div style={{
    display: 'grid', gap: 12, marginBottom: 12,
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  }}>{children}</div>
);

const Card = ({ children, label }) => (
  <div style={{
    background: 'var(--surface)', border: '1px solid var(--border)',
    padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
    marginBottom: 16,
  }}>
    {label && (
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.2em', color: '#FFBF6B', fontWeight: 700,
        textTransform: 'uppercase',
      }}>{label}</div>
    )}
    {children}
  </div>
);

const slugify = (s) => (s || '').toLowerCase().trim()
  .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// ── Page ───────────────────────────────────────────────────────────────
const BackOfficeVoyagerRotation = () => {
  const { token, authed, authError, checkAuth, setToken } = useBackOfficeToken();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json', 'X-Admin-Token': token,
  }), [token]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setStatus('Loading…');
    try {
      const r = await adminFetch(`/api/admin/voyager/rotation`, { headers });
      if (!r.ok) { setStatus(`Load failed (${r.status})`); return; }
      const j = await r.json();
      setData(j);
      const cloned = structuredClone(j.sanitised);
      setForm(cloned);
      setSelectedSlug(cloned.active_slug || (cloned.weeks[0] && cloned.weeks[0].slug));
      setStatus(j.updated_at ? `Loaded · last save ${new Date(j.updated_at).toLocaleString()}` : 'Loaded · using defaults');
    } catch (e) {
      console.warn('[voyager-admin] fetch failed', e);
      setStatus(`Error: ${e.message}`);
    }
  }, [token, headers]);

  useEffect(() => { if (authed) fetchAll(); }, [authed, fetchAll]);

  const save = async () => {
    if (!form) return;
    setSaving(true); setStatus('Saving…');
    try {
      const r = await adminFetch(`/api/admin/voyager/rotation`, {
        method: 'PUT', headers, body: JSON.stringify(form)});
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setStatus(`Save failed: ${j.detail || r.status}`);
        return;
      }
      const j = await r.json();
      setData(j);
      setForm(structuredClone(j.sanitised));
      setStatus(`✓ Saved · ${new Date(j.updated_at).toLocaleString()}`);
    } catch (e) {
      console.warn('[voyager-admin] save failed', e);
      setStatus(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addWeek = () => {
    if (!form) return;
    const idx = form.weeks.length;
    const newWeek = {
      slug: slugify(`week-${idx + 1}-${Date.now().toString(36).slice(-4)}`),
      week_label_fi: `VIIKKO ${idx + 1}`,
      week_label_en: `WEEK ${idx + 1}`,
      next_rotation_iso: '',
      game: { title_fi: '', title_en: '', template_id: 0, brand_key: '', visitor_key: '' },
      operator: { name: '', redirect_url: '', partnership_label: true },
      prize: { label_fi: 'ilmaiskierrosta', label_en: 'free spins', min: 5, max: 20, slot_fi: '', slot_en: '' },
      verdict_fi: '', verdict_en: '', tried_fi: '', tried_en: '',
      review_points: [{ headline_fi: '', headline_en: '', body_fi: '', body_en: '' }],
    };
    setForm({ ...form, weeks: [...form.weeks, newWeek] });
    setSelectedSlug(newWeek.slug);
  };

  const deleteWeek = (slug) => {
    if (!form || form.weeks.length <= 1) {
      setStatus('At least one week is required.');
      return;
    }
    const weeks = form.weeks.filter((w) => w.slug !== slug);
    const next = {
      ...form,
      weeks,
      active_slug: form.active_slug === slug ? weeks[0].slug : form.active_slug,
    };
    setForm(next);
    setSelectedSlug(next.active_slug);
  };

  const setActive = (slug) => {
    if (!form) return;
    setForm({ ...form, active_slug: slug });
  };

  const updateSelected = (mutator) => {
    if (!form) return;
    const weeks = form.weeks.map((w) =>
      w.slug === selectedSlug ? mutator(w) : w
    );
    setForm({ ...form, weeks });
  };

  // ── Auth gate ──────────────────────────────────────────────────────
  if (!authed) {
    return null; // iter84: legacy AuthGate dead-stripped (shell handles auth)
  }
  if (!form) {
    return (
      <div style={{ padding: 40, color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
        {status || 'Loading Voyager rotation…'}
      </div>
    );
  }

  const selected = form.weeks.find((w) => w.slug === selectedSlug) || form.weeks[0];
  return (
    <div data-testid="back-office-voyager-rotation" style={{
      maxWidth: 1200, margin: '0 auto', padding: '32px 24px 120px',
      color: 'var(--ink)', fontFamily: 'Inter, sans-serif',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 16, marginBottom: 24, flexWrap: 'wrap',
      }}>
        <div>
          <Link to="/back-office" data-testid="back-office-back-link" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.22em', color: 'var(--muted)',
            textDecoration: 'none', textTransform: 'uppercase', fontWeight: 700,
          }}>← BACK-OFFICE</Link>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700,
            margin: '12px 0 4px', color: 'var(--ink)', letterSpacing: '-0.015em',
          }}>Voyager rotation calendar</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            The week marked <strong style={{ color: '#FFBF6B' }}>ACTIVE</strong> is
            what renders on <code>/voyager</code>. Saves apply within ~1s.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            letterSpacing: '0.12em', color: 'var(--muted)',
          }} data-testid="voy-status">{status}</span>
          <Link to="/game" target="_blank" rel="noopener noreferrer"
            data-testid="voy-preview-link"
            style={{
              padding: '10px 16px', background: 'transparent', color: 'var(--ink)',
              border: '1px solid var(--border-strong)', textDecoration: 'none',
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
            }}>OPEN /VOYAGER ↗</Link>
          <button type="button" onClick={save} disabled={saving}
            data-testid="voy-save"
            style={{
              padding: '10px 18px', background: '#FFBF6B', color: '#0B0A09',
              border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
              fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
              cursor: saving ? 'wait' : 'pointer',
            }}>{saving ? 'SAVING…' : 'SAVE ALL'}</button>
        </div>
      </div>

      <div style={{
        display: 'grid', gap: 24,
        gridTemplateColumns: 'minmax(220px, 280px) 1fr',
      }}>
        {/* LEFT: week list */}
        <aside data-testid="voy-week-list" style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          padding: 14, height: 'fit-content', position: 'sticky', top: 16,
        }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
            textTransform: 'uppercase', marginBottom: 12,
          }}>WEEKS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {form.weeks.map((w) => {
              const isActive = w.slug === form.active_slug;
              const isSelected = w.slug === selectedSlug;
              return (
                <div key={w.slug} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 10px',
                  background: isSelected ? 'var(--bg)' : 'transparent',
                  border: `1px solid ${isSelected ? 'var(--border-strong)' : 'transparent'}`,
                  cursor: 'pointer',
                }}>
                  <input type="radio" name="voy-active"
                    data-testid={`voy-active-radio-${w.slug}`}
                    checked={isActive}
                    onChange={() => setActive(w.slug)}
                    style={{ accentColor: '#FFBF6B' }}
                    aria-label={`Set ${w.slug} active`} />
                  <button type="button" onClick={() => setSelectedSlug(w.slug)}
                    data-testid={`voy-week-select-${w.slug}`}
                    style={{
                      flex: 1, background: 'transparent', border: 0, padding: 0,
                      textAlign: 'left', color: 'var(--ink)', cursor: 'pointer',
                      fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
                      letterSpacing: '0.04em',
                    }}>
                    <div style={{ fontWeight: 700, color: isActive ? '#FFBF6B' : 'var(--ink)' }}>
                      {w.week_label_fi || w.slug}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>
                      {w.game.title_fi || '-'} × {w.operator.name || '-'}
                    </div>
                  </button>
                  <button type="button" onClick={() => deleteWeek(w.slug)}
                    data-testid={`voy-week-delete-${w.slug}`}
                    aria-label={`Delete ${w.slug}`}
                    title="Delete week"
                    style={{
                      background: 'transparent', border: 0, cursor: 'pointer',
                      color: 'var(--muted)', fontSize: 14, padding: 4,
                    }}>×</button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={addWeek}
            data-testid="voy-add-week"
            style={{
              marginTop: 14, width: '100%', padding: '10px 12px',
              background: 'transparent', color: 'var(--ink)',
              border: '1px dashed var(--border-strong)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
              letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer',
              textTransform: 'uppercase',
            }}>+ ADD WEEK</button>
        </aside>

        {/* RIGHT: editor */}
        <section data-testid="voy-editor" key={selected.slug}>
          <Card label={selected.slug === form.active_slug ? 'EDITING · ACTIVE' : 'EDITING'}>
            <Row cols={3}>
              <Field label="Slug" value={selected.slug} idScope="meta"
                onChange={(v) => updateSelected((w) => ({ ...w, slug: slugify(v) }))} />
              <Field label="Week label (FI)" value={selected.week_label_fi} idScope="meta-fi"
                onChange={(v) => updateSelected((w) => ({ ...w, week_label_fi: v }))} />
              <Field label="Week label (EN)" value={selected.week_label_en} idScope="meta-en"
                onChange={(v) => updateSelected((w) => ({ ...w, week_label_en: v }))} />
            </Row>
            <Field label="Next rotation ISO (e.g. 2026-05-27T09:00:00+03:00)"
              value={selected.next_rotation_iso} idScope="meta-iso"
              onChange={(v) => updateSelected((w) => ({ ...w, next_rotation_iso: v }))} />
          </Card>

          <Card label="GAME (Smartico)">
            <Row>
              <Field label="Title (FI)" value={selected.game.title_fi} idScope="game-fi"
                onChange={(v) => updateSelected((w) => ({ ...w, game: { ...w.game, title_fi: v } }))} />
              <Field label="Title (EN)" value={selected.game.title_en} idScope="game-en"
                onChange={(v) => updateSelected((w) => ({ ...w, game: { ...w.game, title_en: v } }))} />
            </Row>
            <Row cols={3}>
              <Field label="Template ID" type="number" value={selected.game.template_id} idScope="game-tpl"
                onChange={(v) => updateSelected((w) => ({ ...w, game: { ...w.game, template_id: Number(v) || 0 } }))} />
              <Field label="Brand key" value={selected.game.brand_key} idScope="game-brand"
                onChange={(v) => updateSelected((w) => ({ ...w, game: { ...w.game, brand_key: v } }))} />
              <Field label="Visitor key" value={selected.game.visitor_key} idScope="game-visitor"
                onChange={(v) => updateSelected((w) => ({ ...w, game: { ...w.game, visitor_key: v } }))} />
            </Row>
          </Card>

          <Card label="OPERATOR">
            <Row>
              <Field label="Operator name" value={selected.operator.name} idScope="op-name"
                onChange={(v) => updateSelected((w) => ({ ...w, operator: { ...w.operator, name: v } }))} />
              <Field label="Redirect URL (UUID is appended automatically)"
                value={selected.operator.redirect_url} idScope="op-url"
                onChange={(v) => updateSelected((w) => ({ ...w, operator: { ...w.operator, redirect_url: v } }))} />
            </Row>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.12em', color: 'var(--ink)', fontWeight: 600,
            }}>
              <input type="checkbox"
                data-testid="voy-partnership-toggle"
                checked={!!selected.operator.partnership_label}
                onChange={(e) => updateSelected((w) => ({
                  ...w, operator: { ...w.operator, partnership_label: e.target.checked },
                }))} />
              Show "Yhteistyössä …" partnership label
            </label>
          </Card>

          <Card label="PRIZE (real free spins · variance range)">
            <Row cols={2}>
              <Field label="Label (FI)" value={selected.prize.label_fi} idScope="prize-label-fi"
                onChange={(v) => updateSelected((w) => ({ ...w, prize: { ...w.prize, label_fi: v } }))} />
              <Field label="Label (EN)" value={selected.prize.label_en} idScope="prize-label-en"
                onChange={(v) => updateSelected((w) => ({ ...w, prize: { ...w.prize, label_en: v } }))} />
            </Row>
            <Row cols={4}>
              <Field label="Min" type="number" value={selected.prize.min} idScope="prize-min"
                onChange={(v) => updateSelected((w) => ({ ...w, prize: { ...w.prize, min: Number(v) || 0 } }))} />
              <Field label="Max" type="number" value={selected.prize.max} idScope="prize-max"
                onChange={(v) => updateSelected((w) => ({ ...w, prize: { ...w.prize, max: Number(v) || 0 } }))} />
              <Field label="Slot (FI)" value={selected.prize.slot_fi} idScope="prize-slot-fi"
                onChange={(v) => updateSelected((w) => ({ ...w, prize: { ...w.prize, slot_fi: v } }))} />
              <Field label="Slot (EN)" value={selected.prize.slot_en} idScope="prize-slot-en"
                onChange={(v) => updateSelected((w) => ({ ...w, prize: { ...w.prize, slot_en: v } }))} />
            </Row>
          </Card>

          <Card label="EDITORIAL VERDICT + 'KOKEILIMME ITSE'">
            <Row>
              <Field label="Verdict (FI)" multiline value={selected.verdict_fi} idScope="verdict-fi"
                onChange={(v) => updateSelected((w) => ({ ...w, verdict_fi: v }))} />
              <Field label="Verdict (EN)" multiline value={selected.verdict_en} idScope="verdict-en"
                onChange={(v) => updateSelected((w) => ({ ...w, verdict_en: v }))} />
            </Row>
            <Row>
              <Field label="Tried-it line (FI)" multiline value={selected.tried_fi} idScope="tried-fi"
                onChange={(v) => updateSelected((w) => ({ ...w, tried_fi: v }))} />
              <Field label="Tried-it line (EN)" multiline value={selected.tried_en} idScope="tried-en"
                onChange={(v) => updateSelected((w) => ({ ...w, tried_en: v }))} />
            </Row>
          </Card>

          <Card label="OPERATOR REVIEW POINTS (every claim specific & checkable)">
            {selected.review_points.map((rp, i) => (
              <div key={`rp-slot-${i}`} style={{
                padding: 12, border: '1px solid var(--border)', background: 'var(--bg)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
                  }}>POINT {i + 1}</span>
                  <button type="button" onClick={() => updateSelected((w) => ({
                    ...w, review_points: w.review_points.filter((_, j) => j !== i),
                  }))}
                    data-testid={`voy-rp-delete-${i}`}
                    style={{
                      background: 'transparent', border: 0, cursor: 'pointer',
                      color: 'var(--muted)', fontFamily: 'ui-monospace, monospace',
                      fontSize: 10, letterSpacing: '0.16em', fontWeight: 700,
                    }}>× REMOVE</button>
                </div>
                <Row>
                  <Field label="Headline (FI)" value={rp.headline_fi} idScope={`rp-${i}-h-fi`}
                    onChange={(v) => updateSelected((w) => ({
                      ...w, review_points: w.review_points.map((p, j) => j === i ? { ...p, headline_fi: v } : p),
                    }))} />
                  <Field label="Headline (EN)" value={rp.headline_en} idScope={`rp-${i}-h-en`}
                    onChange={(v) => updateSelected((w) => ({
                      ...w, review_points: w.review_points.map((p, j) => j === i ? { ...p, headline_en: v } : p),
                    }))} />
                </Row>
                <Row>
                  <Field label="Body (FI)" multiline value={rp.body_fi} idScope={`rp-${i}-b-fi`}
                    onChange={(v) => updateSelected((w) => ({
                      ...w, review_points: w.review_points.map((p, j) => j === i ? { ...p, body_fi: v } : p),
                    }))} />
                  <Field label="Body (EN)" multiline value={rp.body_en} idScope={`rp-${i}-b-en`}
                    onChange={(v) => updateSelected((w) => ({
                      ...w, review_points: w.review_points.map((p, j) => j === i ? { ...p, body_en: v } : p),
                    }))} />
                </Row>
              </div>
            ))}
            {selected.review_points.length < 6 && (
              <button type="button" onClick={() => updateSelected((w) => ({
                ...w,
                review_points: [
                  ...w.review_points,
                  { headline_fi: '', headline_en: '', body_fi: '', body_en: '' },
                ],
              }))}
                data-testid="voy-rp-add"
                style={{
                  padding: '10px 12px', background: 'transparent', color: 'var(--ink)',
                  border: '1px dashed var(--border-strong)',
                  fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                  letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer',
                  textTransform: 'uppercase',
                }}>+ ADD REVIEW POINT</button>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
};

export default BackOfficeVoyagerRotation;
