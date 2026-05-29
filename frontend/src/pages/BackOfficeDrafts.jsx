/**
 * BackOfficeDrafts - Phase 4 Week 3 editorial review surface.
 *
 * Lists draft + published items from /api/content/drafts with one-click
 * preview / inline edit / publish / reject. Filtering by status + tier so
 * editorial can triage TIER 2 drafts (regulatory + operator news) first.
 *
 * Auth: X-Admin-Token header (same as /back-office/webhooks).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Lock, RefreshCw, CheckCircle2, XCircle, Edit3, Eye, ArrowUpRight, Loader2 } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATUS_OPTIONS = [
  { value: 'draft',     label: 'LUONNOKSET' },
  { value: 'published', label: 'JULKAISTUT' },
  { value: 'rejected',  label: 'HYLÄTYT' },
  { value: '',          label: 'KAIKKI' },
];

const TIER_OPTIONS = [
  { value: '',  label: 'KAIKKI TIERIT' },
  { value: 1,   label: 'TIER 1 · AUTO' },
  { value: 2,   label: 'TIER 2 · TARKISTUS' },
];

const headers = (tok) => ({ 'X-Admin-Token': tok, 'Content-Type': 'application/json' });

const fmtTs = (iso) => {
  if (!iso) return '-';
  try { return iso.replace('T', ' ').slice(0, 19); } catch { return iso; }
};

const TierBadge = ({ tier }) => {
  const map = {
    1: { bg: '#2c7a4b', label: 'TIER 1 AUTO' },
    2: { bg: '#E8924A', label: 'TIER 2 TARKISTUS' },
    3: { bg: '#7a7e83', label: 'TIER 3 MANUAALI' },
  };
  const meta = map[tier] || { bg: '#6b7280', label: `T${tier}` };
  return (
    <span
      className="mono"
      style={{ fontSize: 9.5, letterSpacing: '0.14em', color: '#fff', background: meta.bg, padding: '3px 8px', fontWeight: 700, borderRadius: 1 }}
      data-testid={`draft-tier-${tier}`}
    >{meta.label}</span>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    draft:     { bg: '#1a1a1a', label: 'LUONNOS' },
    published: { bg: '#2c7a4b', label: 'JULKAISTU' },
    rejected:  { bg: '#C8423C', label: 'HYLÄTTY' },
  };
  const meta = map[status] || { bg: '#6b7280', label: status?.toUpperCase() || '-' };
  return (
    <span
      className="mono"
      style={{ fontSize: 9.5, letterSpacing: '0.14em', color: '#fff', background: meta.bg, padding: '3px 8px', fontWeight: 600, borderRadius: 1 }}
      data-testid={`draft-status-${status}`}
    >{meta.label}</span>
  );
};

const DraftCard = ({ draft, onPreview, onPublish, onReject, busy }) => (
  <div
    className="panel"
    data-testid={`draft-card-${draft.id}`}
    style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <TierBadge tier={draft.tier} />
        <StatusBadge status={draft.status} />
        <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
          {String(draft.type).toUpperCase().replace(/_/g, ' ')}
        </span>
        <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.10em', color: 'var(--muted)' }}>
          · {fmtTs(draft.generated_at)}
        </span>
      </div>
      <div
        className="display mb-1"
        style={{ fontSize: 18, lineHeight: 1.2, color: 'var(--ink)', fontWeight: 700 }}
        data-testid={`draft-headline-${draft.id}`}
      >
        {draft.headline || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>(ei otsikkoa)</span>}
      </div>
      {draft.subhead ? (
        <div className="font-serif mb-2" style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4 }}>
          {draft.subhead}
        </div>
      ) : null}
      <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.10em' }}>
        SLUG · {draft.url_slug}{draft.rate_limited ? ' · RATE-LIMITOITU' : ''}
      </div>
    </div>
    <div className="flex flex-col gap-1.5 flex-shrink-0">
      <button
        type="button"
        onClick={() => onPreview(draft)}
        className="btn-ghost mono"
        data-testid={`draft-preview-btn-${draft.id}`}
        style={{ padding: '6px 10px', fontSize: 9.5, letterSpacing: '0.18em', display: 'inline-flex', alignItems: 'center', gap: 5 }}
      >
        <Eye size={11} strokeWidth={1.7} /> ESIKATSO
      </button>
      {draft.status === 'draft' ? (
        <>
          <button
            type="button"
            onClick={() => onPublish(draft)}
            disabled={busy}
            className="mono"
            data-testid={`draft-publish-btn-${draft.id}`}
            style={{ padding: '6px 10px', fontSize: 9.5, letterSpacing: '0.18em', background: '#2c7a4b', color: '#fff', border: 'none', cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: busy ? 0.5 : 1, borderRadius: 1 }}
          >
            <CheckCircle2 size={11} strokeWidth={1.7} /> JULKAISE
          </button>
          <button
            type="button"
            onClick={() => onReject(draft)}
            disabled={busy}
            className="mono"
            data-testid={`draft-reject-btn-${draft.id}`}
            style={{ padding: '6px 10px', fontSize: 9.5, letterSpacing: '0.18em', background: '#fff', color: '#C8423C', border: '1px solid #C8423C', cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: busy ? 0.5 : 1, borderRadius: 1 }}
          >
            <XCircle size={11} strokeWidth={1.7} /> HYLKÄÄ
          </button>
        </>
      ) : null}
      {draft.status === 'published' && draft.url_slug ? (
        <Link
          to={`/uutiset/${draft.url_slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost mono"
          data-testid={`draft-view-published-${draft.id}`}
          style={{ padding: '6px 10px', fontSize: 9.5, letterSpacing: '0.18em', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <ArrowUpRight size={11} strokeWidth={1.7} /> AVAA
        </Link>
      ) : null}
    </div>
  </div>
);

const PreviewModal = ({ draft, onClose, onSave, busy }) => {
  const [headline, setHeadline] = useState(draft.headline || '');
  const [subhead, setSubhead] = useState(draft.subhead || '');
  const [body, setBody] = useState(draft.body || '');
  const [editing, setEditing] = useState(false);

  // Reset local edits when the user opens a *different* draft. We
  // intentionally key only on `draft.id` - if the parent mutates the
  // body of the same draft we don't want to clobber unsaved edits.
  useEffect(() => {
    setHeadline(draft.headline || '');
    setSubhead(draft.subhead || '');
    setBody(draft.body || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id]);

  const save = async () => {
    await onSave({ headline, subhead, body });
    setEditing(false);
  };

  return (
    <div
      data-testid="draft-preview-modal"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{ maxWidth: 760, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '24px 28px', background: '#fbfaf7' }}
      >
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <div className="mono mb-2" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
              {String(draft.type).toUpperCase().replace(/_/g, ' ')} · TIER {draft.tier}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.10em' }}>
              SLUG · {draft.url_slug} · {fmtTs(draft.generated_at)}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="btn-ghost mono"
              data-testid="draft-toggle-edit-btn"
              style={{ padding: '6px 12px', fontSize: 10.5, letterSpacing: '0.16em' }}
            >
              <Edit3 size={11} strokeWidth={1.7} className="inline mr-1.5" />
              {editing ? 'PERUUTA' : 'MUOKKAA'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost mono" style={{ padding: '6px 10px', fontSize: 10.5, letterSpacing: '0.16em' }} data-testid="draft-close-modal-btn">SULJE</button>
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <label className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>OTSIKKO</label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              data-testid="draft-edit-headline"
              style={{ padding: '8px 12px', border: '1px solid #d6d0c4', background: '#fff', fontFamily: 'inherit', fontSize: 14 }}
            />
            <label className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>ALAOTSIKKO</label>
            <input
              value={subhead}
              onChange={(e) => setSubhead(e.target.value)}
              data-testid="draft-edit-subhead"
              style={{ padding: '8px 12px', border: '1px solid #d6d0c4', background: '#fff', fontFamily: 'inherit', fontSize: 14 }}
            />
            <label className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>BODY (HTML)</label>
            <textarea
              value={body || ''}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              data-testid="draft-edit-body"
              style={{ padding: '10px 12px', border: '1px solid #d6d0c4', background: '#fff', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5 }}
            />
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="mono"
              data-testid="draft-save-edits-btn"
              style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: 11, letterSpacing: '0.18em', background: '#1a1a1a', color: '#fff', border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1 }}
            >
              {busy ? <Loader2 size={11} className="inline animate-spin mr-1.5" /> : null}
              TALLENNA MUOKKAUKSET
            </button>
          </div>
        ) : (
          <>
            <h2 className="display mb-2" style={{ fontSize: 28, lineHeight: 1.15 }}>{headline || '(ei otsikkoa)'}</h2>
            {subhead ? <p className="font-serif mb-6" style={{ fontSize: 16, color: 'var(--muted)', lineHeight: 1.45 }}>{subhead}</p> : null}
            {body ? (
              <div
                className="font-serif"
                data-testid="draft-preview-body"
                style={{ fontSize: 15, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: body }}
              />
            ) : (
              <p className="font-serif" style={{ fontStyle: 'italic', color: 'var(--muted)' }}>
                (Ei body-sisältöä - esim. streamer-alert -kortti ei tarvitse leipätekstiä.)
              </p>
            )}

            {draft.social ? (
              <div className="mt-8 pt-6" style={{ borderTop: '1px solid #e8e4dc' }}>
                <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>SOSIAALINEN META</div>
                <div className="font-serif" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <div data-testid="preview-og-title"><strong>og:title</strong> ({(draft.social.og_title || '').length}/60): {draft.social.og_title}</div>
                  <div data-testid="preview-og-description"><strong>og:description</strong> ({(draft.social.og_description || '').length}/155): {draft.social.og_description}</div>
                  <div data-testid="preview-twitter-description"><strong>twitter:description</strong> ({(draft.social.twitter_description || '').length}/200): {draft.social.twitter_description}</div>
                  <div><strong>twitter:card</strong>: {draft.social.twitter_card}</div>
                  <div><strong>og:image</strong>: {draft.social.og_image_url || '-'}</div>
                  <div data-testid="preview-article-tags"><strong>tags</strong>: {(draft.social.article_tags || []).join(' · ')}</div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

const useToken = () => {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('putki-hq-admin-token') || ''; } catch { return ''; }
  });
  return [token, (v) => { setToken(v); try { localStorage.setItem('putki-hq-admin-token', v); } catch {} }];
};

const BackOfficeDrafts = () => {
  // iter82 · Task 2.2 — shell-injected token short-circuits the per-page gate.
  const _shellCtx = useOutletContext() || {};
  const [_tokenLocal, setToken] = useToken();
  const token = _shellCtx.token || _tokenLocal;
  const [tokenInput, setTokenInput] = useState(token);
  const [drafts, setDrafts] = useState([]);
  const [status, setStatus] = useState('draft');
  const [tier, setTier] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [previewDraft, setPreviewDraft] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (tier !== '' && tier !== null) qs.set('tier', String(tier));
      const r = await fetch(`${BACKEND}/api/content/drafts?${qs}`, { headers: headers(token) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setDrafts(d.drafts || []);
    } catch (e) {
      setError(String(e.message || e));
    } finally { setLoading(false); }
  }, [token, status, tier]);

  useEffect(() => { load(); }, [load]);

  const onPreview = (d) => setPreviewDraft(d);

  const onSaveEdits = async (patch) => {
    if (!previewDraft) return;
    setBusyId(previewDraft.id);
    try {
      const r = await fetch(`${BACKEND}/api/content/drafts/${previewDraft.id}`, {
        method: 'PUT', headers: headers(token), body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // Refresh draft + list
      const fresh = await fetch(`${BACKEND}/api/content/drafts/${previewDraft.id}`, { headers: headers(token) }).then((x) => x.json());
      setPreviewDraft(fresh);
      await load();
    } catch (e) {
      alert(`Tallennus epäonnistui: ${e.message}`);
    } finally { setBusyId(null); }
  };

  const onPublish = async (draft) => {
    if (!window.confirm(`Julkaise "${draft.headline}"?`)) return;
    setBusyId(draft.id);
    try {
      const r = await fetch(`${BACKEND}/api/content/drafts/${draft.id}/publish`, {
        method: 'POST', headers: headers(token),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
      setPreviewDraft(null);
    } catch (e) {
      alert(`Julkaisu epäonnistui: ${e.message}`);
    } finally { setBusyId(null); }
  };

  const onReject = async (draft) => {
    const note = window.prompt(`Hylkää "${draft.headline}". Lisää valinnainen syy:`) || '';
    if (note === null) return;
    setBusyId(draft.id);
    try {
      const r = await fetch(`${BACKEND}/api/content/drafts/${draft.id}/reject`, {
        method: 'POST', headers: headers(token), body: JSON.stringify({ note }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
      setPreviewDraft(null);
    } catch (e) {
      alert(`Hylkäys epäonnistui: ${e.message}`);
    } finally { setBusyId(null); }
  };

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="panel" style={{ padding: '24px 28px', maxWidth: 440, width: '100%' }}>
          <div className="mono mb-4 inline-flex items-center gap-2" style={{ fontSize: 11, letterSpacing: '0.22em' }}>
            <Lock size={12} /> BACK-OFFICE · DRAFTS
          </div>
          <input
            placeholder="X-Admin-Token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            data-testid="drafts-admin-token-input"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d6d0c4', marginBottom: 12, fontFamily: 'monospace' }}
          />
          <button
            onClick={() => setToken(tokenInput)}
            data-testid="drafts-admin-unlock-btn"
            className="mono w-full"
            style={{ padding: '12px', background: '#f4f1ea', border: 'none', fontSize: 11, letterSpacing: '0.22em', cursor: 'pointer' }}
          >UNLOCK →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }} data-testid="back-office-drafts">
      <div className="container-wide py-10">
        <div className="flex items-baseline justify-between mb-6 gap-3 flex-wrap">
          <div>
            <div className="eyebrow mb-2">BACK-OFFICE · DRAFTS</div>
            <h1 className="display text-3xl">Automaattiset luonnokset</h1>
            <p className="font-serif mt-2" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 640 }}>
              Layer 2 -signaaleista syntyneet artikkelit. TIER 1 -kortit julkaistaan automaattisesti, TIER 2 jää tähän tarkistettavaksi.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/back-office" className="btn-ghost mono" data-testid="drafts-back">← BACK-OFFICE</Link>
            <button onClick={load} className="btn-ghost mono" data-testid="drafts-refresh">
              <RefreshCw strokeWidth={1.7} size={12} className="mr-1.5" /> REFRESH
            </button>
          </div>
        </div>

        <div className="panel mb-6 flex gap-3 flex-wrap items-center" style={{ padding: '12px 16px' }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700 }}>SUODATIN</div>
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setStatus(o.value)}
              data-testid={`drafts-filter-status-${o.value || 'all'}`}
              className="mono"
              style={{ padding: '6px 12px', fontSize: 10, letterSpacing: '0.16em', border: '1px solid #d6d0c4', background: status === o.value ? '#1a1a1a' : '#fff', color: status === o.value ? '#fff' : 'var(--ink)', cursor: 'pointer' }}
            >{o.label}</button>
          ))}
          <span style={{ width: 1, height: 18, background: '#d6d0c4' }} />
          {TIER_OPTIONS.map((o) => (
            <button
              key={`tier-${o.value}`}
              onClick={() => setTier(o.value)}
              data-testid={`drafts-filter-tier-${o.value || 'all'}`}
              className="mono"
              style={{ padding: '6px 12px', fontSize: 10, letterSpacing: '0.16em', border: '1px solid #d6d0c4', background: tier === o.value ? '#1a1a1a' : '#fff', color: tier === o.value ? '#fff' : 'var(--ink)', cursor: 'pointer' }}
            >{o.label}</button>
          ))}
        </div>

        {error ? (
          <div className="mono mb-4" data-testid="drafts-error" style={{ color: '#C8423C', fontSize: 11, letterSpacing: '0.14em' }}>
            VIRHE · {error}
          </div>
        ) : null}

        {loading && !drafts.length ? (
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>LADATAAN…</div>
        ) : null}

        {!loading && !drafts.length ? (
          <div className="panel" data-testid="drafts-empty" style={{ padding: '24px 28px' }}>
            <div className="mono mb-2" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)' }}>EI LUONNOKSIA</div>
            <p className="font-serif" style={{ fontSize: 13, color: 'var(--muted)' }}>
              Suodatin ei tuottanut osumia. Layer 2 -pollerit ovat hiljaisia tai kaikki on jo käsitelty.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3" data-testid="drafts-list">
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              onPreview={onPreview}
              onPublish={onPublish}
              onReject={onReject}
              busy={busyId === d.id}
            />
          ))}
        </div>
      </div>

      {previewDraft ? (
        <PreviewModal
          draft={previewDraft}
          onClose={() => setPreviewDraft(null)}
          onSave={onSaveEdits}
          busy={busyId === previewDraft.id}
        />
      ) : null}
    </div>
  );
};

export default BackOfficeDrafts;
