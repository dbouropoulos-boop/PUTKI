/**
 * BackOfficeToday — Phase 2.6 cockpit dashboard at /back-office.
 *
 * Replaces the legacy tile-grid hub + Smartico site-settings form.
 * Renders INSIDE <BackOfficeShell />, so token / sidebar / status strip
 * are inherited via `useOutletContext`.
 *
 * Sections (top → bottom):
 *   1. Status row (4 chips: MODE / DAILY DM / VOITA / 24H)
 *   2. Pending row (4 clickable counters)
 *   3. Recent activity feed (stub until Task 2.7 endpoint exists)
 *   4. Quick actions row (3 ember buttons)
 *   5. Mono footer
 *
 * All chrome uses Phase 1 tokens (var(--bg), --surface, --ember, --line),
 * Inter body, JetBrains Mono labels, Archivo Black `.display` for big
 * numbers + the section heading.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText,
  Inbox, Link2, Megaphone, Skull, Trophy, Users, Webhook, Zap,
} from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

// ─── Helpers ────────────────────────────────────────────────────────
const safeJson = async (url, headers) => {
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
};

const relTime = (iso) => {
  if (!iso) return '-';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const isWithin24h = (iso) => {
  if (!iso) return false;
  return (Date.now() - new Date(iso).getTime()) < 24 * 3600 * 1000;
};


// ─── Status chip ────────────────────────────────────────────────────
const StatusChip = ({ label, value, sub, tone = 'neutral', icon: Icon, testid }) => {
  const palette = {
    ok:      { bg: 'var(--ember-soft)',  dot: 'var(--ember-strong)', text: 'var(--ink)'  },
    warn:    { bg: '#FBEDEC',            dot: 'var(--dial-myrsky)',  text: 'var(--ink)'  },
    neutral: { bg: 'var(--surface)',     dot: 'var(--ink-3)',        text: 'var(--ink)'  },
  }[tone];
  return (
    <div data-testid={testid} style={{
      flex: '1 1 200px', minWidth: 180,
      padding: '14px 18px', background: palette.bg,
      border: '1px solid var(--line)', borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em',
        color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase',
      }}>
        {Icon && <Icon size={12} strokeWidth={2} style={{ color: palette.dot }} />}
        <span>{label}</span>
      </div>
      <div className="display" style={{
        fontSize: 22, letterSpacing: '-0.02em', color: palette.text, lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em',
          color: 'var(--ink-3)',
        }}>{sub}</div>
      )}
    </div>
  );
};


// ─── Pending counter pill ───────────────────────────────────────────
const PendingPill = ({ label, count, to, icon: Icon, testid }) => {
  const navigate = useNavigate();
  const hot = (count || 0) > 0;
  return (
    <button data-testid={testid}
      onClick={() => navigate(to)}
      type="button"
      style={{
        flex: '1 1 200px', minWidth: 180,
        padding: '18px 20px', background: 'var(--bg)',
        border: '1px solid var(--line)', borderRadius: 6,
        textAlign: 'left', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 8,
        transition: 'border-color 120ms ease, transform 120ms ease, background-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ember)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.background = 'var(--surface)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.background = 'var(--bg)';
      }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em',
        color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase',
      }}>
        {Icon && <Icon size={12} strokeWidth={2} />}
        <span>{label}</span>
      </div>
      <div className="display" style={{
        fontSize: 40, lineHeight: 1, letterSpacing: '-0.03em',
        color: hot ? 'var(--ember-strong)' : 'var(--ink-3)',
      }}>
        {Number.isFinite(count) ? count : '—'}
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em',
        color: 'var(--ink-3)', textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        VIEW <ArrowRight size={10} strokeWidth={2.2} />
      </div>
    </button>
  );
};


// ─── Activity feed (stub until Task 2.7) ────────────────────────────
const ActivityFeed = ({ token }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    safeJson(`${BACKEND}/api/admin/back_office_activity?limit=10`, {
      'X-Admin-Token': token || '',
    }).then((j) => {
      if (cancelled) return;
      // Endpoint may not exist yet; null → stub branch renders.
      setRows(Array.isArray(j?.items) ? j.items : (j ? [] : null));
    });
    return () => { cancelled = true; };
  }, [token]);

  // Endpoint missing → Task 2.7 stub.
  if (rows === null) {
    return (
      <div data-testid="bo-today-activity-stub" style={{
        padding: '20px 22px', border: '1px dashed var(--line-strong)',
        borderRadius: 6, background: 'var(--surface)',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.18em',
          color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          ACTIVITY LOG · NOT YET INSTRUMENTED
        </div>
        <p style={{
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14,
          color: 'var(--ink-2)', lineHeight: 1.5, margin: 0, maxWidth: 560,
        }}>
          Activity log launches with Task 2.7. For now, check individual
          page audit trails — every mutation already lands in its own
          collection (queue, news-watch, voita, dispatch_log).
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div data-testid="bo-today-activity-empty" style={{
        padding: '20px 22px', border: '1px solid var(--line)',
        borderRadius: 6, background: 'var(--bg)',
        fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
        color: 'var(--ink-3)',
      }}>
        NO ACTIVITY IN THE LAST WINDOW.
      </div>
    );
  }

  return (
    <div data-testid="bo-today-activity-list" style={{
      border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      {rows.map((r, i) => (
        <button key={r.id || i} type="button"
          data-testid={`bo-today-activity-row-${i}`}
          onClick={() => r.route && navigate(r.route)}
          style={{
            display: 'grid', gridTemplateColumns: '90px 130px 1fr 120px',
            gap: 16, alignItems: 'center', width: '100%',
            padding: '12px 18px', textAlign: 'left', cursor: r.route ? 'pointer' : 'default',
            background: 'transparent', border: 0,
            borderTop: i === 0 ? 0 : '1px solid var(--line)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink-3)' }}>{relTime(r.ts)}</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink-2)' }}>
            {(r.actor_hash || r.actor || 'system').slice(0, 8)}
          </span>
          <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>
            <strong style={{ fontWeight: 600 }}>{r.action_type}</strong>
            {r.entity ? <span style={{ color: 'var(--ink-3)' }}> · {r.entity}</span> : null}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--ember-strong)', justifySelf: 'end' }}>
            {r.route || ''}
          </span>
        </button>
      ))}
    </div>
  );
};


// ─── Quick action button ────────────────────────────────────────────
const ActionButton = ({ label, icon: Icon, to, testid }) => {
  const navigate = useNavigate();
  return (
    <button type="button"
      data-testid={testid}
      onClick={() => navigate(to)}
      style={{
        flex: 1, minWidth: 200,
        padding: '14px 18px', background: 'var(--ember)',
        color: '#FFFFFF', border: 0, borderRadius: 4,
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13.5,
        fontWeight: 600, letterSpacing: '0.01em', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'background-color 120ms ease, transform 120ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ember-strong)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ember)'; }}>
      {Icon && <Icon size={14} strokeWidth={2} />}
      <span>{label}</span>
    </button>
  );
};


// ─── Main page ──────────────────────────────────────────────────────
const BackOfficeToday = () => {
  const { token } = useOutletContext() || {};
  const headers = useMemo(() => ({ 'X-Admin-Token': token || '' }), [token]);

  const [cfg, setCfg]               = useState(null);   // bot config
  const [voita, setVoita]           = useState(null);   // raffle list
  const [leads24, setLeads24]       = useState(null);   // last 24h funnel
  const [leads48, setLeads48]       = useState(null);   // last 24-48h (for delta)
  const [queue, setQueue]           = useState(null);   // queue counts
  const [killed, setKilled]         = useState(null);   // news-watch rejected
  const [webhooks, setWebhooks]     = useState(null);   // webhooks status

  const refresh = useCallback(async () => {
    if (!token) return;
    const [c, v, l1, l2, q, k, w] = await Promise.all([
      safeJson(`${BACKEND}/api/admin/bot/config`,                headers),
      safeJson(`${BACKEND}/api/admin/voita/raffles`,             headers),
      safeJson(`${BACKEND}/api/admin/leads/funnel?hours=24`,     headers),
      safeJson(`${BACKEND}/api/admin/leads/funnel?hours=48`,     headers),
      safeJson(`${BACKEND}/api/admin/queue?status=queued&limit=1`, headers),
      safeJson(`${BACKEND}/api/admin/news-watch/rejected?limit=500`, headers),
      safeJson(`${BACKEND}/api/webhooks/status`,                 {}),
    ]);
    setCfg(c); setVoita(v); setLeads24(l1); setLeads48(l2);
    setQueue(q); setKilled(k); setWebhooks(w);
  }, [token, headers]);

  useEffect(() => { refresh(); }, [refresh]);

  // Listen for the shell's `bo-shell-refresh` event so Cmd+K live flips
  // re-paint the cockpit instantly.
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('bo-shell-refresh', handler);
    return () => window.removeEventListener('bo-shell-refresh', handler);
  }, [refresh]);

  // Compute chip values + tones.
  const routed = cfg?.signal_unlock_mode === 'routed';
  const dmOn   = !!cfg?.daily_dm_enabled;
  const activeRaffles = (voita?.items || []).filter((r) => r?.status === 'open').length;

  const leads24Count = leads24?.stages?.signups?.count ?? 0;
  const leads48Count = leads48?.stages?.signups?.count ?? 0;
  const prevWindow   = Math.max(0, leads48Count - leads24Count);
  const leadsDelta   = leads24Count - prevWindow;
  const leadsSub = `${leadsDelta >= 0 ? '+' : ''}${leadsDelta} vs yesterday`;

  const queuedCount = queue?.counts?.queued ?? 0;
  const killed24h = (killed?.items || []).filter((it) => isWithin24h(it.rejected_at || it.created_at)).length;
  const webhookFailures = useMemo(() => {
    const by = webhooks?.last_webhook_signal_by_source || {};
    let n = 0;
    for (const src of ['twitch', 'kick', 'youtube']) {
      const age = by?.[src]?.last_event_age_seconds;
      // Treat any source older than 24h as a "failure" surface.
      if (typeof age === 'number' && age > 86400) n += 1;
    }
    return n;
  }, [webhooks]);

  // Add a `/` listener — focus the (future) page search; for now scroll
  // to top so the keyboard cue in the footer is honest.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT'
          && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div data-testid="bo-today-dashboard" style={{
      fontFamily: 'Inter, system-ui, sans-serif',
      color: 'var(--ink)',
    }}>
      <header style={{ marginBottom: 28 }}>
        <div style={{
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.24em',
          color: 'var(--ember)', fontWeight: 800, marginBottom: 6,
        }}>
          PUTKI HQ · COCKPIT
        </div>
        <h1 className="display" data-testid="bo-today-heading" style={{
          fontSize: 36, letterSpacing: '-0.025em', margin: 0, color: 'var(--ink)',
        }}>
          Today
        </h1>
      </header>

      {/* ── 1. Status row ───────────────────────────────────────── */}
      <section data-testid="bo-today-status-row" style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28,
      }}>
        <StatusChip
          testid="bo-today-chip-mode"
          label="MODE" icon={Link2}
          value={routed ? 'ROUTED' : 'INFORMATIVE'}
          tone={routed ? 'ok' : 'neutral'}
          sub={routed ? 'Monetisation live' : 'Safety rail engaged'} />
        <StatusChip
          testid="bo-today-chip-daily-dm"
          label="DAILY DM" icon={Megaphone}
          value={dmOn ? 'ON' : 'OFF'}
          tone={dmOn ? 'ok' : 'warn'}
          sub={dmOn ? '09:00 EET dispatch' : 'Subscriber fan-out paused'} />
        <StatusChip
          testid="bo-today-chip-voita"
          label="VOITA" icon={Trophy}
          value={`${activeRaffles} active`}
          tone={activeRaffles > 0 ? 'ok' : 'neutral'}
          sub={activeRaffles > 0
            ? `${activeRaffles === 1 ? 'raffle' : 'raffles'} accepting entries`
            : 'No raffle currently open'} />
        <StatusChip
          testid="bo-today-chip-24h"
          label="24H LEADS" icon={Users}
          value={`${leads24Count}`}
          tone={leadsDelta >= 0 ? 'ok' : 'warn'}
          sub={`${leadsSub}`} />
      </section>

      {/* ── 2. Pending row ──────────────────────────────────────── */}
      <section data-testid="bo-today-pending-row" style={{ marginBottom: 36 }}>
        <div style={{
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.16em',
          color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          PENDING · NEEDS YOUR ATTENTION
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <PendingPill
            testid="bo-today-pending-drafts"
            label="DRAFTS AWAITING APPROVAL"
            count={queuedCount}
            icon={FileText}
            to="/back-office/queue" />
          <PendingPill
            testid="bo-today-pending-killed"
            label="KILLED URLS · 24H"
            count={killed24h}
            icon={Skull}
            to="/back-office/news-watch?filter=killed" />
          <PendingPill
            testid="bo-today-pending-leads"
            label="NEW LEADS · 24H"
            count={leads24Count}
            icon={Inbox}
            to="/back-office/leads" />
          <PendingPill
            testid="bo-today-pending-webhooks"
            label="WEBHOOK FAILURES"
            count={webhookFailures}
            icon={Webhook}
            to="/back-office/webhooks" />
        </div>
      </section>

      {/* ── 3. Recent activity ──────────────────────────────────── */}
      <section data-testid="bo-today-activity" style={{ marginBottom: 36 }}>
        <h2 className="display" style={{
          fontSize: 22, letterSpacing: '-0.015em', margin: '0 0 12px', color: 'var(--ink)',
        }}>
          Recent activity
        </h2>
        <ActivityFeed token={token} />
      </section>

      {/* ── 4. Quick actions ────────────────────────────────────── */}
      <section data-testid="bo-today-quick-actions" style={{ marginBottom: 28 }}>
        <div style={{
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.16em',
          color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          QUICK ACTIONS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <ActionButton
            testid="bo-today-action-approve-draft"
            label="Approve oldest draft"
            icon={CheckCircle2}
            to="/back-office/queue?focus=oldest" />
          <ActionButton
            testid="bo-today-action-dispatch-preview"
            label="Run dispatch preview"
            icon={Zap}
            to="/back-office/dispatch-preview" />
          <ActionButton
            testid="bo-today-action-today-funnel"
            label="View today's funnel"
            icon={Activity}
            to="/back-office/funnel?range=today" />
        </div>
      </section>

      {/* ── 5. Footer ───────────────────────────────────────────── */}
      <footer data-testid="bo-today-footer" style={{
        paddingTop: 24, borderTop: '1px solid var(--line)',
        fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em',
        color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 8,
      }}>
        <Clock size={12} strokeWidth={2} />
        <span>⌘K to jump anywhere · Press / to search this page</span>
      </footer>

      {/* Mobile collapse: 2-col grid on narrow viewports. */}
      <style>{`
        @media (max-width: 720px) {
          [data-testid="bo-today-status-row"] > div,
          [data-testid="bo-today-pending-row"] > div > button {
            flex: 1 1 calc(50% - 6px) !important;
            min-width: 0 !important;
          }
          [data-testid="bo-today-quick-actions"] button {
            flex: 1 1 100% !important;
          }
          [data-testid="bo-today-heading"] {
            font-size: 28px !important;
          }
          [data-testid="bo-today-activity-list"] button {
            grid-template-columns: 70px 1fr !important;
          }
          [data-testid="bo-today-activity-list"] button > :nth-child(2),
          [data-testid="bo-today-activity-list"] button > :nth-child(4) {
            display: none !important;
          }
        }
      `}</style>

      {/* Silence unused-import noise when Icon-only consumer present. */}
      <span style={{ display: 'none' }}>
        <AlertTriangle />
      </span>
    </div>
  );
};

export default BackOfficeToday;
