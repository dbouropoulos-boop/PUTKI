/**
 * BackOfficeDispatch — iter97i editorial dispatch composer.
 *
 * Three tabs (Welcome read-only, Daily Tips, Weekly Editorial), three-
 * column desktop layout (nav + form + live preview), Linear/Notion grade
 * visual quality. Phase 1 tokens (white surfaces, ember accent, hairline
 * borders, Archivo Black + Inter + JetBrains Mono + Source Serif 4 italic).
 *
 * Backend single-source-of-truth: previews fetch
 * POST /api/admin/dispatch/preview which calls the same renderer the
 * production fanout uses. Zero render drift.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Eye, Check, Loader2, AlertTriangle, Image as ImageIcon, X, Plus, Trash2 } from 'lucide-react';
import { adminFetch } from '../lib/fetchAdmin';

const T = {
  ink: '#0A0A0A', ink2: '#3A3833', muted: '#7A7669',
  line: '#E8E5DF', lineStrong: '#D4D1CB',
  bg: '#FAFAF7', surface: '#FFFFFF',
  ember: '#D9461E', emberSoft: '#FBEAE2',
  fDisp: "'Archivo Black',sans-serif",
  fBody: "'Inter',Helvetica,sans-serif",
  fMono: "'JetBrains Mono',ui-monospace,monospace",
  fSerif: "'Source Serif 4',Georgia,serif",
};

const TABS = [
  { key: 'daily',   label: 'Daily tips'      },
  { key: 'weekly',  label: 'Weekly editorial' },
  { key: 'welcome', label: 'Welcome'         },
];

const DEFAULT_FIELDS = {
  daily: {
    edition_no: 142, date_label: 'TI 28.5. · 09:00',
    mittari_state: 'KIIRASTULI', yesterday_hit: 4, yesterday_total: 5,
    hook_line: 'Eilen 4 / 5 osui — markkina kovenee tänään.',
    picks: [
      { sport: 'Liiga', time: '18:30', event_name: 'Tappara vs Ilves', pick: 'Tappara', odds_decimal: 1.85, sharpness: 84, bookmaker: 'Pinnacle', editorial: 'Kolme kirjaa 0.03 sisällä. Iso line move yön yli.' },
      { sport: 'Veikkausliiga', time: '19:00', event_name: 'HJK Helsinki vs Inter Turku', pick: 'HJK Helsinki', odds_decimal: 1.72, sharpness: 71, bookmaker: 'Coolbet' },
      { sport: 'NHL', time: '02:00', event_name: 'Carolina vs Vegas', pick: 'Carolina', odds_decimal: 2.07, sharpness: 62, bookmaker: '1xBet' },
      { sport: 'NBA', time: '03:30', event_name: 'Celtics vs Lakers', pick: 'Celtics', odds_decimal: 1.95, sharpness: 58, bookmaker: 'Pinnacle' },
      { sport: 'KHL', time: '17:00', event_name: 'CSKA vs Dynamo', pick: 'CSKA', odds_decimal: 1.88, sharpness: 55, bookmaker: 'Coolbet' },
    ],
    partner: { enabled: false, partner_name: '', headline: '', body: '', mittari_score: 76, cta_label: 'Lue lisää', cta_url: '', disclosure: '+5/100 painotus', image_url: '' },
    signoff: 'Perke*le, alkaa olla jotain.',
    cta_url: 'https://putkihq.fi/mittari',
  },
  weekly: {
    week_no: 22, eyebrow: 'Viikko viidessä jutussa',
    headline: 'Viikon viisi {ember}juttua.{/ember}',
    summary: '',
    articles: [
      { category: 'SÄÄNTELY', read_time: 6, headline: '', excerpt: '', url: 'https://putkihq.fi/uutiset/' },
    ],
    scene_quote: '', scene_attr: '',
    partner: { enabled: false, partner_name: '', headline: '', body: '', cta_label: 'Lue lisää', cta_url: '', disclosure: 'Sponsoroitu', image_url: '' },
    signoff: 'Nähdään maanantaina {ember}09:00.{/ember}',
  },
  welcome: {
    profile_label: 'HILJAINEN TARKKA',
    subject: 'Tervetuloa PUTKI HQ:hon.',
    preheader: 'Profiilisi tunnistettu — Telegram-syöte avattu.',
    body_blocks: [
      'Sait Mestari-diagnoosista profiilin: HILJAINEN TARKKA.',
      'Päivän 5 signaalia rajoitettuna luxus-syötteenä Telegramiin klo 09:00.',
    ],
    cta_url: 'https://t.me/Putkihq_bot?start=signals',
  },
};

const WELCOME_PROFILES = [
  'HILJAINEN TARKKA', 'KOVA KÄSI', 'SYSTEMAATIKKO', 'KOLLEKTIIVI',
  'TARINANKERTOJA', 'LATAUKSEN HAUKKA', 'KOTIPELAAJA', 'YÖKÄVIJÄ',
  'KOKEILIJA', 'PRO', 'UUDENOPPIJA',
];

// ─── Section / card primitives ───────────────────────────────────────
const Section = ({ title, badge, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div data-testid={`section-${(title || '').toLowerCase().replace(/\s+/g, '-')}`}
         style={{ borderTop: `1px solid ${T.line}`, padding: '24px 0' }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex',
                 alignItems: 'center', gap: 10, width: '100%',
                 fontFamily: T.fMono, fontSize: 10.5, fontWeight: 700,
                 letterSpacing: '0.14em', color: T.ink, textTransform: 'uppercase' }}>
        <span>{title}</span>
        {badge && <span style={{ background: T.emberSoft, color: T.ember,
                                  padding: '2px 8px', fontSize: 9,
                                  letterSpacing: '0.1em' }}>{badge}</span>}
        <span style={{ marginLeft: 'auto', color: T.muted, fontSize: 10 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>}
    </div>
  );
};

const Field = ({ label, hint, count, max, error, children }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8,
                  marginBottom: 6, fontFamily: T.fMono, fontSize: 10,
                  fontWeight: 600, letterSpacing: '0.14em',
                  color: error ? T.ember : T.muted, textTransform: 'uppercase' }}>
      <span>{label}</span>
      {typeof count === 'number' && (
        <span style={{ marginLeft: 'auto', color: max && count > max * 0.95 ? T.ember : T.muted }}>
          {count}{max ? `/${max}` : ''}
        </span>
      )}
    </div>
    {children}
    {hint && !error && <div style={{ marginTop: 4, fontFamily: T.fBody, fontSize: 11, color: T.muted, fontStyle: 'italic' }}>{hint}</div>}
    {error && <div style={{ marginTop: 4, fontFamily: T.fBody, fontSize: 11, color: T.ember }}>{error}</div>}
  </div>
);

const inputStyle = {
  width: '100%', boxSizing: 'border-box', border: `1px solid ${T.line}`,
  borderRadius: 4, padding: '10px 12px', fontFamily: T.fBody, fontSize: 14,
  color: T.ink, background: T.surface, outline: 'none',
};
const Input = (props) => (
  <input {...props} style={{ ...inputStyle, ...(props.style || {}) }}
    onFocus={(e) => { e.target.style.borderColor = T.ember; e.target.style.boxShadow = `0 0 0 3px ${T.emberSoft}`; }}
    onBlur={(e) => { e.target.style.borderColor = T.line; e.target.style.boxShadow = 'none'; }}
  />
);
const Textarea = (props) => (
  <textarea {...props} style={{ ...inputStyle, minHeight: 64, resize: 'vertical', fontFamily: T.fBody, ...(props.style || {}) }}
    onFocus={(e) => { e.target.style.borderColor = T.ember; e.target.style.boxShadow = `0 0 0 3px ${T.emberSoft}`; }}
    onBlur={(e) => { e.target.style.borderColor = T.line; e.target.style.boxShadow = 'none'; }}
  />
);
const Toggle = ({ on, onChange, label, testid }) => (
  <button type="button" onClick={() => onChange(!on)} data-testid={testid}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
             background: 'transparent', border: 'none', cursor: 'pointer',
             padding: 0, fontFamily: T.fMono, fontSize: 10, fontWeight: 700,
             letterSpacing: '0.14em', color: on ? T.ember : T.muted,
             textTransform: 'uppercase' }}>
    <span style={{ width: 28, height: 16, background: on ? T.ember : T.line,
                   borderRadius: 999, position: 'relative', transition: 'background 120ms ease' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 14 : 2,
                     width: 12, height: 12, borderRadius: 999, background: '#fff',
                     transition: 'left 120ms ease' }} />
    </span>
    {label}
  </button>
);

// ─── Image upload zone ───────────────────────────────────────────────
const ImageZone = ({ value, onChange, partnerSlug }) => {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [useTreated, setUseTreated] = useState(true);
  const fileInputRef = useRef(null);

  const upload = useCallback(async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('partner_slug', partnerSlug || 'partner');
      fd.append('file', file);
      const r = await adminFetch('/api/admin/uploads/partner-image', { method: 'POST', body: fd, asFormData: true });
      if (!r.ok) throw new Error(`upload failed (${r.status})`);
      const j = await r.json();
      onChange({ ...j, treated: useTreated });
    } catch (e) {
      alert(`Upload failed: ${e.message}`);
    } finally { setBusy(false); }
  }, [partnerSlug, onChange, useTreated]);

  const url = value ? (value.treated ? value.treated_url : value.original_url) : '';

  return (
    <div>
      <div onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
           onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
           onDragLeave={() => setDrag(false)}
           onClick={() => fileInputRef.current?.click()}
           data-testid="image-upload-zone"
           style={{ border: `1px ${drag ? 'solid' : 'dashed'} ${drag ? T.ember : T.lineStrong}`,
                    background: drag ? T.emberSoft : T.surface,
                    borderRadius: 4, padding: url ? 0 : 32, cursor: 'pointer',
                    textAlign: 'center', transition: 'all 120ms ease' }}>
        {busy ? (
          <div style={{ padding: 32, fontFamily: T.fMono, fontSize: 11, color: T.ember, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            <Loader2 size={14} className="animate-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            Uploading…
          </div>
        ) : url ? (
          <div style={{ position: 'relative' }}>
            <img src={url} alt="" style={{ width: '100%', display: 'block', borderRadius: 4 }} />
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); }}
                    data-testid="image-remove" style={{ position: 'absolute', top: 8, right: 8, background: T.ink, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontFamily: T.fMono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              <X size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Remove
            </button>
          </div>
        ) : (
          <>
            <ImageIcon size={22} color={T.ember} style={{ marginBottom: 8 }} />
            <div style={{ fontFamily: T.fMono, fontSize: 11, fontWeight: 600, color: T.ink, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Drag partner image
            </div>
            <div style={{ fontFamily: T.fBody, fontSize: 12, color: T.muted, marginTop: 6 }}>
              JPG, PNG, WebP · max 2 MB · auto-resize 1200×675
            </div>
          </>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" data-testid="image-upload-input"
               style={{ display: 'none' }} onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      {value && (
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Toggle on={useTreated} onChange={(n) => { setUseTreated(n); onChange({ ...value, treated: n }); }}
                  label="Use treated style (PUTKI brand)" testid="image-treated-toggle" />
        </div>
      )}
    </div>
  );
};

// ─── Tabs ────────────────────────────────────────────────────────────
const DailyTab = ({ fields, set, mittariState }) => {
  const upd = (k, v) => set({ ...fields, [k]: v });
  const updPick = (i, k, v) => {
    const picks = [...(fields.picks || [])];
    picks[i] = { ...picks[i], [k]: v };
    set({ ...fields, picks });
  };
  const updPartner = (k, v) => set({ ...fields, partner: { ...(fields.partner || {}), [k]: v } });

  const stateHot = ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(mittariState);

  return (
    <div>
      <div data-testid="daily-status-strip" style={{
        background: stateHot ? T.emberSoft : T.bg, border: `1px solid ${stateHot ? T.ember : T.line}`,
        borderRadius: 4, padding: '14px 16px', marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontFamily: T.fMono, fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Mittari now</div>
          <div style={{ fontFamily: T.fDisp, fontSize: 18, color: stateHot ? T.ember : T.ink, letterSpacing: '-0.02em' }}>
            {(mittariState || 'UNKNOWN').replace('KIIRASTULI', 'KIIRA*STULI')}
          </div>
        </div>
        <div style={{ width: 1, height: 28, background: T.line }} />
        <div style={{ fontFamily: T.fBody, fontSize: 12.5, color: T.ink2 }}>
          {stateHot
            ? 'State qualifies — dispatch will fire on schedule.'
            : 'State below threshold — schedule will silent-skip (Mittari gate).'}
        </div>
      </div>

      <Section title="1 · Hook">
        <Field label="Mittari state opener" count={(fields.hook_line || '').length} max={80}>
          <Input value={fields.hook_line || ''} onChange={(e) => upd('hook_line', e.target.value.slice(0, 80))}
                 placeholder={DEFAULT_FIELDS.daily.hook_line} data-testid="daily-hook-line" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Edition №">
            <Input type="number" value={fields.edition_no || ''} onChange={(e) => upd('edition_no', parseInt(e.target.value, 10) || 0)} />
          </Field>
          <Field label="Date label">
            <Input value={fields.date_label || ''} onChange={(e) => upd('date_label', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="2 · The 5 picks" badge={`${(fields.picks || []).length}/5`}>
        {(fields.picks || []).slice(0, 5).map((p, i) => (
          <div key={i} data-testid={`daily-pick-${i}`} style={{ border: `1px solid ${T.line}`, borderRadius: 4, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: T.fMono, fontSize: 10, fontWeight: 700, color: T.ink, letterSpacing: '0.14em' }}>
                PICK {String(i + 1).padStart(2, '0')}
              </span>
              {i === 0 && <span style={{ background: T.ink, color: '#fff', padding: '2px 8px', fontFamily: T.fMono, fontSize: 9, letterSpacing: '0.14em' }}>FEATURED</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <Input value={p.sport || ''} placeholder="Sport" onChange={(e) => updPick(i, 'sport', e.target.value)} />
              <Input value={p.time || ''} placeholder="Time" onChange={(e) => updPick(i, 'time', e.target.value)} />
            </div>
            <Input value={p.event_name || ''} placeholder="Event (e.g. Tappara vs Ilves)" style={{ marginBottom: 8 }} onChange={(e) => updPick(i, 'event_name', e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, marginBottom: 8 }}>
              <Input value={p.pick || ''} placeholder="Pick" onChange={(e) => updPick(i, 'pick', e.target.value)} />
              <Input value={p.odds_decimal || ''} type="number" step="0.01" placeholder="Odds" onChange={(e) => updPick(i, 'odds_decimal', parseFloat(e.target.value) || 0)} />
              <Input value={p.sharpness || ''} type="number" placeholder="S" onChange={(e) => updPick(i, 'sharpness', parseInt(e.target.value, 10) || 0)} />
            </div>
            <Input value={p.bookmaker || ''} placeholder="Bookmaker" style={{ marginBottom: 8 }} onChange={(e) => updPick(i, 'bookmaker', e.target.value)} />
            {(i === 0 || p.editorial !== undefined) && (
              <Textarea value={p.editorial || ''} placeholder={i === 0 ? 'Editorial color (required, 80–150 chars)' : 'Editorial color (optional)'}
                onChange={(e) => updPick(i, 'editorial', e.target.value.slice(0, 150))} style={{ fontFamily: T.fSerif, fontStyle: 'italic' }} />
            )}
          </div>
        ))}
      </Section>

      <Section title="3 · Partner module" defaultOpen={false}>
        <Toggle on={!!fields.partner?.enabled} onChange={(n) => updPartner('enabled', n)} label="Enable partner module" testid="daily-partner-toggle" />
        {fields.partner?.enabled && (
          <>
            <Field label="Partner name">
              <Input value={fields.partner.partner_name || ''} onChange={(e) => updPartner('partner_name', e.target.value)} />
            </Field>
            <Field label="Offer headline" count={(fields.partner.headline || '').length} max={80}>
              <Input value={fields.partner.headline || ''} onChange={(e) => updPartner('headline', e.target.value.slice(0, 80))} />
            </Field>
            <Field label="Framing (1–2 serif italic sentences)">
              <Textarea value={fields.partner.body || ''} onChange={(e) => updPartner('body', e.target.value)} style={{ fontFamily: T.fSerif, fontStyle: 'italic' }} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Mittari score (0–100)">
                <Input type="number" min="0" max="100" value={fields.partner.mittari_score || ''} onChange={(e) => updPartner('mittari_score', parseInt(e.target.value, 10) || 0)} />
              </Field>
              <Field label="Disclosure">
                <select value={fields.partner.disclosure} onChange={(e) => updPartner('disclosure', e.target.value)} style={{ ...inputStyle, padding: '10px 12px' }}>
                  <option>+5/100 painotus</option>
                  <option>Sponsoroitu</option>
                  <option>Native</option>
                </select>
              </Field>
            </div>
            <Field label="CTA URL">
              <Input type="url" value={fields.partner.cta_url || ''} placeholder="https://" onChange={(e) => updPartner('cta_url', e.target.value)} />
            </Field>
            <Field label="Hero image">
              <ImageZone value={fields.partner.image_upload}
                onChange={(v) => {
                  updPartner('image_upload', v);
                  updPartner('image_url', v ? (v.treated ? v.treated_url : v.original_url) : '');
                }}
                partnerSlug={fields.partner.partner_name} />
            </Field>
          </>
        )}
      </Section>

      <Section title="4 · Sign-off" defaultOpen={false}>
        <Field label="Sign-off line" count={(fields.signoff || '').length} max={60}>
          <Input value={fields.signoff || ''} onChange={(e) => upd('signoff', e.target.value.slice(0, 60))} />
        </Field>
      </Section>
    </div>
  );
};

const WeeklyTab = ({ fields, set }) => {
  const upd = (k, v) => set({ ...fields, [k]: v });
  const articles = fields.articles || [];
  const setArticle = (i, k, v) => {
    const next = [...articles];
    next[i] = { ...next[i], [k]: v };
    upd('articles', next);
  };
  const updPartner = (k, v) => set({ ...fields, partner: { ...(fields.partner || {}), [k]: v } });

  return (
    <div>
      <Section title="1 · Hook">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
          <Field label="Eyebrow" count={(fields.eyebrow || '').length} max={30}>
            <Input value={fields.eyebrow || ''} onChange={(e) => upd('eyebrow', e.target.value.slice(0, 30))} />
          </Field>
          <Field label="Week №">
            <Input type="number" value={fields.week_no || ''} onChange={(e) => upd('week_no', parseInt(e.target.value, 10) || 0)} />
          </Field>
        </div>
        <Field label="Headline ({ember}…{/ember} for ember portions)">
          <Textarea value={fields.headline || ''} onChange={(e) => upd('headline', e.target.value)} style={{ fontFamily: T.fDisp, fontSize: 18 }} />
        </Field>
        <Field label="Summary">
          <Textarea value={fields.summary || ''} onChange={(e) => upd('summary', e.target.value)} style={{ fontFamily: T.fSerif, fontStyle: 'italic' }} />
        </Field>
      </Section>

      {articles.map((a, i) => (
        <Section key={i} title={`${i + 1} · Article ${i === 0 ? '01 (featured)' : String(i + 1).padStart(2, '0')}`} defaultOpen={i === 0}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 12 }}>
            <Field label="Category">
              <Input value={a.category || ''} onChange={(e) => setArticle(i, 'category', e.target.value.slice(0, 20))} />
            </Field>
            <Field label="Read (min)">
              <Input type="number" value={a.read_time || ''} onChange={(e) => setArticle(i, 'read_time', parseInt(e.target.value, 10) || 0)} />
            </Field>
          </div>
          <Field label="Headline" count={(a.headline || '').length} max={100}>
            <Input value={a.headline || ''} onChange={(e) => setArticle(i, 'headline', e.target.value.slice(0, 100))} />
          </Field>
          <Field label="Excerpt" count={(a.excerpt || '').split(/\s+/).filter(Boolean).length} hint="50–150 words">
            <Textarea value={a.excerpt || ''} onChange={(e) => setArticle(i, 'excerpt', e.target.value)} />
          </Field>
          <Field label="Article URL (must be putkihq.fi/uutiset/*)">
            <Input type="url" value={a.url || ''} onChange={(e) => setArticle(i, 'url', e.target.value)} />
          </Field>
          {i > 0 && (
            <button type="button" data-testid={`weekly-remove-article-${i}`}
              onClick={() => upd('articles', articles.filter((_, j) => j !== i))}
              style={{ alignSelf: 'flex-start', background: 'transparent', border: `1px solid ${T.line}`, color: T.ember, padding: '6px 10px', borderRadius: 4, fontFamily: T.fMono, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
              <Trash2 size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Remove article
            </button>
          )}
        </Section>
      ))}
      {articles.length < 4 && (
        <button type="button" data-testid="weekly-add-article" onClick={() => upd('articles', [...articles, { category: '', read_time: 5, headline: '', excerpt: '', url: '' }])}
          style={{ marginTop: 12, background: T.surface, border: `1px solid ${T.lineStrong}`, color: T.ink, padding: '10px 14px', borderRadius: 4, fontFamily: T.fMono, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
          <Plus size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          Add another article
        </button>
      )}

      <Section title={`${articles.length + 2} · Scene moment`} defaultOpen={false}>
        <Field label="Pull quote">
          <Textarea value={fields.scene_quote || ''} onChange={(e) => upd('scene_quote', e.target.value)} style={{ fontFamily: T.fSerif, fontStyle: 'italic' }} />
        </Field>
        <Field label="Attribution (name · platform · timestamp)">
          <Input value={fields.scene_attr || ''} onChange={(e) => upd('scene_attr', e.target.value)} />
        </Field>
      </Section>

      <Section title={`${articles.length + 3} · Partner module`} defaultOpen={false}>
        <Toggle on={!!fields.partner?.enabled} onChange={(n) => updPartner('enabled', n)} label="Enable partner module" testid="weekly-partner-toggle" />
        {fields.partner?.enabled && (
          <>
            <Field label="Partner name"><Input value={fields.partner.partner_name || ''} onChange={(e) => updPartner('partner_name', e.target.value)} /></Field>
            <Field label="Offer headline"><Input value={fields.partner.headline || ''} onChange={(e) => updPartner('headline', e.target.value)} /></Field>
            <Field label="Framing"><Textarea value={fields.partner.body || ''} onChange={(e) => updPartner('body', e.target.value)} style={{ fontFamily: T.fSerif, fontStyle: 'italic' }} /></Field>
            <Field label="CTA URL"><Input type="url" value={fields.partner.cta_url || ''} onChange={(e) => updPartner('cta_url', e.target.value)} /></Field>
            <Field label="Hero image">
              <ImageZone value={fields.partner.image_upload}
                onChange={(v) => {
                  updPartner('image_upload', v);
                  updPartner('image_url', v ? (v.treated ? v.treated_url : v.original_url) : '');
                }}
                partnerSlug={fields.partner.partner_name} />
            </Field>
          </>
        )}
      </Section>

      <Section title={`${articles.length + 4} · Sign-off`} defaultOpen={false}>
        <Field label="Sign-off ({ember} markup supported)">
          <Input value={fields.signoff || ''} onChange={(e) => upd('signoff', e.target.value)} />
        </Field>
      </Section>
    </div>
  );
};

const WelcomeTab = ({ fields, set }) => {
  const upd = (k, v) => set({ ...fields, [k]: v });
  return (
    <div>
      <Section title="Welcome (read-only)">
        <Field label="Profile">
          <select value={fields.profile_label || ''} onChange={(e) => upd('profile_label', e.target.value)} style={{ ...inputStyle, padding: '10px 12px' }}>
            {WELCOME_PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Subject"><div style={{ ...inputStyle, background: T.bg }}>{fields.subject}</div></Field>
        <Field label="Preheader"><div style={{ ...inputStyle, background: T.bg, fontStyle: 'italic', fontFamily: T.fSerif }}>{fields.preheader}</div></Field>
        <Field label="Body" hint="Edit welcome content at /back-office/email-templates">
          <div style={{ ...inputStyle, background: T.bg, fontFamily: T.fSerif, fontStyle: 'italic' }}>
            {(fields.body_blocks || []).map((b, i) => <div key={i} style={{ marginBottom: 8 }}>{b}</div>)}
          </div>
        </Field>
      </Section>
    </div>
  );
};

// ─── Preview pane ────────────────────────────────────────────────────
const PreviewPane = ({ type, fields }) => {
  const [html, setHtml] = useState('');
  const [viewport, setViewport] = useState('desktop');
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await adminFetch('/api/admin/dispatch/preview', { method: 'POST', body: JSON.stringify({ type, fields }) });
        const text = await r.text();
        setHtml(text);
      } finally { setBusy(false); }
    }, 300);
    return () => timer.current && clearTimeout(timer.current);
  }, [type, fields]);

  const width = viewport === 'mobile' ? 375 : 640;
  return (
    <div data-testid="preview-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1A1815', padding: 24, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, color: '#F2EBE0' }}>
        <div style={{ fontFamily: T.fMono, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {busy ? 'Rendering…' : 'Live preview'}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: '#0A0A0A', padding: 3, borderRadius: 4 }}>
          {['desktop', 'mobile'].map((v) => (
            <button key={v} type="button" onClick={() => setViewport(v)} data-testid={`preview-viewport-${v}`}
              style={{ background: viewport === v ? T.ember : 'transparent', color: viewport === v ? '#fff' : '#A8A39A', border: 'none', padding: '6px 12px', borderRadius: 3, fontFamily: T.fMono, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <iframe data-testid="preview-iframe" title="email preview" srcDoc={html}
          style={{ width, height: '100%', minHeight: 800, border: 'none', background: '#fff', borderRadius: 4 }} />
      </div>
    </div>
  );
};

// ─── Main shell ──────────────────────────────────────────────────────
const BackOfficeDispatch = () => {
  const [tab, setTab] = useState('daily');
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [draft, setDraft] = useState(null);  // { id, name, type } once saved
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [savedAgo, setSavedAgo] = useState(null);
  const [mittariState, setMittariState] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendToast, setSendToast] = useState(null);
  const [fireConfirm, setFireConfirm] = useState(false);
  const saveTimer = useRef(null);

  const currentFields = fields[tab] || {};
  const setCurrentFields = (next) => setFields((f) => ({ ...f, [tab]: next }));

  // Pull current Mittari state for the daily status strip
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/dial`);
        const j = await r.json();
        setMittariState((j?.state?.key || '').toUpperCase());
      } catch {}
    })();
  }, []);

  // Autosave every 2s
  useEffect(() => {
    if (tab === 'welcome') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await save();
    }, 2000);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFields, tab]);

  const save = useCallback(async () => {
    if (tab === 'welcome') return;
    setSaveStatus('saving');
    try {
      let r;
      if (draft?.id && draft?.type === tab) {
        r = await adminFetch(`/api/admin/dispatch/drafts/${draft.id}`, { method: 'PUT', body: JSON.stringify({ type: tab, fields: currentFields }) });
      } else {
        r = await adminFetch('/api/admin/dispatch/drafts', { method: 'POST', body: JSON.stringify({ type: tab, fields: currentFields, name: `${tab} draft` }) });
      }
      if (!r.ok) throw new Error(`save failed (${r.status})`);
      const j = await r.json();
      setDraft({ id: j.id, name: j.name, type: j.type });
      setSaveStatus('saved');
      setSavedAgo(Date.now());
    } catch (e) {
      setSaveStatus('error');
    }
  }, [tab, currentFields, draft]);

  // Ticker for "Saved Ns ago"
  useEffect(() => {
    const i = setInterval(() => {
      if (saveStatus === 'saved' && savedAgo) {
        setSavedAgo((s) => s);  // force re-render to update the label
      }
    }, 1000);
    return () => clearInterval(i);
  }, [saveStatus, savedAgo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key === 's') { e.preventDefault(); save(); }
      if (cmd && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTestSend(); }
      if (cmd && e.key === 'Enter' && e.shiftKey)  { e.preventDefault(); setFireConfirm(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save]);

  const handleTestSend = async () => {
    setSendBusy(true);
    try {
      const r = await adminFetch('/api/admin/dispatch/test-send', {
        method: 'POST',
        body: JSON.stringify({ type: tab, fields: currentFields, channels: tab === 'daily' ? ['email', 'telegram'] : ['email'] }),
      });
      const j = await r.json();
      setSendToast({ kind: 'ok', text: 'Test sent — check inbox' });
      setTimeout(() => setSendToast(null), 4000);
    } catch (e) {
      setSendToast({ kind: 'err', text: `Send failed: ${e.message}` });
    } finally { setSendBusy(false); }
  };

  const handleFire = async () => {
    setSendBusy(true);
    setFireConfirm(false);
    try {
      const r = await adminFetch('/api/admin/dispatch/fire', {
        method: 'POST',
        body: JSON.stringify({ type: tab, fields: currentFields, channels: ['email', 'telegram'], confirm: true }),
      });
      const j = await r.json();
      const em = j.outcome?.email?.delivered || 0;
      const tg = j.outcome?.telegram?.delivered || 0;
      setSendToast({ kind: 'ok', text: `Fired · email ${em} · telegram ${tg}` });
      setTimeout(() => setSendToast(null), 6000);
    } catch (e) {
      setSendToast({ kind: 'err', text: `Fire failed: ${e.message}` });
    } finally { setSendBusy(false); }
  };

  const status = saveStatus === 'saving'
    ? { dot: T.ember, text: 'Saving…' }
    : saveStatus === 'saved'
    ? { dot: '#6B6862', text: savedAgo ? `Saved ${Math.max(0, Math.floor((Date.now() - savedAgo) / 1000))}s ago` : 'Saved' }
    : saveStatus === 'error'
    ? { dot: T.ember, text: 'Save failed' }
    : { dot: T.line, text: 'Idle' };

  return (
    <div data-testid="back-office-dispatch" style={{
      minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: T.fBody,
    }}>
      {/* Sticky top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20, background: T.surface,
        borderBottom: `1px solid ${T.line}`, padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ fontFamily: T.fDisp, fontSize: 20, color: T.ink, letterSpacing: '-0.025em' }}>
          Dispatch composer
        </div>
        <div style={{ display: 'flex', gap: 2, marginLeft: 16 }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} data-testid={`dispatch-tab-${t.key}`}
              style={{ background: tab === t.key ? T.ink : 'transparent', color: tab === t.key ? '#fff' : T.muted, border: 'none', borderRadius: 4, padding: '8px 14px', fontFamily: T.fMono, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div data-testid="save-status" style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: T.fMono, fontSize: 10, color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: status.dot }} />
            {status.text}
          </div>
          <button type="button" onClick={handleTestSend} disabled={sendBusy} data-testid="dispatch-test-send"
            style={{ background: 'transparent', color: T.ember, border: `1px solid ${T.ember}`, borderRadius: 4, padding: '9px 16px', fontFamily: T.fMono, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Send test (⌘↵)
          </button>
          <button type="button" onClick={() => setFireConfirm(true)} disabled={sendBusy} data-testid="dispatch-fire"
            style={{ background: T.ember, color: '#fff', border: 'none', borderRadius: 4, padding: '10px 16px', fontFamily: T.fMono, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Send to list (⌘⇧↵)
          </button>
        </div>
      </div>

      {/* Toast */}
      {sendToast && (
        <div data-testid="dispatch-toast" style={{
          position: 'fixed', right: 24, top: 80, zIndex: 30,
          background: sendToast.kind === 'ok' ? T.ink : T.ember, color: '#fff',
          padding: '12px 18px', borderRadius: 4,
          fontFamily: T.fMono, fontSize: 12, letterSpacing: '0.08em',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          <Check size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
          {sendToast.text}
        </div>
      )}

      {/* Fire confirmation modal */}
      {fireConfirm && (
        <div onClick={() => setFireConfirm(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(10,10,10,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} data-testid="fire-confirm-modal" style={{ background: T.surface, padding: 32, borderRadius: 4, maxWidth: 480, border: `1px solid ${T.line}` }}>
            <AlertTriangle size={22} color={T.ember} />
            <div style={{ fontFamily: T.fDisp, fontSize: 22, marginTop: 12, letterSpacing: '-0.025em' }}>Send to full list?</div>
            <div style={{ marginTop: 10, fontFamily: T.fBody, fontSize: 14, color: T.ink2, lineHeight: 1.5 }}>
              This fires the {tab} dispatch live to every active subscriber. Mittari-gated cron rules still apply. Confirm to proceed.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setFireConfirm(false)} style={{ background: 'transparent', border: `1px solid ${T.line}`, padding: '10px 18px', borderRadius: 4, fontFamily: T.fMono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleFire} data-testid="fire-confirm-yes" style={{ background: T.ember, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 4, fontFamily: T.fMono, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Send now</button>
            </div>
          </div>
        </div>
      )}

      {/* 3-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 560px) 1fr', gap: 0, minHeight: 'calc(100vh - 64px)' }}>
        <div style={{ padding: '24px 32px', borderRight: `1px solid ${T.line}`, overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
          {tab === 'daily' && <DailyTab fields={currentFields} set={setCurrentFields} mittariState={mittariState} />}
          {tab === 'weekly' && <WeeklyTab fields={currentFields} set={setCurrentFields} />}
          {tab === 'welcome' && <WelcomeTab fields={currentFields} set={setCurrentFields} />}
        </div>
        <PreviewPane type={tab} fields={currentFields} />
      </div>
    </div>
  );
};

export default BackOfficeDispatch;
