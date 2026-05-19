/**
 * PUTKI HQ — Back-office Voita quiz editor.
 *
 * Full editor for the landing-funnel quiz. Admin can:
 *   * Rename question titles + sub-copy (FI + EN)
 *   * Edit option labels (FI + EN), emojis, and `v` keys (analytics-safe)
 *   * Add / remove / reorder questions and options
 *   * Toggle auto-advance / multi-select / callback flags
 *
 * Lives at /back-office/voita-quiz. Saves to settings.voita_quiz_config
 * which the public funnel reads from /api/settings/public.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;


const Section = ({ children, title }) => (
  <div style={{
    padding: '16px 18px', background: 'var(--surface)',
    border: '1px solid var(--hairline)', marginBottom: 14,
  }}>
    {title && <div style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em',
      color: '#E8C26E', fontWeight: 700, marginBottom: 10,
    }}>{title}</div>}
    {children}
  </div>
);

const Input = ({ label, value, onChange, placeholder, dataTestId, maxLength = 160 }) => (
  <label style={{ display: 'block', marginBottom: 8 }}>
    {label && <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 3 }}>{label}</div>}
    <input value={value || ''} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} data-testid={dataTestId} maxLength={maxLength}
      style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '8px 10px', fontFamily: 'inherit', fontSize: 13 }} />
  </label>
);

const TinyButton = ({ children, onClick, danger, dataTestId, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled} data-testid={dataTestId}
    style={{
      background: 'transparent', color: danger ? '#C8423C' : 'var(--ink)',
      border: `1px solid ${danger ? '#5a2b2b' : 'var(--border-strong)'}`,
      padding: '4px 8px', fontFamily: 'ui-monospace, monospace', fontSize: 10,
      letterSpacing: '0.18em', fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
    }}>{children}</button>
);


const OptionRow = ({ opt, qIdx, oIdx, onChange, onRemove }) => (
  <div data-testid={`option-row-${qIdx}-${oIdx}`} style={{
    padding: 10, background: 'var(--bg)', border: '1px solid var(--hairline)', marginBottom: 8,
  }}>
    <div style={{ display: 'grid', gridTemplateColumns: '90px 50px 1fr 1fr auto', gap: 8 }}>
      <Input value={opt.v} onChange={(v) => onChange({ ...opt, v: v.replace(/[^a-z0-9_]/gi, '').toLowerCase() })}
        placeholder="v (key)" dataTestId={`option-v-${qIdx}-${oIdx}`} maxLength={32} />
      <Input value={opt.emoji} onChange={(v) => onChange({ ...opt, emoji: v })}
        placeholder="🎯" dataTestId={`option-emoji-${qIdx}-${oIdx}`} maxLength={8} />
      <Input value={opt.label_fi} onChange={(v) => onChange({ ...opt, label_fi: v })}
        placeholder="label_fi" dataTestId={`option-label-fi-${qIdx}-${oIdx}`} maxLength={120} />
      <Input value={opt.label_en} onChange={(v) => onChange({ ...opt, label_en: v })}
        placeholder="label_en" dataTestId={`option-label-en-${qIdx}-${oIdx}`} maxLength={120} />
      <TinyButton onClick={onRemove} danger dataTestId={`option-remove-${qIdx}-${oIdx}`}>✕</TinyButton>
    </div>
  </div>
);


const QuestionBlock = ({ q, qIdx, total, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const update = (patch) => onChange({ ...q, ...patch });
  const updateOption = (oIdx, next) => {
    const opts = q.options.map((o, i) => i === oIdx ? next : o);
    update({ options: opts });
  };
  const removeOption = (oIdx) => {
    update({ options: q.options.filter((_, i) => i !== oIdx) });
  };
  const addOption = () => {
    update({ options: [...q.options, { v: `opt${q.options.length + 1}`, label_fi: '', label_en: '', emoji: '' }] });
  };
  return (
    <Section title={`Q${qIdx + 1} · ${q.key.toUpperCase()}`}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <TinyButton onClick={onMoveUp} disabled={qIdx === 0} dataTestId={`q-move-up-${qIdx}`}>↑ MOVE UP</TinyButton>
        <TinyButton onClick={onMoveDown} disabled={qIdx === total - 1} dataTestId={`q-move-down-${qIdx}`}>↓ MOVE DOWN</TinyButton>
        <TinyButton onClick={onRemove} danger dataTestId={`q-remove-${qIdx}`}>✕ DELETE</TinyButton>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.18em', fontFamily: 'ui-monospace, monospace', color: 'var(--muted)', fontWeight: 700 }}>
          <input type="checkbox" checked={!!q.auto} onChange={(e) => update({ auto: e.target.checked })}
            data-testid={`q-auto-${qIdx}`} /> AUTO-ADVANCE
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.18em', fontFamily: 'ui-monospace, monospace', color: 'var(--muted)', fontWeight: 700 }}>
          <input type="checkbox" checked={!!q.multi} onChange={(e) => update({ multi: e.target.checked, auto: !e.target.checked && q.auto })}
            data-testid={`q-multi-${qIdx}`} /> MULTI-SELECT
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.18em', fontFamily: 'ui-monospace, monospace', color: 'var(--muted)', fontWeight: 700 }}>
          <input type="checkbox" checked={!!q.callback} onChange={(e) => update({ callback: e.target.checked })}
            data-testid={`q-callback-${qIdx}`} /> Q4 CALLBACK
        </label>
      </div>
      <Input label="KEY (analytics — don't rename after launch)" value={q.key}
        onChange={(v) => update({ key: v.replace(/[^a-z0-9_]/gi, '').toLowerCase() })}
        dataTestId={`q-key-${qIdx}`} maxLength={32} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="TITLE · FI" value={q.title_fi} onChange={(v) => update({ title_fi: v })} dataTestId={`q-title-fi-${qIdx}`} />
        <Input label="TITLE · EN" value={q.title_en} onChange={(v) => update({ title_en: v })} dataTestId={`q-title-en-${qIdx}`} />
        <Input label="SUB · FI" value={q.sub_fi} onChange={(v) => update({ sub_fi: v })} dataTestId={`q-sub-fi-${qIdx}`} maxLength={240} />
        <Input label="SUB · EN" value={q.sub_en} onChange={(v) => update({ sub_en: v })} dataTestId={`q-sub-en-${qIdx}`} maxLength={240} />
      </div>
      <div style={{ marginTop: 12, fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
        OPTIONS ({q.options.length})
      </div>
      {q.options.map((o, oIdx) => (
        <OptionRow key={oIdx} opt={o} qIdx={qIdx} oIdx={oIdx}
          onChange={(next) => updateOption(oIdx, next)}
          onRemove={() => removeOption(oIdx)} />
      ))}
      <TinyButton onClick={addOption} dataTestId={`q-add-option-${qIdx}`}>+ ADD OPTION</TinyButton>
    </Section>
  );
};


const BackOfficeVoitaQuiz = () => {
  const { token, setToken, authed, authError, checkAuth } = useBackOfficeToken();
  const [config, setConfig] = useState([]);
  const [hero, setHero] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || !authed) return;
    try {
      const r = await fetch(`${BACKEND}/api/admin/settings`, { headers: { 'X-Admin-Token': token } });
      if (r.ok) {
        const d = await r.json();
        let cfg = d.voita_quiz_config;
        if (!Array.isArray(cfg) || cfg.length === 0) {
          // Read default from public endpoint (server merges).
          const pub = await fetch(`${BACKEND}/api/settings/public`).then((x) => x.ok ? x.json() : null);
          cfg = (pub && pub.voita_quiz_config) || [];
        }
        setConfig(cfg);
        setHero(d.voita_hero || null);
      }
    } catch (e) {
      setError(e.message || 'Network error');
    } finally { setLoaded(true); }
  }, [token, authed]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ voita_quiz_config: config, voita_hero: hero }),
      });
      if (r.ok) {
        const d = await r.json();
        setConfig(d.voita_quiz_config || config);
        setHero(d.voita_hero || hero);
        setSavedAt(new Date().toLocaleTimeString());
      } else {
        const j = await r.json().catch(() => ({}));
        setError(j.detail || `HTTP ${r.status}`);
      }
    } catch (e) {
      setError(e.message || 'Network error');
    } finally { setBusy(false); }
  };

  const updateHero = (patch) => setHero({ ...(hero || {}), ...patch });

  const updateQ = (idx, next) => setConfig(config.map((q, i) => i === idx ? next : q));
  const removeQ = (idx) => {
    if (!window.confirm(`Delete question Q${idx + 1}? This will hide it from the funnel.`)) return;
    setConfig(config.filter((_, i) => i !== idx));
  };
  const moveQ = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= config.length) return;
    const next = config.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setConfig(next);
  };
  const addQ = () => setConfig([
    ...config,
    { key: `q${config.length + 1}`, auto: true, multi: false, callback: false,
      title_fi: '', title_en: '', sub_fi: '', sub_en: '',
      options: [{ v: 'opt1', label_fi: '', label_en: '', emoji: '' }] },
  ]);

  if (!authed) {
    return <AuthGate token={token} setToken={setToken} onSubmit={checkAuth} error={authError} title="Voita quiz editor" />;
  }

  return (
    <div data-testid="bo-voita-quiz" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 32px 64px', color: 'var(--ink)' }}>
      <Link to="/back-office/voita" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 4 }}>← VOITA RAFFLES</Link>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, color: 'var(--ink)', margin: '14px 0 8px', letterSpacing: '-0.02em' }}>Voita quiz editor</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24, lineHeight: 1.55, maxWidth: 700 }}>
        Edit the 5-question quiz that runs on <code>/voita/{'{slug}'}</code> before the prediction.
        Question/option keys are referenced by analytics — rename copy freely, but only change <code>v</code> values before
        traffic starts hitting that question.
      </p>

      {!loaded && <div style={{ color: 'var(--muted)' }}>Loading…</div>}

      {/* Hero banner editor */}
      {loaded && hero && (
        <Section title="HERO BANNER">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label="EYEBROW · FI" value={hero.eyebrow_fi} onChange={(v) => updateHero({ eyebrow_fi: v })} dataTestId="hero-eyebrow-fi" maxLength={80} />
            <Input label="EYEBROW · EN" value={hero.eyebrow_en} onChange={(v) => updateHero({ eyebrow_en: v })} dataTestId="hero-eyebrow-en" maxLength={80} />
            <Input label="TITLE · FI" value={hero.title_fi} onChange={(v) => updateHero({ title_fi: v })} dataTestId="hero-title-fi" maxLength={200} />
            <Input label="TITLE · EN" value={hero.title_en} onChange={(v) => updateHero({ title_en: v })} dataTestId="hero-title-en" maxLength={200} />
            <Input label="SUBTITLE · FI" value={hero.subtitle_fi} onChange={(v) => updateHero({ subtitle_fi: v })} dataTestId="hero-subtitle-fi" maxLength={320} />
            <Input label="SUBTITLE · EN" value={hero.subtitle_en} onChange={(v) => updateHero({ subtitle_en: v })} dataTestId="hero-subtitle-en" maxLength={320} />
            <Input label="IMAGE URL (absolute or /hero/…)" value={hero.image_url} onChange={(v) => updateHero({ image_url: v })} dataTestId="hero-image-url" maxLength={400} />
            <Input label="PHOTO CREDIT" value={hero.photo_credit} onChange={(v) => updateHero({ photo_credit: v })} dataTestId="hero-photo-credit" maxLength={120} />
          </div>
          {hero.image_url && (
            <div style={{ marginTop: 10, padding: 6, background: 'var(--bg)', border: '1px solid var(--hairline)' }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>PREVIEW</div>
              <img src={hero.image_url} alt="hero preview" data-testid="hero-image-preview"
                style={{ display: 'block', width: '100%', maxHeight: 180, objectFit: 'cover' }} />
            </div>
          )}
        </Section>
      )}

      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, margin: '18px 0 8px' }}>
        QUIZ QUESTIONS
      </div>

      {loaded && config.map((q, idx) => (
        <QuestionBlock key={idx} q={q} qIdx={idx} total={config.length}
          onChange={(next) => updateQ(idx, next)}
          onRemove={() => removeQ(idx)}
          onMoveUp={() => moveQ(idx, -1)}
          onMoveDown={() => moveQ(idx, 1)} />
      ))}

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <TinyButton onClick={addQ} dataTestId="add-question">+ ADD QUESTION</TinyButton>
      </div>

      {error && <div data-testid="quiz-error" style={{ marginTop: 16, padding: 10, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{error}</div>}

      <div style={{
        position: 'sticky', bottom: 16, marginTop: 24,
        padding: '12px 16px', background: 'var(--bg)',
        border: '1px solid var(--border-strong)',
        display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)' }}>
          {config.length} QUESTIONS · {config.reduce((s, q) => s + q.options.length, 0)} OPTIONS
          {savedAt && <span style={{ color: '#6FA37D', marginLeft: 10 }}>SAVED · {savedAt}</span>}
        </div>
        <button type="button" onClick={save} disabled={busy} data-testid="quiz-save"
          style={{
            padding: '10px 18px', background: '#E8C26E', color: '#0B0A09', border: 0,
            fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em',
            fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
          }}>
          {busy ? 'SAVING…' : 'SAVE'}
        </button>
      </div>
    </div>
  );
};

export default BackOfficeVoitaQuiz;
