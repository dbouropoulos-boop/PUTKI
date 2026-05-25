/**
 * PUTKI HQ - Back-office · Mini-game content editor (iter57)
 *
 * CRUD interface for the 3 educational games' question banks (quiz,
 * scenario, insight). The 2 arcade games have no editable content.
 *
 * Each row shows order + prompt + topic_tag. Edit opens an inline form
 * with JSON-edit for the options array (since each game's option schema
 * differs: quiz options are simple labels, scenario options carry a
 * `score` + per-option `explanation_fi`).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Lock, RefreshCw, Plus, Save, Trash2 } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const ADMIN_TOKEN_KEY = 'putki-admin-token';

const GAMES = [
  { slug: 'quiz_gambling_literacy', label: 'Tietoisuustesti (quiz)' },
  { slug: 'scenario_decisions',     label: 'Päätöspolku (scenario)' },
  { slug: 'insight_reveal',         label: 'Tietoraape (insight)' },
];

const MiniGameAdmin = () => {
  const [token, setToken] = useState(localStorage.getItem(ADMIN_TOKEN_KEY) || '');
  const [game, setGame] = useState(GAMES[0].slug);
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'X-Admin-Token': token,
  }), [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/mini-games/questions?slug=${game}`, {
        headers: headers(),
      });
      const d = await r.json();
      setQuestions(d.questions || []);
    } finally { setBusy(false); }
  }, [token, game, headers]);

  useEffect(() => { refresh(); }, [refresh]);

  const startNew = () => {
    const nextOrder = (questions[questions.length - 1]?.order || 0) + 1;
    setSelected(null);
    setForm({
      slug: game, order: nextOrder, prompt_fi: '',
      options: game === 'scenario_decisions'
        ? [{ key: 'a', label_fi: '', score: 0, explanation_fi: '' },
           { key: 'b', label_fi: '', score: 0, explanation_fi: '' },
           { key: 'c', label_fi: '', score: 0, explanation_fi: '' }]
        : game === 'insight_reveal' ? []
        : [{ key: 'a', label_fi: '' }, { key: 'b', label_fi: '' },
           { key: 'c', label_fi: '' }, { key: 'd', label_fi: '' }],
      correct: 'a', explanation_fi: '', topic_tag: '', active: true,
    });
  };

  const startEdit = (q) => {
    setSelected(q.id);
    setForm({ ...q });
  };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/mini-games/questions`, {
        method: 'POST', headers: headers(), body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      await refresh();
      setForm(null); setSelected(null);
    } catch (e) {
      alert(`Tallennus epäonnistui: ${e.message}`);
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Poistetaan kysymys lopullisesti?')) return;
    await fetch(`${BACKEND}/api/admin/mini-games/questions/${id}`, {
      method: 'DELETE', headers: headers(),
    });
    refresh();
  };

  if (!token) {
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 12 }}>
          <Lock size={12} strokeWidth={1.6} style={{ display: 'inline', marginRight: 6 }} />
          BACK-OFFICE LOGIN
        </div>
        <input
          type="password"
          placeholder="Admin token"
          data-testid="mg-admin-token-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              localStorage.setItem(ADMIN_TOKEN_KEY, e.target.value);
              setToken(e.target.value);
            }
          }}
          style={{
            width: '100%', padding: '12px 14px',
            border: '1px solid var(--border)', borderRadius: 4,
            fontFamily: 'inherit', fontSize: 15,
            background: 'var(--surface)', color: 'var(--ink)',
          }}
        />
        <p className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, letterSpacing: '0.1em' }}>
          ENTER tallentaa tokenin sessio-localStorageen
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 24px 80px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 8 }}>
            BACK-OFFICE · MINI-GAME SISÄLTÖ
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>
            Kysymys-pankki
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} className="btn-ghost" data-testid="mg-refresh" style={btn}>
            <RefreshCw size={13} strokeWidth={1.5} style={{ marginRight: 6 }} /> REFRESH
          </button>
          <button onClick={startNew} className="btn-primary" data-testid="mg-new" style={btnPrimary}>
            <Plus size={13} strokeWidth={1.6} style={{ marginRight: 6 }} /> UUSI
          </button>
          <Link to="/back-office/streamers" style={btn}>← STREAMERS</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {GAMES.map(g => (
          <button
            key={g.slug}
            onClick={() => { setGame(g.slug); setForm(null); setSelected(null); }}
            data-testid={`mg-tab-${g.slug}`}
            style={{
              padding: '8px 14px',
              background: game === g.slug ? 'var(--ink)' : 'transparent',
              color: game === g.slug ? 'var(--bg)' : 'var(--ink)',
              border: '1px solid var(--ink)', borderRadius: 4,
              fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: form ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div>
          {busy && <p className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>Ladataan…</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {questions.map(q => (
              <div
                key={q.id}
                data-testid={`mg-row-${q.id}`}
                style={{
                  padding: 14,
                  border: `1px solid ${selected === q.id ? 'var(--ink)' : 'var(--border)'}`,
                  background: 'var(--surface)', borderRadius: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#5A7BB8', fontWeight: 700 }}>
                    #{q.order} · {q.topic_tag || '-'} · {q.active ? 'AKTIIVI' : 'POIS'}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => startEdit(q)} style={btnTiny} data-testid={`mg-edit-${q.id}`}>EDIT</button>
                    <button onClick={() => remove(q.id)} style={{ ...btnTiny, color: '#C8423C' }} data-testid={`mg-del-${q.id}`}>
                      <Trash2 size={11} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--ink)', margin: '8px 0 0', lineHeight: 1.4 }}>
                  {q.prompt_fi}
                </p>
              </div>
            ))}
            {questions.length === 0 && !busy && (
              <p className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>Ei kysymyksiä - luo ensimmäinen UUSI-painikkeesta.</p>
            )}
          </div>
        </div>

        {form && (
          <div style={{
            position: 'sticky', top: 24, alignSelf: 'flex-start',
            padding: 20, border: '2px solid var(--ink)', borderRadius: 6,
            background: 'var(--surface)',
          }}>
            <h3 className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, margin: '0 0 16px' }}>
              {selected ? 'MUOKKAA' : 'UUSI KYSYMYS'}
            </h3>
            <Field label="ORDER" value={form.order} onChange={(v) => setForm({ ...form, order: Number(v) })} type="number" />
            <Field label="PROMPT (FI)" value={form.prompt_fi} onChange={(v) => setForm({ ...form, prompt_fi: v })} multiline />
            {form.slug !== 'insight_reveal' && (
              <Field label="OPTIONS (JSON)" multiline
                value={JSON.stringify(form.options, null, 2)}
                onChange={(v) => {
                  try { setForm({ ...form, options: JSON.parse(v) }); } catch { /* ignore parse errors mid-edit */ }
                }} />
            )}
            {form.slug !== 'insight_reveal' && (
              <Field label="CORRECT (a/b/c/d)" value={form.correct} onChange={(v) => setForm({ ...form, correct: v })} />
            )}
            <Field label="EXPLANATION (FI)" value={form.explanation_fi} onChange={(v) => setForm({ ...form, explanation_fi: v })} multiline />
            <Field label="TOPIC TAG" value={form.topic_tag} onChange={(v) => setForm({ ...form, topic_tag: v })} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0' }}>
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}
                data-testid="mg-active-checkbox" />
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink)' }}>AKTIIVINEN</span>
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={save} disabled={busy} style={btnPrimary} data-testid="mg-save">
                <Save size={13} strokeWidth={1.6} style={{ marginRight: 6 }} /> TALLENNA
              </button>
              <button onClick={() => { setForm(null); setSelected(null); }} style={btn}>PERUUTA</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, type = 'text', multiline = false }) => (
  <div style={{ marginBottom: 12 }}>
    <label className="mono" style={{ display: 'block', fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
      {label}
    </label>
    {multiline ? (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={label.includes('JSON') ? 10 : 3}
        style={{
          width: '100%', padding: '8px 10px',
          border: '1px solid var(--border)', borderRadius: 4,
          fontFamily: label.includes('JSON') ? 'ui-monospace, monospace' : 'Georgia, serif',
          fontSize: label.includes('JSON') ? 12 : 14,
          background: 'var(--bg)', color: 'var(--ink)',
        }}
      />
    ) : (
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '8px 10px',
          border: '1px solid var(--border)', borderRadius: 4,
          fontFamily: 'Georgia, serif', fontSize: 14,
          background: 'var(--bg)', color: 'var(--ink)',
        }}
      />
    )}
  </div>
);

const btn = {
  padding: '8px 14px',
  background: 'transparent', color: 'var(--ink)',
  border: '1px solid var(--border)', borderRadius: 4,
  fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  cursor: 'pointer', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center',
};
const btnPrimary = { ...btn, background: 'var(--ink)', color: 'var(--bg)', border: 'none' };
const btnTiny = { ...btn, padding: '4px 8px', fontSize: 10, letterSpacing: '0.15em' };

export default MiniGameAdmin;
