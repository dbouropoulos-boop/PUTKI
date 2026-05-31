/**
 * BackOfficeShell - persistent layout for all back-office pages.
 *
 * Provides:
 *   - Left nav (grouped, current page highlighted, status dots)
 *   - Top status strip (system mode chips, last-error toast, jump-back)
 *   - Cmd+K command palette (jump-to-page + inline feature flips)
 *   - Single auth gate (replaces per-page tokens)
 *
 * Routes that opt in render via React Router's <Outlet />. Pages that
 * use the shell should NOT render their own auth gate or "← Back" link.
 *
 * Phase 2.1 visual lockdown: light theme, ember accent, hairline borders,
 * Inter body, JetBrains Mono labels. All chrome tokens come from the
 * Phase 1 CSS variable system (`--bg`, `--surface`, `--ink`, `--line`,
 * `--ember*`).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, BarChart3, BookOpen, Bot, ChevronRight, Clapperboard,
  Command as CommandIcon, Dices, FileText, Flame, Gift, Globe, Inbox, Layers, Link2,
  LogOut, Megaphone, Menu, Radio, Search, Settings as SettingsIcon, Shield, Sparkles, Telescope,
  Trophy, Users, Video, Webhook,
} from 'lucide-react';

import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'putki-hq-admin-token';

// JetBrains Mono for labels and counters — Phase 1 token system.
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';


// ─── Nav registry ─────────────────────────────────────────────────────
// Single source of truth. Used by sidebar AND command palette.
const NAV_GROUPS = [
  {
    label: 'OPS',
    items: [
      { to: '/back-office/bot-routing',  label: 'Bot & Routing',   icon: Bot,        keywords: 'funnel partners affiliate signal_unlock_mode router mint daily dispatch' },
      { to: '/back-office/funnel',       label: 'Funnel history',  icon: BarChart3,  keywords: '30 day conversion stages' },
      { to: '/back-office/runbook',      label: 'Operator runbook', icon: BookOpen,  keywords: 'docs ops playbook cookbook' },
      { to: '/back-office/activity',     label: 'Activity log',    icon: Activity,   keywords: 'audit history undo mutations log feed who changed' },
      { to: '/back-office/settings',      label: 'Settings',      icon: SettingsIcon, keywords: 'feature flags voita enable disable preview production sako' },
      { to: '/back-office/integrations',  label: 'Integrations',  icon: Link2,        keywords: 'smartico resend twilio telegram oauth analytics third party' },
    ],
  },
  {
    label: 'LEADS & RAFFLES',
    items: [
      { to: '/back-office/leads',                label: 'Unified leads',     icon: Users,    keywords: 'putki_lead timeline join mittari mestari voita email telegram funnel consent' },
      { to: '/back-office/voita',                label: 'Voita raffles',     icon: Trophy,   keywords: 'raffle prize draw voita sako gate' },
      { to: '/back-office/mestari-diagnostics-copy', label: 'Mestari diagnostics', icon: Telescope, keywords: 'mestari profile cluster diagnostics copy' },
      { to: '/back-office/optin-segments',       label: 'Opt-in segments',   icon: Inbox,    keywords: 'consent mestari mittari voita' },
      { to: '/back-office/profiler-funnel',      label: 'Profiler funnel',   icon: Activity, keywords: 'profiler mestari personality' },
    ],
  },
  {
    label: 'TELEGRAM & COMMS',
    items: [
      { to: '/back-office/telegram',  label: 'Telegram webhook', icon: Radio,   keywords: 'bot webhook bound chats audit' },
      { to: '/back-office/webhooks',  label: 'Webhooks audit',   icon: Webhook, keywords: 'audit log inbound outbound' },
    ],
  },
  {
    label: 'CONTENT & STREAMERS',
    items: [
      { to: '/back-office/news-watch',     label: 'News watch',      icon: FileText,    keywords: 'articles editorial content cite rss feeds' },
      { to: '/back-office/streamers',      label: 'Streamers',       icon: Clapperboard, keywords: 'kick twitch youtube avatars handles audit' },
      { to: '/back-office/og-images',      label: 'OG images',       icon: Video,       keywords: 'social preview og card upload regenerate nano banana' },
    ],
  },
  {
    label: 'TOURNAMENTS',
    items: [
      { to: '/back-office/voyager',  label: 'Voyager rotation', icon: Sparkles, keywords: 'voyager rotation weekly tournaments' },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);


// ─── Token persistence ───────────────────────────────────────────────
// iter82 (Task 2.3): consolidated onto a single canonical sessionStorage
// key. The legacy `putki_back_office_token` localStorage mirror was
// dead-code after the iter80 shell-wrapped pages migrated to outlet
// context; this commit removes it entirely. Aligned with the shape used
// by `useBackOfficeToken.js` so future imports can point at one place.
const tokenStore = {
  get() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; }
    catch { return ''; }
  },
  set(v) {
    try { sessionStorage.setItem(TOKEN_KEY, v); } catch { /* noop */ }
    // Best-effort: clean up any leftover legacy localStorage entries from
    // before this hardening. Safe to delete — no one reads it anymore.
    try { localStorage.removeItem('putki_back_office_token'); } catch { /* noop */ }
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
  },
  clear() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
    try { localStorage.removeItem('putki_back_office_token'); } catch { /* noop */ }
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
  },
};


// ─── Auth gate (Phase 2.1 light reskin) ──────────────────────────────
// `expired` distinguishes "first-time sign in" from "session expired
// mid-flow". When expired=true, we surface a calmer ember-soft callout
// so editors realise their unsaved work is preserved in the form state
// of whichever page they were on.
const AuthGate = ({ onUnlock, error, expired = false }) => {
  const [val, setVal] = useState('');
  return (
    <div data-testid="bo-shell-authgate" style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 420, width: '100%', padding: 32 }}>
        <div style={{
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.3em',
          color: 'var(--ember)', fontWeight: 800, marginBottom: 16,
        }}>
          PUTKI HQ · BACK-OFFICE
        </div>
        <h1 className="display" style={{
          fontSize: 32, letterSpacing: '-0.025em', margin: '0 0 20px', color: 'var(--ink)',
        }}>
          {expired ? 'Session expired' : 'Sign in'}
        </h1>
        {expired && (
          <div data-testid="bo-shell-session-expired" style={{
            padding: '10px 14px', borderRadius: 4, marginBottom: 14,
            background: 'var(--ember-soft)', color: 'var(--ember-strong)',
            border: '1px solid var(--ember-soft)',
            fontFamily: MONO, fontSize: 11.5, letterSpacing: '0.04em', lineHeight: 1.55,
          }}>
            Re-enter token to continue. Your unsaved changes are preserved on the
            page you were on.
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); onUnlock(val); }}>
          <input
            type="password" placeholder="Admin token" value={val}
            onChange={(e) => setVal(e.target.value)} autoFocus
            data-testid="bo-shell-token-input"
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--ember)';
              e.target.style.boxShadow = '0 0 0 3px var(--ember-soft)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--line-strong)';
              e.target.style.boxShadow = 'none';
            }}
            style={{
              width: '100%', padding: '12px 14px', background: 'var(--bg)',
              color: 'var(--ink)', border: '1px solid var(--line-strong)',
              borderRadius: 4, fontFamily: MONO, fontSize: 13, marginBottom: 12,
              outline: 'none', transition: 'border-color 100ms ease, box-shadow 100ms ease',
              boxSizing: 'border-box',
            }} />
          <button type="submit" data-testid="bo-shell-token-submit"
            style={{
              width: '100%', padding: '13px 18px', background: 'var(--ember)',
              color: '#FFFFFF', border: 0, fontFamily: MONO, fontSize: 11,
              letterSpacing: '0.24em', fontWeight: 800, cursor: 'pointer', borderRadius: 4,
            }}>UNLOCK →</button>
        </form>
        {error && (
          <div data-testid="bo-shell-auth-error" style={{
            marginTop: 14, color: 'var(--dial-myrsky)',
            fontFamily: MONO, fontSize: 12,
          }}>{error}</div>
        )}
      </div>
    </div>
  );
};


// ─── Status chip (Phase 2.1 light reskin) ────────────────────────────
const StatusChip = ({ label, value, tone = 'neutral', icon: Icon, onClick, testid }) => {
  // Per spec: ember tone for "ok"/"MODE" states, var(--dial-myrsky) for warn,
  // muted for neutral. bg is the matching soft tint.
  const toneColor = {
    ok:      { dot: 'var(--ember-strong)',  bg: 'var(--ember-soft)' },
    warn:    { dot: 'var(--dial-myrsky)',   bg: '#FBEDEC' },
    bad:     { dot: 'var(--dial-myrsky)',   bg: '#FBEDEC' },
    neutral: { dot: 'var(--ink-3)',         bg: 'var(--surface)' },
  }[tone];
  return (
    <button onClick={onClick} type="button" data-testid={testid}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', background: toneColor.bg,
        border: '1px solid var(--line)', borderRadius: 999,
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.06em',
        color: 'var(--ink)', whiteSpace: 'nowrap',
        transition: 'background-color 100ms ease, border-color 100ms ease',
      }}>
      {Icon && <Icon size={12} strokeWidth={2.2} style={{ color: toneColor.dot }} />}
      <span style={{
        color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.16em',
        textTransform: 'uppercase', fontSize: 9.5,
      }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{value}</span>
    </button>
  );
};


// ─── Top status strip (Phase 2.1 light reskin) ───────────────────────
const StatusStrip = ({ token, onOpenMobileNav }) => {
  const navigate = useNavigate();
  const [snap, setSnap] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [pub, setPub] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const hdr = { 'X-Admin-Token': token };
      const [s, c, p] = await Promise.all([
        fetch(`${BACKEND}/api/admin/bot/funnel/snapshot?hours=24`, { headers: hdr }).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/admin/bot/config`,                   { headers: hdr }).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/settings/public`).then((r) => r.ok ? r.json() : null),
      ]);
      setSnap(s); setCfg(c); setPub(p);
    } catch { /* keep last known */ }
  }, [token]);

  useEffect(() => { refresh(); const t = setInterval(refresh, 60_000); return () => clearInterval(t); }, [refresh]);

  // iter84 · render a tiny mobile-only top bar even before snap loads,
  // so users always have access to the hamburger.
  const ready = snap && cfg;

  return (
    <div data-testid="bo-shell-status-strip" style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 24px',
      borderBottom: '1px solid var(--line)', background: 'var(--surface)',
      alignItems: 'center',
    }}>
      <MobileHamburger onClick={onOpenMobileNav} />
      {ready && (
        <>
          <StatusChip testid="status-mode"   label="MODE"     value={cfg.signal_unlock_mode === 'routed' ? 'ROUTED' : 'INFORMATIVE'} tone={cfg.signal_unlock_mode === 'routed' ? 'ok' : 'neutral'} icon={Link2}     onClick={() => navigate('/back-office/bot-routing')} />
          <StatusChip testid="status-dm"     label="DAILY DM" value={cfg.daily_dm_enabled ? 'ON' : 'OFF'}                            tone={cfg.daily_dm_enabled ? 'ok' : 'warn'}                  icon={Megaphone} onClick={() => navigate('/back-office/bot-routing')} />
          <StatusChip testid="status-voita"  label="VOITA"    value={pub?.voita_feature_enabled ? 'LIVE' : 'GATED'}                  tone={pub?.voita_feature_enabled ? 'ok' : 'warn'}            icon={Trophy}    onClick={() => navigate('/back-office/settings')} />
          <span style={{ flex: 1 }} />
          <span className="bo-shell-hide-on-mobile" style={{ display: 'contents' }}>
            <StatusChip testid="status-signups" label="24H SIGNUPS"  value={snap.stages.find((s) => s.key === 'signup')?.count ?? 0} icon={Users}     onClick={() => navigate('/back-office/funnel')} />
            <StatusChip testid="status-bound"   label="24H BOUND"    value={snap.stages.find((s) => s.key === 'bound')?.count ?? 0}  icon={Shield}    onClick={() => navigate('/back-office/bot-routing')} />
            <StatusChip testid="status-dmsent"  label="24H DM"       value={snap.stages.find((s) => s.key === 'dm_sent')?.count ?? 0} tone={(snap.stages.find((s) => s.key === 'dm_sent')?.count ?? 0) === 0 && cfg.daily_dm_enabled ? 'warn' : 'neutral'} icon={Megaphone} onClick={() => navigate('/back-office/funnel')} />
          </span>
        </>
      )}
    </div>
  );
};


// ─── Left nav (Phase 2.1 light reskin) ───────────────────────────────
const Sidebar = ({ onLogout, onOpenCmd, density, setDensity, mobileOpen, onCloseMobile }) => {
  return (
    <>
      {/* Backdrop — only renders when the mobile drawer is open. */}
      {mobileOpen && (
        <div data-testid="bo-shell-sidebar-backdrop"
          onClick={onCloseMobile}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            zIndex: 49, display: 'none',
          }}
          className="bo-shell-mobile-only" />
      )}
      <aside data-testid="bo-shell-sidebar" className={`bo-shell-sidebar${mobileOpen ? ' is-open' : ''}`} style={{
        width: 240, background: 'var(--bg)', borderRight: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0,
        height: '100vh', overflowY: 'auto', zIndex: 50,
      }}>
      <NavLink to="/back-office" style={{
        padding: '20px 22px 16px', borderBottom: '1px solid var(--line)',
        textDecoration: 'none',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.3em',
          color: 'var(--ink-3)', fontWeight: 800,
        }}>
          PUTKI HQ
        </div>
        <div className="display" style={{
          fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.025em', marginTop: 2,
        }}>
          Back-office
        </div>
      </NavLink>

      <button onClick={onOpenCmd} data-testid="bo-shell-cmdk-trigger"
        style={{
          margin: '14px 14px 4px', padding: '8px 12px', background: 'var(--surface)',
          border: '1px solid var(--line)', color: 'var(--ink-3)', cursor: 'pointer',
          fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 8, borderRadius: 4,
          transition: 'background-color 100ms ease, color 100ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--ink)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)';   e.currentTarget.style.color = 'var(--ink-3)'; }}>
        <Search size={13} />
        <span>Jump to…</span>
        <span style={{
          marginLeft: 'auto', padding: '1px 5px', background: 'var(--bg)',
          border: '1px solid var(--line)', borderRadius: 3,
          fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--ink-3)',
        }}>⌘K</span>
      </button>

      <nav style={{ padding: '8px 0 24px', flex: 1 }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} style={{ marginTop: 14 }}>
            <div style={{
              padding: '4px 22px', fontFamily: MONO, fontSize: 11,
              letterSpacing: '0.14em', color: 'var(--ink-3)',
              fontWeight: 700, textTransform: 'uppercase',
            }}>
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to}
                  data-testid={`bo-shell-nav-${item.to.split('/').pop()}`}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 22px',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--ember-strong)' : 'var(--ink-2)',
                    textDecoration: 'none',
                    background: isActive ? 'var(--ember-soft)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--ember)' : '3px solid transparent',
                    transition: 'background 100ms ease, color 100ms ease',
                  })}>
                  <Icon size={14} strokeWidth={2} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{
        borderTop: '1px solid var(--line)', padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
          data-testid="bo-shell-density-toggle"
          title="Toggle density"
          style={{
            background: 'transparent', border: '1px solid var(--line)',
            color: 'var(--ink-3)', cursor: 'pointer',
            fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em',
            padding: '5px 10px', borderRadius: 4,
          }}>
          {density === 'comfortable' ? 'COMPACT' : 'COMFORT'}
        </button>
        <button onClick={onLogout} data-testid="bo-shell-logout"
          style={{
            background: 'transparent', border: 0, color: 'var(--ink-3)',
            cursor: 'pointer', fontFamily: MONO, fontSize: 9.5,
            letterSpacing: '0.16em', display: 'flex', alignItems: 'center', gap: 6,
          }}>
          <LogOut size={12} /> LOG OUT
        </button>
      </div>
    </aside>
    </>
  );
};


// ─── Command palette (Phase 2.1 light reskin) ────────────────────────
// The CommandDialog itself uses shadcn/ui tokens (popover/foreground),
// which Phase 1 already mapped to light. We override the inner items
// to render with the new ember-soft active state.
const CmdkPalette = ({ open, onOpenChange, token, onRefresh }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Live feature flips — gated to avoid accidents.
  const runFlip = async (label, fn) => {
    setBusy(true); setFeedback(null);
    try {
      await fn();
      setFeedback({ ok: true, text: `${label} done.` });
      await onRefresh?.();
    } catch (e) {
      setFeedback({ ok: false, text: `${label} failed: ${String(e?.message || e)}` });
    } finally { setBusy(false); }
  };

  const putConfig = (patch) => fetch(`${BACKEND}/api/admin/bot/config`, {
    method: 'PUT',
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then((r) => r.ok ? r.json() : Promise.reject(`PUT ${r.status}`));

  const putSettings = (patch) => fetch(`${BACKEND}/api/admin/settings`, {
    method: 'PUT',
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then((r) => r.ok ? r.json() : Promise.reject(`PUT ${r.status}`));

  const select = (to) => { onOpenChange(false); navigate(to); };

  return (
    <>
      {/* Selected item ember-soft override — scoped to the dialog. */}
      <style>{`
        [data-testid="bo-shell-cmdk-input"] {
          font-family: ${MONO};
        }
        [cmdk-root] [cmdk-item][data-selected="true"],
        [cmdk-root] [cmdk-item][aria-selected="true"] {
          background: var(--ember-soft) !important;
          color: var(--ember-strong) !important;
        }
        [cmdk-root] [cmdk-group-heading] {
          font-family: ${MONO};
          font-size: 10.5px;
          letter-spacing: 0.14em;
          color: var(--ink-3);
          text-transform: uppercase;
          font-weight: 700;
        }
      `}</style>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandInput placeholder="Search pages or type 'enable voita'…" data-testid="bo-shell-cmdk-input" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {NAV_GROUPS.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem key={item.to} value={`${item.label} ${item.keywords}`}
                    onSelect={() => select(item.to)} data-testid={`cmdk-${item.to.split('/').pop()}`}>
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                    <ChevronRight className="ml-auto h-3 w-3 opacity-40" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
          <CommandGroup heading="ACTIONS · LIVE FLIPS">
            <CommandItem value="enable voita raffles" onSelect={() => runFlip('Enable Voita', () => putSettings({ voita_feature_enabled: true }))} data-testid="cmdk-action-enable-voita">
              <Trophy className="mr-2 h-4 w-4" /> Enable Voita raffles
            </CommandItem>
            <CommandItem value="disable voita raffles" onSelect={() => runFlip('Disable Voita', () => putSettings({ voita_feature_enabled: false }))} data-testid="cmdk-action-disable-voita">
              <Trophy className="mr-2 h-4 w-4 opacity-60" /> Disable Voita (rollback)
            </CommandItem>
            <CommandItem value="enable daily dm dispatch" onSelect={() => runFlip('Enable daily DM', () => putConfig({ daily_dm_enabled: true }))} data-testid="cmdk-action-enable-daily-dm">
              <Megaphone className="mr-2 h-4 w-4" /> Enable daily DM dispatch
            </CommandItem>
            <CommandItem value="disable daily dm dispatch" onSelect={() => runFlip('Disable daily DM', () => putConfig({ daily_dm_enabled: false }))} data-testid="cmdk-action-disable-daily-dm">
              <Megaphone className="mr-2 h-4 w-4 opacity-60" /> Disable daily DM
            </CommandItem>
            <CommandItem value="flip router routed" onSelect={() => runFlip('Flip router → ROUTED', () => putConfig({ signal_unlock_mode: 'routed' }))} data-testid="cmdk-action-flip-routed">
              <Link2 className="mr-2 h-4 w-4" /> Flip router → ROUTED (monetisation)
            </CommandItem>
            <CommandItem value="rollback router informative" onSelect={() => runFlip('Rollback → INFORMATIVE', () => putConfig({ signal_unlock_mode: 'informative' }))} data-testid="cmdk-action-flip-informative">
              <AlertTriangle className="mr-2 h-4 w-4 opacity-60" /> Rollback router → INFORMATIVE
            </CommandItem>
          </CommandGroup>
        </CommandList>
        {(busy || feedback) && (
          <div data-testid="bo-shell-cmdk-feedback" style={{
            padding: '8px 14px', borderTop: '1px solid var(--line)',
            fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
            color: feedback?.ok === false ? 'var(--dial-myrsky)' : 'var(--ember-strong)',
            background: feedback?.ok === false ? '#FBEDEC' : 'var(--ember-soft)',
          }}>
            {busy ? 'Running…' : feedback?.text}
          </div>
        )}
      </CommandDialog>
    </>
  );
};


// ─── Density CSS injection (shell-scoped) ────────────────────────────
const DensityStyles = ({ density }) => (
  <style>{`
    .bo-shell-page { padding: ${density === 'compact' ? '20px 22px' : '32px 28px 64px'}; max-width: ${density === 'compact' ? 1280 : 1120}px; margin: 0 auto; }
    .bo-shell-page h1 { font-size: ${density === 'compact' ? 26 : 36}px !important; margin-bottom: ${density === 'compact' ? 4 : 6}px !important; }
    .bo-shell-page h2 { font-size: ${density === 'compact' ? 18 : 22}px !important; }
    .bo-shell-page section { margin-bottom: ${density === 'compact' ? 18 : 32}px !important; }

    /* iter84 · mobile collapse — at ≤720px the sidebar is a slide-in
       drawer toggled by the hamburger in the status strip. */
    .bo-shell-hamburger { display: none; }
    .bo-shell-mobile-only { display: none; }
    @media (max-width: 720px) {
      .bo-shell-sidebar {
        position: fixed !important;
        top: 0; left: 0;
        height: 100vh !important;
        transform: translateX(-100%);
        transition: transform 220ms ease;
        box-shadow: 4px 0 24px rgba(0,0,0,0.18);
      }
      .bo-shell-sidebar.is-open { transform: translateX(0); }
      .bo-shell-hamburger { display: inline-flex !important; }
      .bo-shell-mobile-only { display: block !important; }
      .bo-shell-page { padding: 18px 14px 48px !important; }
      [data-testid="bo-shell-status-strip"] {
        padding: 10px 14px !important;
        gap: 6px !important;
      }
      [data-testid="bo-shell-breadcrumb"] {
        padding: 8px 14px !important;
      }
      .bo-shell-hide-on-mobile { display: none !important; }
    }
  `}</style>
);


// ─── Mobile-only hamburger toggle (renders inside the status strip) ──
const MobileHamburger = ({ onClick }) => (
  <button onClick={onClick} type="button"
    aria-label="Open navigation"
    data-testid="bo-shell-hamburger"
    className="bo-shell-hamburger"
    style={{
      background: 'transparent', border: '1px solid var(--line)',
      borderRadius: 4, padding: '6px 8px', cursor: 'pointer',
      alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-2)',
    }}>
    <Menu size={16} strokeWidth={2} />
  </button>
);


// ─── Main shell ──────────────────────────────────────────────────────
const BackOfficeShell = () => {
  const [token, setTokenState] = useState(() => tokenStore.get());
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [expired, setExpired] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('putki_bo_density') || 'comfortable'; } catch { return 'comfortable'; }
  });
  const location = useLocation();

  // Verify the token by calling a cheap admin endpoint. The `mode` arg
  // separates first-time mount from periodic re-verification — only the
  // periodic path flips `expired=true` (we don't want the first failed
  // unlock to claim the session expired).
  const verify = useCallback(async (candidate, mode = 'initial') => {
    if (!candidate) return false;
    try {
      const r = await fetch(`${BACKEND}/api/admin/bot/config`, {
        headers: { 'X-Admin-Token': candidate },
      });
      if (r.ok) { setAuthed(true); setAuthError(''); setExpired(false); return true; }
      if (r.status === 401) {
        setAuthed(false);
        setAuthError('Invalid admin token.');
        if (mode === 'periodic') setExpired(true);
        return false;
      }
      setAuthed(false); setAuthError(`Auth failed (${r.status}).`);
      return false;
    } catch (e) { setAuthed(false); setAuthError(String(e?.message || e)); return false; }
  }, []);

  // Try the persisted token on mount.
  useEffect(() => { if (token) verify(token, 'initial'); }, [token, verify]);

  // iter82 (Task 2.3) - periodic re-verification. Every 60 seconds while
  // authed=true, we re-check the token. On 401 we flip into `expired`
  // mode which surfaces the session-expired AuthGate variant.
  useEffect(() => {
    if (!authed || !token) return undefined;
    const id = setInterval(() => { verify(token, 'periodic'); }, 60_000);
    return () => clearInterval(id);
  }, [authed, token, verify]);

  const onUnlock = async (val) => {
    setTokenState(val); tokenStore.set(val);
    setExpired(false);
    await verify(val, 'initial');
  };

  const onLogout = () => {
    tokenStore.clear(); setTokenState(''); setAuthed(false); setExpired(false);
  };

  // Persist density preference.
  useEffect(() => {
    try { localStorage.setItem('putki_bo_density', density); } catch { /* noop */ }
  }, [density]);

  // Cmd+K shortcut. Avoid hijacking inputs that already have focus.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Trigger a window event so wrapped pages can re-fetch after Cmd+K flips.
  const onRefresh = useCallback(async () => {
    window.dispatchEvent(new CustomEvent('bo-shell-refresh'));
  }, []);

  const currentItem = useMemo(
    () => ALL_NAV_ITEMS.find((it) => it.to === location.pathname),
    [location.pathname],
  );

  // iter84 · auto-close the mobile drawer when the user navigates so
  // they don't get stuck with the backdrop covering the page they
  // just opened.
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  if (!authed) return <AuthGate onUnlock={onUnlock} error={authError} expired={expired} />;

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'var(--bg)', color: 'var(--ink)',
    }}>
      <DensityStyles density={density} />
      <Sidebar
        onLogout={onLogout}
        onOpenCmd={() => setCmdkOpen(true)}
        density={density} setDensity={setDensity}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <main data-testid="bo-shell-main" style={{ flex: 1, minWidth: 0 }}>
        <StatusStrip token={token} onOpenMobileNav={() => setMobileNavOpen(true)} />
        {currentItem && (
          <div data-testid="bo-shell-breadcrumb" style={{
            padding: '10px 28px', borderBottom: '1px solid var(--line)',
            fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.18em',
            color: 'var(--ink-3)',
          }}>
            BACK-OFFICE <span style={{ margin: '0 8px' }}>›</span>
            <span style={{ color: 'var(--ember-strong)', fontWeight: 700 }}>{currentItem.label.toUpperCase()}</span>
          </div>
        )}
        <div className="bo-shell-page" data-testid="bo-shell-content">
          <Outlet context={{ token, density, refresh: onRefresh }} />
        </div>
      </main>
      <CmdkPalette open={cmdkOpen} onOpenChange={setCmdkOpen} token={token} onRefresh={onRefresh} />
    </div>
  );
};

export default BackOfficeShell;
export { tokenStore };
