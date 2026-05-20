/**
 * BackOfficeMestariCopy — every line on /mestari is editable here.
 *
 * Data source: GET /api/admin/mestari/copy returns
 *   { raw, merged, defaults, updated_at }
 *   - `raw` = user override doc (what's actually persisted)
 *   - `merged` = effective copy tree the public endpoint serves
 *   - `defaults` = stock copy (fallback for any missing field)
 *
 * We start the form bound to `merged` so users see exactly what the page
 * is showing right now. Submit issues PUT /api/admin/mestari/copy with
 * the full payload. Backend sanitises + caps each field, so a paste-bomb
 * in any cell self-recovers on the next read.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const SectionTitle = ({ children, sub, onReset, testid }) => (
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

const Field = ({ label, value, onChange, multiline, placeholder, idScope }) => {
  const id = `mec-field-${idScope ? `${idScope}-` : ''}${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
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

const Row = ({ children, cols = 2 }) => (
  <div style={{
    display: 'grid', gap: 12, marginBottom: 12,
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  }}>{children}</div>
);

const Card = ({ children, label, testid }) => (
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

const BackOfficeMestariCopy = () => {
  const { token, authed, authError, checkAuth, setToken } = useBackOfficeToken();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json', 'X-Admin-Token': token,
  }), [token]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setStatus('Loading…');
    try {
      const r = await fetch(`${BACKEND}/api/admin/mestari/copy`, { headers });
      if (!r.ok) { setStatus(`Load failed (${r.status})`); return; }
      const j = await r.json();
      setData(j);
      setForm(structuredClone(j.merged));
      setDefaults(j.defaults);
      setStatus(j.updated_at ? `Loaded · last save ${new Date(j.updated_at).toLocaleString()}` : 'Loaded · using defaults');
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }, [token, headers]);

  useEffect(() => { if (authed) fetchAll(); }, [authed, fetchAll]);

  const save = async () => {
    if (!form) return;
    setSaving(true); setStatus('Saving…');
    try {
      const r = await fetch(`${BACKEND}/api/admin/mestari/copy`, {
        method: 'PUT', headers, body: JSON.stringify(form),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setStatus(`Save failed: ${j.detail || r.status}`);
        return;
      }
      const j = await r.json();
      setData(j);
      setForm(structuredClone(j.merged));
      setStatus(`✓ Saved · ${new Date(j.updated_at).toLocaleString()}`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetSection = (key) => {
    if (!defaults || !form) return;
    setForm({ ...form, [key]: structuredClone(defaults[key]) });
    setStatus(`Reset section "${key}" (unsaved)`);
  };

  // ── Field-update helpers ─────────────────────────────────────────
  const setHero = (lang, key, v) =>
    setForm((f) => ({ ...f, hero: { ...f.hero, [lang]: { ...f.hero[lang], [key]: v } } }));
  const setHeader = (key, v) =>
    setForm((f) => ({ ...f, header: { ...f.header, [key]: v } }));
  const setCred = (idx, key, v) =>
    setForm((f) => ({ ...f, cred: f.cred.map((c, i) => i === idx ? { ...c, [key]: v } : c) }));
  const setMethodTop = (key, v) =>
    setForm((f) => ({ ...f, method: { ...f.method, [key]: v } }));
  const setMethodCard = (idx, key, v) =>
    setForm((f) => ({ ...f, method: { ...f.method, cards: f.method.cards.map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));
  const setStackTop = (key, v) =>
    setForm((f) => ({ ...f, stack: { ...f.stack, [key]: v } }));
  const setStackItem = (idx, key, v) =>
    setForm((f) => ({ ...f, stack: { ...f.stack, items: f.stack.items.map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));
  const setStepsTop = (key, v) =>
    setForm((f) => ({ ...f, steps: { ...f.steps, [key]: v } }));
  const setStepsRow = (idx, key, v) =>
    setForm((f) => ({ ...f, steps: { ...f.steps, rows: f.steps.rows.map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));
  const setClarityField = (key, v) =>
    setForm((f) => ({ ...f, clarity: { ...f.clarity, [key]: v } }));
  const setClarityBullet = (listKey, idx, v) =>
    setForm((f) => ({ ...f, clarity: { ...f.clarity, [listKey]: f.clarity[listKey].map((b, i) => i === idx ? v : b) } }));
  const setTeam = (key, v) =>
    setForm((f) => ({ ...f, team: { ...f.team, [key]: v } }));
  const setFaqTop = (key, v) =>
    setForm((f) => ({ ...f, faq: { ...f.faq, [key]: v } }));
  const setFaqItem = (idx, key, v) =>
    setForm((f) => ({ ...f, faq: { ...f.faq, items: f.faq.items.map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));
  const setFinal = (key, v) =>
    setForm((f) => ({ ...f, final: { ...f.final, [key]: v } }));
  const setFooterTop = (key, v) =>
    setForm((f) => ({ ...f, footer: { ...f.footer, [key]: v } }));
  const setFooterLink = (idx, key, v) =>
    setForm((f) => ({ ...f, footer: { ...f.footer, links: f.footer.links.map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));
  const setTrustLang = (lang, key, v) =>
    setForm((f) => ({ ...f, trust: { ...f.trust, [lang]: { ...((f.trust && f.trust[lang]) || {}), [key]: v } } }));
  const setTrustLink = (idx, key, v) =>
    setForm((f) => ({ ...f, trust: { ...f.trust, links: (f.trust && f.trust.links ? f.trust.links : []).map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));

  // ── Auth gate ────────────────────────────────────────────────────
  if (!authed) {
    return <AuthGate token={token} setToken={setToken} authError={authError} onSubmit={checkAuth} />;
  }
  if (!form) {
    return (
      <div style={{ padding: 40, color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
        {status || 'Loading Mestari copy…'}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div data-testid="back-office-mestari-copy" style={{
      maxWidth: 1100, margin: '0 auto', padding: '32px 24px 120px',
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
          }}>Mestari copy editor</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            Every visible line on <code>/mestari</code> is live-editable. FI primary + EN. Saves apply within ~1s.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            letterSpacing: '0.12em', color: 'var(--muted)',
          }} data-testid="mec-status">{status}</span>
          <button type="button" onClick={save} disabled={saving}
            data-testid="mec-save-top"
            style={{
              padding: '10px 18px', background: '#5B8DEE', color: '#0B0A09',
              border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
              fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
              cursor: saving ? 'wait' : 'pointer',
            }}>{saving ? 'SAVING…' : 'SAVE'}</button>
        </div>
      </div>

      {/* HEADER */}
      <SectionTitle sub="Logo back-link label." testid="mec-section-header"
        onReset={() => resetSection('header')}>HEADER</SectionTitle>
      <Card>
        <Row>
          <Field label="Logo back text (FI)" value={form.header.back_fi}
            onChange={(v) => setHeader('back_fi', v)} idScope="header" />
          <Field label="Logo back text (EN)" value={form.header.back_en}
            onChange={(v) => setHeader('back_en', v)} idScope="header" />
        </Row>
      </Card>

      {/* HERO */}
      <SectionTitle sub="Eyebrow · headline · sub · research-positioning block · CTA · 4 meta tokens."
        testid="mec-section-hero" onReset={() => resetSection('hero')}>HERO</SectionTitle>
      {['fi', 'en'].map((lang) => (
        <Card key={`hero-${lang}`} label={lang === 'fi' ? 'FINNISH' : 'ENGLISH'} testid={`mec-hero-${lang}`}>
          <Field label="Eyebrow" value={form.hero[lang].eyebrow}
            onChange={(v) => setHero(lang, 'eyebrow', v)} idScope={`hero-${lang}`} />
          <Field label="Headline" value={form.hero[lang].headline}
            onChange={(v) => setHero(lang, 'headline', v)} idScope={`hero-${lang}`} />
          <Field label="Sub" multiline value={form.hero[lang].sub}
            onChange={(v) => setHero(lang, 'sub', v)} idScope={`hero-${lang}`} />
          <Row>
            <Field label="Positioning bold prefix" value={form.hero[lang].positioning_strong}
              onChange={(v) => setHero(lang, 'positioning_strong', v)} idScope={`hero-${lang}`} />
            <Field label="Positioning rest" multiline value={form.hero[lang].positioning_rest}
              onChange={(v) => setHero(lang, 'positioning_rest', v)} idScope={`hero-${lang}`} />
          </Row>
          <Row cols={4}>
            <Field label="Meta 1" value={form.hero[lang].meta_1}
              onChange={(v) => setHero(lang, 'meta_1', v)} idScope={`hero-${lang}`} />
            <Field label="Meta 2" value={form.hero[lang].meta_2}
              onChange={(v) => setHero(lang, 'meta_2', v)} idScope={`hero-${lang}`} />
            <Field label="Meta 3" value={form.hero[lang].meta_3}
              onChange={(v) => setHero(lang, 'meta_3', v)} idScope={`hero-${lang}`} />
            <Field label="Meta 4" value={form.hero[lang].meta_4}
              onChange={(v) => setHero(lang, 'meta_4', v)} idScope={`hero-${lang}`} />
          </Row>
          <Field label="CTA label" value={form.hero[lang].cta}
            onChange={(v) => setHero(lang, 'cta', v)} idScope={`hero-${lang}`} />
        </Card>
      ))}

      {/* CRED BAR */}
      <SectionTitle sub="4 fixed cells. Big number + unit + descriptor."
        testid="mec-section-cred" onReset={() => resetSection('cred')}>CREDIBILITY BAR</SectionTitle>
      {form.cred.map((cell, idx) => (
        <Card key={`cred-${idx}`} label={`CELL ${idx + 1}`} testid={`mec-cred-${idx}`}>
          <Row cols={3}>
            <Field label="Number" value={cell.num}
              onChange={(v) => setCred(idx, 'num', v)} idScope={`cred-${idx}`} />
            <Field label="Unit (FI)" value={cell.unit_fi}
              onChange={(v) => setCred(idx, 'unit_fi', v)} idScope={`cred-${idx}`} />
            <Field label="Unit (EN)" value={cell.unit_en}
              onChange={(v) => setCred(idx, 'unit_en', v)} idScope={`cred-${idx}`} />
          </Row>
          <Row>
            <Field label="Description (FI)" multiline value={cell.desc_fi}
              onChange={(v) => setCred(idx, 'desc_fi', v)} idScope={`cred-${idx}`} />
            <Field label="Description (EN)" multiline value={cell.desc_en}
              onChange={(v) => setCred(idx, 'desc_en', v)} idScope={`cred-${idx}`} />
          </Row>
        </Card>
      ))}

      {/* METHOD */}
      <SectionTitle sub="Section label + 1-paragraph intro + 4 method cards (number · title · 3-part body · tag)."
        testid="mec-section-method" onReset={() => resetSection('method')}>METHOD</SectionTitle>
      <Card label="LABELS + INTRO">
        <Row>
          <Field label="Section label (FI)" value={form.method.label_fi}
            onChange={(v) => setMethodTop('label_fi', v)} idScope="method-top" />
          <Field label="Section label (EN)" value={form.method.label_en}
            onChange={(v) => setMethodTop('label_en', v)} idScope="method-top" />
        </Row>
        {['fi', 'en'].map((lang) => (
          <Row key={`mintro-${lang}`} cols={3}>
            <Field label={`Intro pre (${lang.toUpperCase()})`} multiline
              value={form.method[`intro_pre_${lang}`]}
              onChange={(v) => setMethodTop(`intro_pre_${lang}`, v)} idScope={`method-intro-${lang}`} />
            <Field label={`Intro emphasis (${lang.toUpperCase()})`}
              value={form.method[`intro_em_${lang}`]}
              onChange={(v) => setMethodTop(`intro_em_${lang}`, v)} idScope={`method-intro-${lang}`} />
            <Field label={`Intro post (${lang.toUpperCase()})`} multiline
              value={form.method[`intro_post_${lang}`]}
              onChange={(v) => setMethodTop(`intro_post_${lang}`, v)} idScope={`method-intro-${lang}`} />
          </Row>
        ))}
      </Card>
      {form.method.cards.map((card, idx) => (
        <Card key={`mcard-${idx}`} label={`CARD ${idx + 1}`} testid={`mec-method-card-${idx}`}>
          <Row>
            <Field label="Number/eyebrow (FI)" value={card.num_fi}
              onChange={(v) => setMethodCard(idx, 'num_fi', v)} idScope={`method-card-${idx}-fi`} />
            <Field label="Number/eyebrow (EN)" value={card.num_en}
              onChange={(v) => setMethodCard(idx, 'num_en', v)} idScope={`method-card-${idx}-en`} />
          </Row>
          <Row>
            <Field label="Title (FI)" value={card.title_fi}
              onChange={(v) => setMethodCard(idx, 'title_fi', v)} idScope={`method-card-${idx}-fi`} />
            <Field label="Title (EN)" value={card.title_en}
              onChange={(v) => setMethodCard(idx, 'title_en', v)} idScope={`method-card-${idx}-en`} />
          </Row>
          {['fi', 'en'].map((lang) => (
            <Row key={`mcard-${idx}-${lang}`} cols={3}>
              <Field label={`Body pre (${lang.toUpperCase()})`} multiline
                value={card[`body_pre_${lang}`]}
                onChange={(v) => setMethodCard(idx, `body_pre_${lang}`, v)} idScope={`method-card-${idx}-body-${lang}`} />
              <Field label={`Body emphasis (${lang.toUpperCase()})`}
                value={card[`body_em_${lang}`]}
                onChange={(v) => setMethodCard(idx, `body_em_${lang}`, v)} idScope={`method-card-${idx}-body-${lang}`} />
              <Field label={`Body post (${lang.toUpperCase()})`} multiline
                value={card[`body_post_${lang}`]}
                onChange={(v) => setMethodCard(idx, `body_post_${lang}`, v)} idScope={`method-card-${idx}-body-${lang}`} />
            </Row>
          ))}
          <Row>
            <Field label="Tag (FI)" value={card.tag_fi}
              onChange={(v) => setMethodCard(idx, 'tag_fi', v)} idScope={`method-card-${idx}-fi`} />
            <Field label="Tag (EN)" value={card.tag_en}
              onChange={(v) => setMethodCard(idx, 'tag_en', v)} idScope={`method-card-${idx}-en`} />
          </Row>
        </Card>
      ))}

      {/* STACK */}
      <SectionTitle sub="3 layers behind the diagnostic."
        testid="mec-section-stack" onReset={() => resetSection('stack')}>STACK</SectionTitle>
      <Card label="LABEL">
        <Row>
          <Field label="Section label (FI)" value={form.stack.label_fi}
            onChange={(v) => setStackTop('label_fi', v)} idScope="stack-top" />
          <Field label="Section label (EN)" value={form.stack.label_en}
            onChange={(v) => setStackTop('label_en', v)} idScope="stack-top" />
        </Row>
      </Card>
      {form.stack.items.map((it, idx) => (
        <Card key={`stack-${idx}`} label={`ITEM ${idx + 1}`} testid={`mec-stack-item-${idx}`}>
          <Row>
            <Field label="Eyebrow (FI)" value={it.label_fi}
              onChange={(v) => setStackItem(idx, 'label_fi', v)} idScope={`stack-${idx}-fi`} />
            <Field label="Eyebrow (EN)" value={it.label_en}
              onChange={(v) => setStackItem(idx, 'label_en', v)} idScope={`stack-${idx}-en`} />
          </Row>
          <Row>
            <Field label="Title (FI)" value={it.title_fi}
              onChange={(v) => setStackItem(idx, 'title_fi', v)} idScope={`stack-${idx}-fi`} />
            <Field label="Title (EN)" value={it.title_en}
              onChange={(v) => setStackItem(idx, 'title_en', v)} idScope={`stack-${idx}-en`} />
          </Row>
          <Row>
            <Field label="Body (FI)" multiline value={it.body_fi}
              onChange={(v) => setStackItem(idx, 'body_fi', v)} idScope={`stack-${idx}-fi`} />
            <Field label="Body (EN)" multiline value={it.body_en}
              onChange={(v) => setStackItem(idx, 'body_en', v)} idScope={`stack-${idx}-en`} />
          </Row>
        </Card>
      ))}

      {/* STEPS */}
      <SectionTitle sub="3 rows of how-it-works."
        testid="mec-section-steps" onReset={() => resetSection('steps')}>HOW IT WORKS</SectionTitle>
      <Card label="LABEL">
        <Row>
          <Field label="Section label (FI)" value={form.steps.label_fi}
            onChange={(v) => setStepsTop('label_fi', v)} idScope="steps-top" />
          <Field label="Section label (EN)" value={form.steps.label_en}
            onChange={(v) => setStepsTop('label_en', v)} idScope="steps-top" />
        </Row>
      </Card>
      {form.steps.rows.map((row, idx) => (
        <Card key={`step-${idx}`} label={`ROW ${idx + 1}`} testid={`mec-step-${idx}`}>
          <Row cols={3}>
            <Field label="Number" value={row.num}
              onChange={(v) => setStepsRow(idx, 'num', v)} idScope={`step-${idx}`} />
            <Field label="Title (FI)" value={row.title_fi}
              onChange={(v) => setStepsRow(idx, 'title_fi', v)} idScope={`step-${idx}-fi`} />
            <Field label="Title (EN)" value={row.title_en}
              onChange={(v) => setStepsRow(idx, 'title_en', v)} idScope={`step-${idx}-en`} />
          </Row>
          <Row>
            <Field label="Description (FI)" multiline value={row.desc_fi}
              onChange={(v) => setStepsRow(idx, 'desc_fi', v)} idScope={`step-${idx}-fi`} />
            <Field label="Description (EN)" multiline value={row.desc_en}
              onChange={(v) => setStepsRow(idx, 'desc_en', v)} idScope={`step-${idx}-en`} />
          </Row>
        </Card>
      ))}

      {/* CLARITY */}
      <SectionTitle sub="Green/amber split. 4 bullets per side per language."
        testid="mec-section-clarity" onReset={() => resetSection('clarity')}>CLARITY (IS / IS NOT)</SectionTitle>
      <Card label="LABELS + HEADS">
        <Row>
          <Field label="Section label (FI)" value={form.clarity.label_fi}
            onChange={(v) => setClarityField('label_fi', v)} idScope="clarity-top-fi" />
          <Field label="Section label (EN)" value={form.clarity.label_en}
            onChange={(v) => setClarityField('label_en', v)} idScope="clarity-top-en" />
        </Row>
        <Row cols={4}>
          <Field label="'Is' head (FI)" value={form.clarity.is_head_fi}
            onChange={(v) => setClarityField('is_head_fi', v)} idScope="clarity-is-fi" />
          <Field label="'Is' head (EN)" value={form.clarity.is_head_en}
            onChange={(v) => setClarityField('is_head_en', v)} idScope="clarity-is-en" />
          <Field label="'Is not' head (FI)" value={form.clarity.isnt_head_fi}
            onChange={(v) => setClarityField('isnt_head_fi', v)} idScope="clarity-isnt-fi" />
          <Field label="'Is not' head (EN)" value={form.clarity.isnt_head_en}
            onChange={(v) => setClarityField('isnt_head_en', v)} idScope="clarity-isnt-en" />
        </Row>
      </Card>
      {[
        ['is_items_fi', 'IS BULLETS (FI)'],
        ['is_items_en', 'IS BULLETS (EN)'],
        ['isnt_items_fi', 'IS NOT BULLETS (FI)'],
        ['isnt_items_en', 'IS NOT BULLETS (EN)'],
      ].map(([key, label]) => (
        <Card key={key} label={label} testid={`mec-clarity-${key}`}>
          {(form.clarity[key] || []).map((bullet, idx) => (
            <Field key={`${key}-${idx}`} label={`${idx + 1}`} value={bullet}
              onChange={(v) => setClarityBullet(key, idx, v)} idScope={`${key}-${idx}`} />
          ))}
        </Card>
      ))}

      {/* TEAM */}
      <SectionTitle sub="Founder block. Quote split into pre/emphasis/post. Single avatar initial."
        testid="mec-section-team" onReset={() => resetSection('team')}>FOUNDER</SectionTitle>
      <Card>
        <Row cols={3}>
          <Field label="Section label (FI)" value={form.team.label_fi}
            onChange={(v) => setTeam('label_fi', v)} idScope="team-fi" />
          <Field label="Section label (EN)" value={form.team.label_en}
            onChange={(v) => setTeam('label_en', v)} idScope="team-en" />
          <Field label="Avatar initial" value={form.team.initial}
            onChange={(v) => setTeam('initial', v)} idScope="team" />
        </Row>
        <Row>
          <Field label="Eyebrow (FI)" value={form.team.eyebrow_fi}
            onChange={(v) => setTeam('eyebrow_fi', v)} idScope="team-fi" />
          <Field label="Eyebrow (EN)" value={form.team.eyebrow_en}
            onChange={(v) => setTeam('eyebrow_en', v)} idScope="team-en" />
        </Row>
        {['fi', 'en'].map((lang) => (
          <Row key={`team-quote-${lang}`} cols={3}>
            <Field label={`Quote pre (${lang.toUpperCase()})`} multiline
              value={form.team[`quote_pre_${lang}`]}
              onChange={(v) => setTeam(`quote_pre_${lang}`, v)} idScope={`team-quote-${lang}`} />
            <Field label={`Quote emphasis (${lang.toUpperCase()})`}
              value={form.team[`quote_em_${lang}`]}
              onChange={(v) => setTeam(`quote_em_${lang}`, v)} idScope={`team-quote-${lang}`} />
            <Field label={`Quote post (${lang.toUpperCase()})`} multiline
              value={form.team[`quote_post_${lang}`]}
              onChange={(v) => setTeam(`quote_post_${lang}`, v)} idScope={`team-quote-${lang}`} />
          </Row>
        ))}
        <Row cols={3}>
          <Field label="Sign name" value={form.team.sign_name}
            onChange={(v) => setTeam('sign_name', v)} idScope="team" />
          <Field label="Sign suffix (FI)" value={form.team.sign_rest_fi}
            onChange={(v) => setTeam('sign_rest_fi', v)} idScope="team-fi" />
          <Field label="Sign suffix (EN)" value={form.team.sign_rest_en}
            onChange={(v) => setTeam('sign_rest_en', v)} idScope="team-en" />
        </Row>
        <Row>
          <Field label="Cred prefix (FI)" multiline value={form.team.cred_pre_fi}
            onChange={(v) => setTeam('cred_pre_fi', v)} idScope="team-fi" />
          <Field label="Cred prefix (EN)" multiline value={form.team.cred_pre_en}
            onChange={(v) => setTeam('cred_pre_en', v)} idScope="team-en" />
        </Row>
        <Row>
          <Field label="Cred link label (FI)" value={form.team.cred_link_fi}
            onChange={(v) => setTeam('cred_link_fi', v)} idScope="team-fi" />
          <Field label="Cred link label (EN)" value={form.team.cred_link_en}
            onChange={(v) => setTeam('cred_link_en', v)} idScope="team-en" />
        </Row>
      </Card>

      {/* FAQ */}
      <SectionTitle sub="4 Q&A items."
        testid="mec-section-faq" onReset={() => resetSection('faq')}>FAQ</SectionTitle>
      <Card label="LABEL">
        <Row>
          <Field label="Section label (FI)" value={form.faq.label_fi}
            onChange={(v) => setFaqTop('label_fi', v)} idScope="faq-top-fi" />
          <Field label="Section label (EN)" value={form.faq.label_en}
            onChange={(v) => setFaqTop('label_en', v)} idScope="faq-top-en" />
        </Row>
      </Card>
      {form.faq.items.map((it, idx) => (
        <Card key={`faq-${idx}`} label={`Q ${idx + 1}`} testid={`mec-faq-${idx}`}>
          <Row>
            <Field label="Question (FI)" value={it.q_fi}
              onChange={(v) => setFaqItem(idx, 'q_fi', v)} idScope={`faq-${idx}-fi`} />
            <Field label="Question (EN)" value={it.q_en}
              onChange={(v) => setFaqItem(idx, 'q_en', v)} idScope={`faq-${idx}-en`} />
          </Row>
          <Row>
            <Field label="Answer (FI)" multiline value={it.a_fi}
              onChange={(v) => setFaqItem(idx, 'a_fi', v)} idScope={`faq-${idx}-fi`} />
            <Field label="Answer (EN)" multiline value={it.a_en}
              onChange={(v) => setFaqItem(idx, 'a_en', v)} idScope={`faq-${idx}-en`} />
          </Row>
        </Card>
      ))}

      {/* FINAL CTA */}
      <SectionTitle sub="Final CTA section + 5 meta tokens per locale."
        testid="mec-section-final" onReset={() => resetSection('final')}>FINAL CTA</SectionTitle>
      <Card>
        <Row>
          <Field label="Eyebrow (FI)" value={form.final.eyebrow_fi}
            onChange={(v) => setFinal('eyebrow_fi', v)} idScope="final-fi" />
          <Field label="Eyebrow (EN)" value={form.final.eyebrow_en}
            onChange={(v) => setFinal('eyebrow_en', v)} idScope="final-en" />
        </Row>
        {['fi', 'en'].map((lang) => (
          <Row key={`final-headline-${lang}`} cols={3}>
            <Field label={`Headline pre (${lang.toUpperCase()})`}
              value={form.final[`headline_pre_${lang}`]}
              onChange={(v) => setFinal(`headline_pre_${lang}`, v)} idScope={`final-h-${lang}`} />
            <Field label={`Headline emphasis (${lang.toUpperCase()})`}
              value={form.final[`headline_em_${lang}`]}
              onChange={(v) => setFinal(`headline_em_${lang}`, v)} idScope={`final-h-${lang}`} />
            <Field label={`Headline post (${lang.toUpperCase()})`}
              value={form.final[`headline_post_${lang}`]}
              onChange={(v) => setFinal(`headline_post_${lang}`, v)} idScope={`final-h-${lang}`} />
          </Row>
        ))}
        <Row>
          <Field label="CTA label (FI)" value={form.final.cta_fi}
            onChange={(v) => setFinal('cta_fi', v)} idScope="final-fi" />
          <Field label="CTA label (EN)" value={form.final.cta_en}
            onChange={(v) => setFinal('cta_en', v)} idScope="final-en" />
        </Row>
        {['fi', 'en'].map((lang) => (
          <Row key={`final-meta-${lang}`} cols={5}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Field key={i} label={`Meta ${i} (${lang.toUpperCase()})`}
                value={form.final[`meta_${lang}_${i}`]}
                onChange={(v) => setFinal(`meta_${lang}_${i}`, v)} idScope={`final-meta-${lang}-${i}`} />
            ))}
          </Row>
        ))}
      </Card>

      {/* TRUST STRIP — pills, GDPR note, accept-checkbox link wording, 3 external links */}
      <SectionTitle sub="4 trust pills · plain-language GDPR note · checkbox label wording · 3 external links. Renders on the email-capture step right before submit."
        testid="mec-section-trust" onReset={() => resetSection('trust')}>TRUST STRIP (EMAIL GATE)</SectionTitle>
      {['fi', 'en'].map((lang) => {
        const tLang = (form.trust && form.trust[lang]) || {};
        return (
          <Card key={`trust-${lang}`} label={lang === 'fi' ? 'FINNISH' : 'ENGLISH'} testid={`mec-trust-${lang}`}>
            <Row cols={4}>
              <Field label="Pill 1" value={tLang.pill_1}
                onChange={(v) => setTrustLang(lang, 'pill_1', v)} idScope={`trust-${lang}`} />
              <Field label="Pill 2" value={tLang.pill_2}
                onChange={(v) => setTrustLang(lang, 'pill_2', v)} idScope={`trust-${lang}`} />
              <Field label="Pill 3" value={tLang.pill_3}
                onChange={(v) => setTrustLang(lang, 'pill_3', v)} idScope={`trust-${lang}`} />
              <Field label="Pill 4" value={tLang.pill_4}
                onChange={(v) => setTrustLang(lang, 'pill_4', v)} idScope={`trust-${lang}`} />
            </Row>
            <Field label="GDPR note (paragraph under the pills)" multiline value={tLang.note}
              onChange={(v) => setTrustLang(lang, 'note', v)} idScope={`trust-${lang}-note`} />
            <Row cols={3}>
              <Field label="Checkbox prefix" value={tLang.accept_pre}
                onChange={(v) => setTrustLang(lang, 'accept_pre', v)} idScope={`trust-${lang}-acc`} />
              <Field label="Checkbox link label" value={tLang.accept_link}
                onChange={(v) => setTrustLang(lang, 'accept_link', v)} idScope={`trust-${lang}-acc`} />
              <Field label="Checkbox suffix" value={tLang.accept_post}
                onChange={(v) => setTrustLang(lang, 'accept_post', v)} idScope={`trust-${lang}-acc`} />
            </Row>
          </Card>
        );
      })}
      {(form.trust && form.trust.links ? form.trust.links : []).map((link, idx) => (
        <Card key={`trust-link-${idx}`} label={`EXTERNAL LINK ${idx + 1}`} testid={`mec-trust-link-${idx}`}>
          <Row cols={3}>
            <Field label="Href (route or URL)" value={link.href}
              onChange={(v) => setTrustLink(idx, 'href', v)} idScope={`trust-link-${idx}`} />
            <Field label="Label (FI)" value={link.label_fi}
              onChange={(v) => setTrustLink(idx, 'label_fi', v)} idScope={`trust-link-${idx}-fi`} />
            <Field label="Label (EN)" value={link.label_en}
              onChange={(v) => setTrustLink(idx, 'label_en', v)} idScope={`trust-link-${idx}-en`} />
          </Row>
        </Card>
      ))}

      {/* FOOTER */}
      <SectionTitle sub="Back-link, 4 nav links, disclaimer + peluuri.fi link."
        testid="mec-section-footer" onReset={() => resetSection('footer')}>FOOTER</SectionTitle>
      <Card label="LINKS + DISCLAIMER">
        <Row>
          <Field label="Back-link label (FI)" value={form.footer.home_fi}
            onChange={(v) => setFooterTop('home_fi', v)} idScope="footer-fi" />
          <Field label="Back-link label (EN)" value={form.footer.home_en}
            onChange={(v) => setFooterTop('home_en', v)} idScope="footer-en" />
        </Row>
        {form.footer.links.map((link, idx) => (
          <Row key={`footerlink-${idx}`} cols={3}>
            <Field label={`Link ${idx + 1} href`} value={link.href}
              onChange={(v) => setFooterLink(idx, 'href', v)} idScope={`footer-link-${idx}`} />
            <Field label={`Link ${idx + 1} label (FI)`} value={link.label_fi}
              onChange={(v) => setFooterLink(idx, 'label_fi', v)} idScope={`footer-link-${idx}-fi`} />
            <Field label={`Link ${idx + 1} label (EN)`} value={link.label_en}
              onChange={(v) => setFooterLink(idx, 'label_en', v)} idScope={`footer-link-${idx}-en`} />
          </Row>
        ))}
        <Row>
          <Field label="Disclaimer paragraph (FI)" multiline value={form.footer.disclaimer_fi}
            onChange={(v) => setFooterTop('disclaimer_fi', v)} idScope="footer-disclaimer-fi" />
          <Field label="Disclaimer paragraph (EN)" multiline value={form.footer.disclaimer_en}
            onChange={(v) => setFooterTop('disclaimer_en', v)} idScope="footer-disclaimer-en" />
        </Row>
        <Row cols={4}>
          <Field label="Peluuri link href" value={form.footer.disclaimer_link_href}
            onChange={(v) => setFooterTop('disclaimer_link_href', v)} idScope="footer-peluuri" />
          <Field label="Peluuri link label" value={form.footer.disclaimer_link_label}
            onChange={(v) => setFooterTop('disclaimer_link_label', v)} idScope="footer-peluuri" />
          <Field label="Disclaimer tail (FI)" value={form.footer.disclaimer_tail_fi}
            onChange={(v) => setFooterTop('disclaimer_tail_fi', v)} idScope="footer-fi" />
          <Field label="Disclaimer tail (EN)" value={form.footer.disclaimer_tail_en}
            onChange={(v) => setFooterTop('disclaimer_tail_en', v)} idScope="footer-en" />
        </Row>
      </Card>

      {/* Sticky bottom save bar */}
      <div style={{
        position: 'sticky', bottom: 16, marginTop: 36,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        padding: '12px 16px', gap: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
          letterSpacing: '0.12em', color: 'var(--muted)',
        }} data-testid="mec-status-bottom">{status}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/mestari" target="_blank" rel="noopener noreferrer"
            data-testid="mec-preview-link"
            style={{
              padding: '10px 16px', background: 'transparent', color: 'var(--ink)',
              border: '1px solid var(--border-strong)', textDecoration: 'none',
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
            }}>OPEN /MESTARI ↗</Link>
          <button type="button" onClick={save} disabled={saving}
            data-testid="mec-save-bottom"
            style={{
              padding: '10px 18px', background: '#5B8DEE', color: '#0B0A09',
              border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
              fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
              cursor: saving ? 'wait' : 'pointer',
            }}>{saving ? 'SAVING…' : 'SAVE ALL'}</button>
        </div>
      </div>
    </div>
  );
};

export default BackOfficeMestariCopy;
