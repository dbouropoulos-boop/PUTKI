/**
 * BackOfficeMittariCopy — every line on /mittari is editable here.
 *
 * Data source: GET /api/admin/mittari/copy returns
 *   { raw, merged, defaults, updated_at }
 *   - `raw` = user override doc (what's actually persisted)
 *   - `merged` = effective copy tree the public endpoint serves
 *   - `defaults` = stock copy (fallback for any missing field)
 *
 * We start the form bound to `merged` so users see exactly what the page
 * is showing right now. Submit issues PUT /api/admin/mittari/copy with
 * the entire form payload. Backend sanitises + caps each field, so a
 * paste-bomb in any cell self-recovers on the next read.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const SectionTitle = ({ children, sub }) => (
  <div style={{ margin: '36px 0 14px' }}>
    <h2 style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 11,
      letterSpacing: '0.24em', fontWeight: 700, color: 'var(--ink)',
      margin: 0, textTransform: 'uppercase',
    }}>{children}</h2>
    {sub && <p style={{
      margin: '6px 0 0', fontFamily: 'ui-monospace, monospace',
      fontSize: 10.5, color: 'var(--muted)', letterSpacing: '0.04em',
    }}>{sub}</p>}
  </div>
);

const Field = ({ label, value, onChange, multiline, placeholder, idScope }) => {
  const id = `mc-field-${(idScope ? `${idScope}-` : '')}${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
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
          style={{
            background: 'var(--bg, #0B0A09)', color: 'var(--ink, #ECE6D8)',
            border: '1px solid var(--hairline, #221E1B)', padding: '10px 12px',
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
            lineHeight: 1.5, resize: 'vertical', outline: 'none',
          }} />
      ) : (
        <input id={id} data-testid={id} type="text" value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            background: 'var(--bg, #0B0A09)', color: 'var(--ink, #ECE6D8)',
            border: '1px solid var(--hairline, #221E1B)', padding: '9px 12px',
            fontFamily: 'ui-monospace, monospace', fontSize: 12, outline: 'none',
          }} />
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

const LocaleBlock = ({ title, data, defaults, fields, onPatch, scope }) => (
  <div style={{
    background: 'var(--surface, #141210)', border: '1px solid var(--hairline)',
    padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
  }}>
    <div style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 10,
      letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
    }}>{title}</div>
    {fields.map((f) => (
      <Field key={f.key} label={f.label} multiline={f.multiline}
        idScope={scope}
        value={data?.[f.key] ?? ''}
        placeholder={defaults?.[f.key] ?? ''}
        onChange={(v) => onPatch(f.key, v)} />
    ))}
  </div>
);

const HERO_FIELDS = [
  { key: 'section_label', label: 'Eyebrow' },
  { key: 'page_title_lead', label: 'Page title — lead' },
  { key: 'page_title_em', label: 'Page title — emphasised' },
  { key: 'page_title_tail', label: 'Page title — tail' },
  { key: 'page_subtitle', label: 'Page subtitle', multiline: true },
  { key: 'headline_lead', label: 'Headline lead' },
  { key: 'headline_em', label: 'Headline emphasised' },
  { key: 'headline_tail', label: 'Headline tail' },
  { key: 'subline', label: 'Subline', multiline: true },
  { key: 'killer_eyebrow', label: 'Killer-stat eyebrow' },
  { key: 'killer_sub_lead', label: 'Killer-stat sentence lead' },
  { key: 'killer_sub_tail', label: 'Killer-stat sentence tail' },
  { key: 'killer_foot', label: 'Killer-stat footer' },
  { key: 'killer_quiet', label: 'Quiet-market sentence', multiline: true },
  { key: 'countdown_label', label: 'Countdown label' },
  { key: 'meter_state_label', label: 'Meter pill label' },
  { key: 'composite_label', label: 'Composite pill label' },
];
const GATE_FIELDS = [
  { key: 'title_top', label: 'Eyebrow' },
  { key: 'lead', label: 'Telegram block headline' },
  { key: 'one_tap_inline', label: 'One-tap inline tag' },
  { key: 'badge', label: 'Speed badge' },
  { key: 'tg_cta', label: 'Telegram CTA' },
  { key: 'tg_sub', label: 'Telegram sub-line', multiline: true },
  { key: 'or_email', label: 'Email separator label' },
  { key: 'email_placeholder', label: 'Email input placeholder' },
  { key: 'email_cta', label: 'Email submit label' },
  { key: 'fine_print', label: 'Fine print', multiline: true },
  { key: 'revealed_hi', label: 'Post-submit confirmation', multiline: true },
  { key: 'form_err', label: 'Error message' },
  { key: 'form_success', label: 'Success message' },
];
const SIGNALS_FIELDS = [
  { key: 'head_locked_eyebrow', label: 'Locked eyebrow' },
  { key: 'head_unlocked_eyebrow', label: 'Unlocked eyebrow' },
  { key: 'title_lead', label: 'Title lead' },
  { key: 'title_em', label: 'Title emphasised' },
  { key: 'pairing_lead', label: 'Pairing sentence — lead' },
  { key: 'pairing_em', label: 'Pairing sentence — emphasised' },
  { key: 'pairing_tail', label: 'Pairing sentence — tail' },
  { key: 'preview_badge', label: 'Preview badge' },
  { key: 'preview_explainer', label: 'Preview explainer', multiline: true },
  { key: 'market_quiet_eyebrow', label: 'Quiet eyebrow' },
  { key: 'market_quiet_body', label: 'Quiet body', multiline: true },
  { key: 'reveal_teaser', label: 'Reveal-teaser button' },
  { key: 'confidence_label', label: 'Confidence label' },
  { key: 'implied_label', label: 'Implied prob. label' },
  { key: 'implied_inline', label: 'Implied prob. inline' },
  { key: 'locked_foot', label: 'Locked footer' },
  { key: 'unlocked_foot', label: 'Unlocked footer' },
  { key: 'draw_label', label: 'Draw label' },
  { key: 'vs_label', label: '"vs" label' },
  { key: 'band_tight', label: 'Sharpness band 90+' },
  { key: 'band_clear', label: 'Sharpness band 75-89' },
  { key: 'band_mixed', label: 'Sharpness band 60-74' },
  { key: 'band_loose', label: 'Sharpness band 40-59' },
  { key: 'band_scattered', label: 'Sharpness band <40' },
];
const EXPLAIN_TITLE_FIELDS = [{ key: 'title', label: 'Section title' }];
const FEED_FIELDS = [
  ['title', 'Feed title'], ['subscribed', 'Verb between name and channel'],
  ['live', '"Live" indicator'], ['minute', 'minutes-ago suffix'],
  ['just_now', '"Just now"'], ['channel_email', '"Email" channel label'],
];

// ── Main page ──────────────────────────────────────────────────────────
const BackOfficeMittariCopy = () => {
  const { token, authed, authError, checkAuth, setToken } = useBackOfficeToken();
  const [snapshot, setSnapshot] = useState(null);  // {raw, merged, defaults, updated_at}
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const headers = useMemo(() => ({
    'Content-Type': 'application/json', 'X-Admin-Token': token,
  }), [token]);

  const fetchSnapshot = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${BACKEND}/api/admin/mittari/copy`, { headers });
      if (!r.ok) { setStatus(`Load failed (${r.status})`); return; }
      const d = await r.json();
      setSnapshot(d);
      // Seed the form with the currently-effective copy (merged tree).
      setForm(d.merged);
      setStatus('');
    } catch (e) { setStatus(`Network error: ${e.message}`); }
  }, [headers, token]);

  useEffect(() => { if (authed) fetchSnapshot(); }, [authed, fetchSnapshot]);

  const save = useCallback(async () => {
    if (!form) return;
    setBusy(true); setStatus('Saving…');
    try {
      const r = await fetch(`${BACKEND}/api/admin/mittari/copy`, {
        method: 'PUT', headers, body: JSON.stringify(form),
      });
      if (!r.ok) { setStatus(`Save failed (${r.status})`); return; }
      const d = await r.json();
      setSnapshot(d); setForm(d.merged);
      setStatus('✓ Saved · live on /mittari now');
    } catch (e) { setStatus(`Network error: ${e.message}`); }
    finally { setBusy(false); }
  }, [form, headers]);

  const resetSection = useCallback((path) => {
    if (!snapshot) return;
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let dst = next; let src = snapshot.defaults;
      for (let i = 0; i < keys.length - 1; i += 1) {
        dst = dst[keys[i]] = dst[keys[i]] || {};
        src = src[keys[i]] || {};
      }
      dst[keys[keys.length - 1]] = JSON.parse(JSON.stringify(src[keys[keys.length - 1]]));
      return next;
    });
  }, [snapshot]);

  // Update helpers
  const patchLocale = (section, locale, key, value) => {
    setForm((prev) => ({
      ...prev, [section]: {
        ...(prev[section] || {}),
        [locale]: { ...((prev[section] || {})[locale] || {}), [key]: value },
      },
    }));
  };
  const patchExplainStep = (locale, idx, key, value) => {
    setForm((prev) => {
      const exp = prev.explain || {};
      const loc = exp[locale] || {};
      const steps = Array.isArray(loc.steps) ? [...loc.steps] : [];
      while (steps.length < 3) steps.push({ title: '', body: '' });
      steps[idx] = { ...steps[idx], [key]: value };
      return { ...prev, explain: { ...exp, [locale]: { ...loc, steps } } };
    });
  };
  const patchExplainTitle = (locale, value) => {
    setForm((prev) => ({
      ...prev, explain: {
        ...(prev.explain || {}),
        [locale]: { ...((prev.explain || {})[locale] || {}), title: value },
      },
    }));
  };
  const patchTop = (section, key, value) => {
    setForm((prev) => ({ ...prev, [section]: { ...(prev[section] || {}), [key]: value } }));
  };
  const patchListItem = (section, idx, key, value) => {
    setForm((prev) => {
      const sec = prev[section] || {};
      const items = Array.isArray(sec.items) ? [...sec.items] : [];
      items[idx] = { ...(items[idx] || {}), [key]: value };
      return { ...prev, [section]: { ...sec, items } };
    });
  };
  const patchPressItem = (idx, value) => {
    setForm((prev) => {
      const sec = prev.press || {};
      const items = Array.isArray(sec.items) ? [...sec.items] : [];
      items[idx] = value;
      return { ...prev, press: { ...sec, items } };
    });
  };

  if (!authed) return <AuthGate authError={authError} setToken={setToken} onSubmit={checkAuth} />;
  if (!form) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center',
        fontFamily: 'ui-monospace, monospace', color: 'var(--muted)' }}>
        Loading editor…{status && ` · ${status}`}
      </div>
    );
  }

  const D = snapshot?.defaults || {};
  const testis = (form.testimonials?.items) || [];
  const receipts = (form.receipts?.items) || [];
  const press = (form.press?.items) || [];

  return (
    <div data-testid="bo-mittari-copy-page" style={{
      maxWidth: 1280, margin: '0 auto', padding: '40px 32px 120px',
      color: 'var(--ink, #ECE6D8)',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16, marginBottom: 12,
      }}>
        <div>
          <Link to="/back-office" data-testid="bo-back" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            color: 'var(--muted)', letterSpacing: '0.08em', textDecoration: 'none',
          }}>← BACK OFFICE</Link>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 400,
            margin: '6px 0 0', letterSpacing: '-0.02em',
          }}>Mittari · <em style={{ color: '#E89248', fontStyle: 'italic' }}>page copy</em></h1>
          <p style={{
            margin: '6px 0 0', fontFamily: 'ui-monospace, monospace',
            fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em',
          }}>Every line on /mittari. Live on save. {snapshot?.updated_at ? `· last saved ${snapshot.updated_at}` : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/mittari" target="_blank" rel="noopener noreferrer"
            data-testid="bo-mc-view" style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.10em', color: 'var(--ink)',
              padding: '10px 14px', textDecoration: 'none',
              border: '1px solid var(--hairline)',
            }}>VIEW /MITTARI ↗</Link>
          <button type="button" onClick={save} disabled={busy}
            data-testid="bo-mc-save" style={{
              padding: '10px 18px', background: '#E89248', color: '#0A0A0B',
              border: 0, fontFamily: 'ui-monospace, monospace',
              fontSize: 11, fontWeight: 800, letterSpacing: '0.16em',
              cursor: busy ? 'wait' : 'pointer',
            }}>{busy ? 'SAVING…' : 'SAVE & PUBLISH'}</button>
        </div>
      </header>

      {status && (
        <div data-testid="bo-mc-status" style={{
          marginBottom: 12, padding: '10px 14px',
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          color: status.startsWith('✓') ? '#6FA37D' : (status.includes('fail') || status.includes('error')) ? '#C13B2C' : 'var(--ink)',
          letterSpacing: '0.04em',
        }}>{status}</div>
      )}

      {/* HERO */}
      <SectionTitle sub="Signals-led headline, killer-stat band, pills, countdown label">HERO</SectionTitle>
      <Row>
        <LocaleBlock title="FI" scope="hero-fi" data={form.hero?.fi} defaults={D.hero?.fi}
          fields={HERO_FIELDS} onPatch={(k, v) => patchLocale('hero', 'fi', k, v)} />
        <LocaleBlock title="EN" scope="hero-en" data={form.hero?.en} defaults={D.hero?.en}
          fields={HERO_FIELDS} onPatch={(k, v) => patchLocale('hero', 'en', k, v)} />
      </Row>
      <ResetBtn onClick={() => resetSection('hero')} label="Reset hero to defaults" testid="bo-mc-reset-hero" />

      {/* GATE */}
      <SectionTitle sub="Both gates share these strings — Telegram primary + email fallback">GATES (hero + final)</SectionTitle>
      <Row>
        <LocaleBlock title="FI" scope="gate-fi" data={form.gate?.fi} defaults={D.gate?.fi}
          fields={GATE_FIELDS} onPatch={(k, v) => patchLocale('gate', 'fi', k, v)} />
        <LocaleBlock title="EN" scope="gate-en" data={form.gate?.en} defaults={D.gate?.en}
          fields={GATE_FIELDS} onPatch={(k, v) => patchLocale('gate', 'en', k, v)} />
      </Row>
      <Row>
        <BulletsEditor title="FI bullets (3)" values={form.gate?.fi?.bullets}
          defaults={D.gate?.fi?.bullets}
          onChange={(arr) => patchLocale('gate', 'fi', 'bullets', arr)}
          testidPrefix="bo-mc-gate-bullets-fi" />
        <BulletsEditor title="EN bullets (3)" values={form.gate?.en?.bullets}
          defaults={D.gate?.en?.bullets}
          onChange={(arr) => patchLocale('gate', 'en', 'bullets', arr)}
          testidPrefix="bo-mc-gate-bullets-en" />
      </Row>
      <ResetBtn onClick={() => resetSection('gate')} label="Reset gate to defaults" testid="bo-mc-reset-gate" />

      {/* SIGNALS */}
      <SectionTitle sub="The locked numbered list, reveal teaser, sharpness band labels">SIGNALS LIST</SectionTitle>
      <Row>
        <LocaleBlock title="FI" scope="signals-fi" data={form.signals?.fi} defaults={D.signals?.fi}
          fields={SIGNALS_FIELDS} onPatch={(k, v) => patchLocale('signals', 'fi', k, v)} />
        <LocaleBlock title="EN" scope="signals-en" data={form.signals?.en} defaults={D.signals?.en}
          fields={SIGNALS_FIELDS} onPatch={(k, v) => patchLocale('signals', 'en', k, v)} />
      </Row>
      <ResetBtn onClick={() => resetSection('signals')} label="Reset signals to defaults" testid="bo-mc-reset-signals" />

      {/* HOW IT WORKS */}
      <SectionTitle sub="Three-step explainer">HOW IT WORKS</SectionTitle>
      <Row>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--hairline)',
            padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
            }}>FI</div>
            <Field label="Section title" value={form.explain?.fi?.title}
              placeholder={D.explain?.fi?.title}
              onChange={(v) => patchExplainTitle('fi', v)} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                border: '1px dashed var(--hairline)', padding: 12,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <Field label={`Step ${i + 1} title`}
                  value={form.explain?.fi?.steps?.[i]?.title}
                  placeholder={D.explain?.fi?.steps?.[i]?.title}
                  onChange={(v) => patchExplainStep('fi', i, 'title', v)} />
                <Field label={`Step ${i + 1} body`} multiline
                  value={form.explain?.fi?.steps?.[i]?.body}
                  placeholder={D.explain?.fi?.steps?.[i]?.body}
                  onChange={(v) => patchExplainStep('fi', i, 'body', v)} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--hairline)',
            padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
            }}>EN</div>
            <Field label="Section title" value={form.explain?.en?.title}
              placeholder={D.explain?.en?.title}
              onChange={(v) => patchExplainTitle('en', v)} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                border: '1px dashed var(--hairline)', padding: 12,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <Field label={`Step ${i + 1} title`}
                  value={form.explain?.en?.steps?.[i]?.title}
                  placeholder={D.explain?.en?.steps?.[i]?.title}
                  onChange={(v) => patchExplainStep('en', i, 'title', v)} />
                <Field label={`Step ${i + 1} body`} multiline
                  value={form.explain?.en?.steps?.[i]?.body}
                  placeholder={D.explain?.en?.steps?.[i]?.body}
                  onChange={(v) => patchExplainStep('en', i, 'body', v)} />
              </div>
            ))}
          </div>
        </div>
      </Row>
      <ResetBtn onClick={() => resetSection('explain')} label="Reset explainer to defaults" testid="bo-mc-reset-explain" />

      {/* RECEIPTS */}
      <SectionTitle sub="Last-7 signals table with status pill. Empty signal+outcome → row hidden.">RECEIPTS</SectionTitle>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <Row cols={2}>
          <Field label="FI section title" value={form.receipts?.title_fi}
            placeholder={D.receipts?.title_fi}
            onChange={(v) => patchTop('receipts', 'title_fi', v)} />
          <Field label="EN section title" value={form.receipts?.title_en}
            placeholder={D.receipts?.title_en}
            onChange={(v) => patchTop('receipts', 'title_en', v)} />
        </Row>
        <Row cols={4}>
          <Field label="FI · 7d label" value={form.receipts?.foot7d_fi}
            onChange={(v) => patchTop('receipts', 'foot7d_fi', v)} />
          <Field label="EN · 7d label" value={form.receipts?.foot7d_en}
            onChange={(v) => patchTop('receipts', 'foot7d_en', v)} />
          <Field label="FI · 30d label" value={form.receipts?.foot30d_fi}
            onChange={(v) => patchTop('receipts', 'foot30d_fi', v)} />
          <Field label="EN · 30d label" value={form.receipts?.foot30d_en}
            onChange={(v) => patchTop('receipts', 'foot30d_en', v)} />
        </Row>
        <Row cols={2}>
          <Field label="7d value" value={form.receipts?.foot7d_value}
            onChange={(v) => patchTop('receipts', 'foot7d_value', v)} />
          <Field label="30d value" value={form.receipts?.foot30d_value}
            onChange={(v) => patchTop('receipts', 'foot30d_value', v)} />
        </Row>
        <Row cols={6}>
          <Field label="HIT (FI)" value={form.receipts?.status_hit_fi} onChange={(v) => patchTop('receipts', 'status_hit_fi', v)} />
          <Field label="HIT (EN)" value={form.receipts?.status_hit_en} onChange={(v) => patchTop('receipts', 'status_hit_en', v)} />
          <Field label="MISS (FI)" value={form.receipts?.status_miss_fi} onChange={(v) => patchTop('receipts', 'status_miss_fi', v)} />
          <Field label="MISS (EN)" value={form.receipts?.status_miss_en} onChange={(v) => patchTop('receipts', 'status_miss_en', v)} />
          <Field label="EARLY (FI)" value={form.receipts?.status_early_fi} onChange={(v) => patchTop('receipts', 'status_early_fi', v)} />
          <Field label="EARLY (EN)" value={form.receipts?.status_early_en} onChange={(v) => patchTop('receipts', 'status_early_en', v)} />
        </Row>
        <Row cols={2}>
          <Field label="Method link (FI)" value={form.receipts?.method_link_fi} onChange={(v) => patchTop('receipts', 'method_link_fi', v)} />
          <Field label="Method link (EN)" value={form.receipts?.method_link_en} onChange={(v) => patchTop('receipts', 'method_link_en', v)} />
        </Row>
        {receipts.map((r, idx) => (
          <div key={idx} data-testid={`bo-mc-receipt-${idx}`} style={{
            border: '1px dashed var(--hairline)', padding: 12,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 700,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>ROW #{String(idx + 1).padStart(2, '0')}</span>
              <select value={r.status || 'hit'} data-testid={`bo-mc-receipt-${idx}-status`}
                onChange={(e) => patchListItem('receipts', idx, 'status', e.target.value)}
                style={{
                  background: 'var(--bg)', color: 'var(--ink)',
                  border: '1px solid var(--hairline)', padding: '4px 8px',
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                }}>
                <option value="hit">hit</option>
                <option value="miss">miss</option>
                <option value="early">early</option>
              </select>
            </div>
            <Row cols={3}>
              <Field label="Time" value={r.time} onChange={(v) => patchListItem('receipts', idx, 'time', v)} />
              <Field label="Date (FI)" value={r.date_fi} onChange={(v) => patchListItem('receipts', idx, 'date_fi', v)} />
              <Field label="Date (EN)" value={r.date_en} onChange={(v) => patchListItem('receipts', idx, 'date_en', v)} />
            </Row>
            <Row cols={2}>
              <Field label="Signal (FI)" value={r.signal_fi} onChange={(v) => patchListItem('receipts', idx, 'signal_fi', v)} />
              <Field label="Signal (EN)" value={r.signal_en} onChange={(v) => patchListItem('receipts', idx, 'signal_en', v)} />
            </Row>
            <Row cols={2}>
              <Field label="Outcome (FI)" value={r.outcome_fi} onChange={(v) => patchListItem('receipts', idx, 'outcome_fi', v)} />
              <Field label="Outcome (EN)" value={r.outcome_en} onChange={(v) => patchListItem('receipts', idx, 'outcome_en', v)} />
            </Row>
          </div>
        ))}
      </div>
      <ResetBtn onClick={() => resetSection('receipts')} label="Reset receipts to defaults" testid="bo-mc-reset-receipts" />

      {/* TESTIMONIALS */}
      <SectionTitle sub="Up to 6 testimonials. Blanking out both quotes hides the row.">TESTIMONIALS</SectionTitle>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <Row cols={2}>
          <Field label="FI section title" value={form.testimonials?.title_fi}
            onChange={(v) => patchTop('testimonials', 'title_fi', v)} />
          <Field label="EN section title" value={form.testimonials?.title_en}
            onChange={(v) => patchTop('testimonials', 'title_en', v)} />
        </Row>
        {testis.map((t, idx) => (
          <div key={t.id || idx} data-testid={`bo-mc-testi-${idx}`} style={{
            border: '1px dashed var(--hairline)', padding: 12,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 700,
            }}>TESTIMONIAL #{String(idx + 1).padStart(2, '0')}</div>
            <Row cols={3}>
              <Field label="ID" value={t.id} onChange={(v) => patchListItem('testimonials', idx, 'id', v)} />
              <Field label="Initials" value={t.initials} onChange={(v) => patchListItem('testimonials', idx, 'initials', v)} />
              <Field label="Name" value={t.name} onChange={(v) => patchListItem('testimonials', idx, 'name', v)} />
            </Row>
            <Row cols={2}>
              <Field label="Detail (FI)" value={t.detail_fi} onChange={(v) => patchListItem('testimonials', idx, 'detail_fi', v)} />
              <Field label="Detail (EN)" value={t.detail_en} onChange={(v) => patchListItem('testimonials', idx, 'detail_en', v)} />
            </Row>
            <Row cols={2}>
              <Field label="Quote (FI)" multiline value={t.quote_fi} onChange={(v) => patchListItem('testimonials', idx, 'quote_fi', v)} />
              <Field label="Quote (EN)" multiline value={t.quote_en} onChange={(v) => patchListItem('testimonials', idx, 'quote_en', v)} />
            </Row>
            <Row cols={2}>
              <Field label="Receipt-strip (FI)" value={t.receipt_fi} onChange={(v) => patchListItem('testimonials', idx, 'receipt_fi', v)} />
              <Field label="Receipt-strip (EN)" value={t.receipt_en} onChange={(v) => patchListItem('testimonials', idx, 'receipt_en', v)} />
            </Row>
          </div>
        ))}
        <button type="button" data-testid="bo-mc-testi-add"
          onClick={() => setForm((prev) => ({
            ...prev, testimonials: {
              ...(prev.testimonials || {}),
              items: [...(prev.testimonials?.items || []), {
                id: `t${(prev.testimonials?.items?.length || 0) + 1}`, initials: '', name: '',
                detail_fi: '', detail_en: '', quote_fi: '', quote_en: '',
                receipt_fi: '', receipt_en: '',
              }],
            },
          }))}
          style={{
            alignSelf: 'flex-start', padding: '8px 14px',
            background: 'transparent', color: 'var(--ink)',
            border: '1px dashed #E89248',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.10em', cursor: 'pointer',
          }}>+ ADD TESTIMONIAL</button>
      </div>
      <ResetBtn onClick={() => resetSection('testimonials')} label="Reset testimonials to defaults" testid="bo-mc-reset-testi" />

      {/* FOUNDER */}
      <SectionTitle sub="Avatar initial, quote, role, credentials line">FOUNDER</SectionTitle>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <Row cols={3}>
          <Field label="Name" value={form.founder?.name} onChange={(v) => patchTop('founder', 'name', v)} />
          <Field label="Avatar initial" value={form.founder?.avatar_initial} onChange={(v) => patchTop('founder', 'avatar_initial', v)} />
          <Field label="(unused)" value="" onChange={() => {}} placeholder="—" />
        </Row>
        <Row cols={2}>
          <Field label="Section title (FI)" value={form.founder?.title_fi} onChange={(v) => patchTop('founder', 'title_fi', v)} />
          <Field label="Section title (EN)" value={form.founder?.title_en} onChange={(v) => patchTop('founder', 'title_en', v)} />
        </Row>
        <Row cols={2}>
          <Field label="Eyebrow (FI)" value={form.founder?.eyebrow_fi} onChange={(v) => patchTop('founder', 'eyebrow_fi', v)} />
          <Field label="Eyebrow (EN)" value={form.founder?.eyebrow_en} onChange={(v) => patchTop('founder', 'eyebrow_en', v)} />
        </Row>
        <Row cols={2}>
          <Field label="Quote (FI)" multiline value={form.founder?.quote_fi} onChange={(v) => patchTop('founder', 'quote_fi', v)} />
          <Field label="Quote (EN)" multiline value={form.founder?.quote_en} onChange={(v) => patchTop('founder', 'quote_en', v)} />
        </Row>
        <Row cols={2}>
          <Field label="Role (FI)" value={form.founder?.role_fi} onChange={(v) => patchTop('founder', 'role_fi', v)} />
          <Field label="Role (EN)" value={form.founder?.role_en} onChange={(v) => patchTop('founder', 'role_en', v)} />
        </Row>
        <Row cols={2}>
          <Field label="Credentials (FI)" multiline value={form.founder?.creds_fi} onChange={(v) => patchTop('founder', 'creds_fi', v)} />
          <Field label="Credentials (EN)" multiline value={form.founder?.creds_en} onChange={(v) => patchTop('founder', 'creds_en', v)} />
        </Row>
        <Row cols={2}>
          <Field label="Method link label (FI)" value={form.founder?.method_link_fi} onChange={(v) => patchTop('founder', 'method_link_fi', v)} />
          <Field label="Method link label (EN)" value={form.founder?.method_link_en} onChange={(v) => patchTop('founder', 'method_link_en', v)} />
        </Row>
      </div>
      <ResetBtn onClick={() => resetSection('founder')} label="Reset founder to defaults" testid="bo-mc-reset-founder" />

      {/* PRESS */}
      <SectionTitle sub="Up to 12 publication / show names rendered in a single strip">PRESS STRIP</SectionTitle>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <Row cols={2}>
          <Field label="Section title (FI)" value={form.press?.title_fi} onChange={(v) => patchTop('press', 'title_fi', v)} />
          <Field label="Section title (EN)" value={form.press?.title_en} onChange={(v) => patchTop('press', 'title_en', v)} />
        </Row>
        {press.map((p, idx) => (
          <Row cols={4} key={idx}>
            <Field label={`Logo / show #${idx + 1}`} value={p}
              onChange={(v) => patchPressItem(idx, v)} />
          </Row>
        ))}
        <button type="button" data-testid="bo-mc-press-add"
          onClick={() => setForm((prev) => ({
            ...prev, press: { ...(prev.press || {}),
              items: [...(prev.press?.items || []), ''] },
          }))}
          style={{
            alignSelf: 'flex-start', padding: '8px 14px',
            background: 'transparent', color: 'var(--ink)',
            border: '1px dashed #E89248',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.10em', cursor: 'pointer',
          }}>+ ADD PRESS NAME</button>
      </div>
      <ResetBtn onClick={() => resetSection('press')} label="Reset press to defaults" testid="bo-mc-reset-press" />

      {/* FINAL GATE */}
      <SectionTitle sub="The closing block — same Telegram-primary gate, different framing">FINAL GATE</SectionTitle>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <Row cols={2}>
          <Field label="Eyebrow (FI)" value={form.final_gate?.eyebrow_fi} onChange={(v) => patchTop('final_gate', 'eyebrow_fi', v)} />
          <Field label="Eyebrow (EN)" value={form.final_gate?.eyebrow_en} onChange={(v) => patchTop('final_gate', 'eyebrow_en', v)} />
        </Row>
        <Row cols={2}>
          <Field label="Headline lead (FI)" value={form.final_gate?.headline_lead_fi} onChange={(v) => patchTop('final_gate', 'headline_lead_fi', v)} />
          <Field label="Headline lead (EN)" value={form.final_gate?.headline_lead_en} onChange={(v) => patchTop('final_gate', 'headline_lead_en', v)} />
        </Row>
        <Row cols={2}>
          <Field label="Headline emphasis (FI)" value={form.final_gate?.headline_em_fi} onChange={(v) => patchTop('final_gate', 'headline_em_fi', v)} />
          <Field label="Headline emphasis (EN)" value={form.final_gate?.headline_em_en} onChange={(v) => patchTop('final_gate', 'headline_em_en', v)} />
        </Row>
      </div>
      <ResetBtn onClick={() => resetSection('final_gate')} label="Reset final-gate to defaults" testid="bo-mc-reset-final" />

      {/* FEED + STICKY + BACK-LINK */}
      <SectionTitle sub="Activity feed labels · sticky mobile bar · back-to-home link">MICRO COPY</SectionTitle>
      <Row>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
          }}>ACTIVITY FEED</div>
          {FEED_FIELDS.map(([slug, label]) => (
            <Row cols={2} key={slug}>
              <Field label={`${label} (FI)`} value={form.feed?.[`${slug}_fi`]} onChange={(v) => patchTop('feed', `${slug}_fi`, v)} />
              <Field label={`${label} (EN)`} value={form.feed?.[`${slug}_en`]} onChange={(v) => patchTop('feed', `${slug}_en`, v)} />
            </Row>
          ))}
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
          }}>STICKY MOBILE BAR</div>
          <Row cols={2}>
            <Field label="Text (FI)" value={form.sticky?.text_fi} onChange={(v) => patchTop('sticky', 'text_fi', v)} />
            <Field label="Text (EN)" value={form.sticky?.text_en} onChange={(v) => patchTop('sticky', 'text_en', v)} />
          </Row>
          <Row cols={2}>
            <Field label="CTA (FI)" value={form.sticky?.cta_fi} onChange={(v) => patchTop('sticky', 'cta_fi', v)} />
            <Field label="CTA (EN)" value={form.sticky?.cta_en} onChange={(v) => patchTop('sticky', 'cta_en', v)} />
          </Row>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
            marginTop: 10,
          }}>BACK-TO-HOME LINK</div>
          <Row cols={2}>
            <Field label="FI" value={form.back_home?.fi}
              onChange={(v) => setForm((prev) => ({ ...prev, back_home: { ...(prev.back_home || {}), fi: v } }))} />
            <Field label="EN" value={form.back_home?.en}
              onChange={(v) => setForm((prev) => ({ ...prev, back_home: { ...(prev.back_home || {}), en: v } }))} />
          </Row>
        </div>
      </Row>

      {/* Sticky save bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderTop: '1px solid #E89248',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, zIndex: 60, backdropFilter: 'blur(10px)',
      }}>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
          color: 'var(--muted)', letterSpacing: '0.08em',
        }}>
          {status || 'Edits apply to /mittari the moment you save.'}
        </div>
        <button type="button" onClick={save} disabled={busy}
          data-testid="bo-mc-save-bottom" style={{
            padding: '10px 18px', background: '#E89248', color: '#0A0A0B',
            border: 0, fontFamily: 'ui-monospace, monospace',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.16em',
            cursor: busy ? 'wait' : 'pointer',
          }}>{busy ? 'SAVING…' : 'SAVE & PUBLISH'}</button>
      </div>
    </div>
  );
};

// ── Small helpers ──────────────────────────────────────────────────────
const BulletsEditor = ({ title, values, defaults, onChange, testidPrefix }) => {
  const arr = Array.isArray(values) && values.length ? values : (defaults || ['', '', '']);
  const update = (i, v) => {
    const next = [...arr]; next[i] = v; onChange(next);
  };
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--hairline)',
      padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
      }}>{title}</div>
      {[0, 1, 2].map((i) => (
        <input key={i} type="text" data-testid={`${testidPrefix}-${i}`}
          value={arr[i] ?? ''} placeholder={(defaults || [])[i] || ''}
          onChange={(e) => update(i, e.target.value)}
          style={{
            background: 'var(--bg)', color: 'var(--ink)',
            border: '1px solid var(--hairline)', padding: '9px 12px',
            fontFamily: 'ui-monospace, monospace', fontSize: 12, outline: 'none',
          }} />
      ))}
    </div>
  );
};

const ResetBtn = ({ onClick, label, testid }) => (
  <div style={{ margin: '6px 0 8px' }}>
    <button type="button" onClick={onClick} data-testid={testid} style={{
      background: 'transparent', color: 'var(--muted)',
      border: '1px dashed var(--hairline)', padding: '6px 12px',
      fontFamily: 'ui-monospace, monospace', fontSize: 10,
      letterSpacing: '0.10em', cursor: 'pointer', textTransform: 'uppercase',
    }}>↻ {label}</button>
  </div>
);

export default BackOfficeMittariCopy;
