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
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, BarChart3, BookOpen, Bot, ChevronRight, Clapperboard,
  Cog, Command as CommandIcon, Dices, FileText, Flame, Gift, Globe, Inbox, Layers, Link2,
  LogOut, Megaphone, Radio, Search, Settings as SettingsIcon, Shield, Sparkles, Telescope,
  Trophy, Users, Video, Webhook,
} from 'lucide-react';

import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'putki-hq-admin-token';


// ─── Nav registry ─────────────────────────────────────────────────────
// Single source of truth. Used by sidebar AND command palette.
const NAV_GROUPS = [
  {
    label: 'OPS',
    items: [
      { to: '/back-office/bot-routing',  label: 'Bot & Routing',   icon: Bot,        keywords: 'funnel partners affiliate signal_unlock_mode router mint daily dispatch' },
      { to: '/back-office/funnel',       label: 'Funnel history',  icon: BarChart3,  keywords: '30 day conversion stages' },
      { to: '/back-office/runbook',      label: 'Operator runbook', icon: BookOpen,  keywords: 'docs ops playbook cookbook' },
      { to: '/back-office/settings',     label: 'Settings',        icon: SettingsIcon, keywords: 'feature flags voita enable disable preview production sako' },
    ],
  },
  {
    label: 'LEADS & RAFFLES',
    items: [
      { to: '/back-office/voita',                label: 'Voita raffles',     icon: Trophy,   keywords: 'raffle prize draw voita sako gate' },
      { to: '/back-office/voita-results',        label: 'Voita results',     icon: Gift,     keywords: 'winners draw history' },
      { to: '/back-office/mestari-diagnostics',  label: 'Mestari segments',  icon: Telescope, keywords: 'mestari profile cluster' },
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
      { to: '/back-office/news',           label: 'News editor',     icon: FileText,    keywords: 'articles editorial content cite' },
      { to: '/back-office/streamers',      label: 'Streamers',       icon: Clapperboard, keywords: 'kick twitch youtube avatars handles audit' },
      { to: '/back-office/streamer-tags',  label: 'Streamer tags',   icon: Layers,      keywords: 'tags categories' },
      { to: '/back-office/og-images',      label: 'OG images',       icon: Video,       keywords: 'social preview og blocklist' },
    ],
  },
  {
    label: 'TOURNAMENTS',
    items: [
      { to: '/back-office/voyager-tournaments',  label: 'Voyager',     icon: Sparkles, keywords: 'voyager rotation tournaments' },
      { to: '/back-office/voyager-rotation',     label: 'Voyager rotation', icon: Sparkles, keywords: 'rotation weekly' },
      { to: '/back-office/weezy-rally',          label: 'Weezy Rally', icon: Flame,    keywords: 'weezy rally challenge' },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);


// ─── Token persistence ───────────────────────────────────────────────
const tokenStore = {
  get() {
    try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem('putki_back_office_token') || ''; }
    catch { return ''; }
  },
  set(v) {
    try { sessionStorage.setItem(TOKEN_KEY, v); } catch { /* noop */ }
    // Keep the legacy localStorage key in sync ONLY because existing
    // ops pages still read it directly. Once they migrate to the shell
    // we can drop this line.
    try { localStorage.setItem('putki_back_office_token', v); } catch { /* noop */ }
  },
  clear() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
    try { localStorage.removeItem('putki_back_office_token'); } catch { /* noop */ }
  },
};


// ─── Auth gate ───────────────────────────────────────────────────────
const AuthGate = ({ onUnlock, error }) => {
  const [val, setVal] = useState('');
  return (
    <div data-testid="bo-shell-authgate" style={{
      minHeight: '100vh', background: '#0B0A09', color: '#F2EBE0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 420, width: '100%', padding: 32 }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.3em', color: '#E8C26E', fontWeight: 800, marginBottom: 16 }}>
          PUTKI HQ · BACK-OFFICE
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 20px' }}>
          Sign in
        </h1>
        <form onSubmit={(e) => { e.preventDefault(); onUnlock(val); }}>
          <input
            type="password" placeholder="Admin token" value={val}
            onChange={(e) => setVal(e.target.value)} autoFocus
            data-testid="bo-shell-token-input"
            style={{
              width: '100%', padding: '12px 14px', background: 'transparent',
              color: '#F2EBE0', border: '1px solid #2a2722', borderRadius: 4,
              fontFamily: 'ui-monospace, monospace', fontSize: 13, marginBottom: 12,
            }} />
          <button type="submit" data-testid="bo-shell-token-submit"
            style={{
              width: '100%', padding: '13px 18px', background: '#E8C26E', color: '#0B0A09',
              border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.24em', fontWeight: 800, cursor: 'pointer', borderRadius: 4,
            }}>UNLOCK →</button>
        </form>
        {error && <div data-testid="bo-shell-auth-error" style={{ marginTop: 14, color: '#FF8A7F', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{error}</div>}
      </div>
    </div>
  );
};


// ─── Status chip ─────────────────────────────────────────────────────
const StatusChip = ({ label, value, tone = 'neutral', icon: Icon, onClick, testid }) => {
  const toneColor = {
    ok: { dot: '#6FA37D', bg: '#0e1d12' },
    warn: { dot: '#E8C26E', bg: '#1a1610' },
    bad: { dot: '#C8423C', bg: '#211010' },
    neutral: { dot: '#9C8B6B', bg: '#13110d' },
  }[tone];
  return (
    <button onClick={onClick} type="button" data-testid={testid}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', background: toneColor.bg,
        border: '1px solid #2a2722', borderRadius: 999, cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.06em',
        color: '#F2EBE0', whiteSpace: 'nowrap',
      }}>
      {Icon && <Icon size={12} strokeWidth={2.2} style={{ color: toneColor.dot }} />}
      <span style={{ color: '#9C8B6B', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 9.5 }}>{label}</span>
      <span style={{ color: '#F2EBE0', fontWeight: 700 }}>{value}</span>
    </button>
  );
};


// ─── Top status strip ────────────────────────────────────────────────
const StatusStrip = ({ token }) => {
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

  if (!snap || !cfg) return null;

  const signups = snap.stages.find((s) => s.key === 'signup')?.count ?? 0;
  const bound   = snap.stages.find((s) => s.key === 'bound')?.count ?? 0;
  const dmSent  = snap.stages.find((s) => s.key === 'dm_sent')?.count ?? 0;
  const routed  = cfg.signal_unlock_mode === 'routed';
  const dmOn    = !!cfg.daily_dm_enabled;
  const voitaOn = !!pub?.voita_feature_enabled;

  return (
    <div data-testid="bo-shell-status-strip" style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 24px',
      borderBottom: '1px solid #1a1815', background: '#0e0d0b',
      alignItems: 'center',
    }}>
      <StatusChip testid="status-mode"   label="MODE"     value={routed ? 'ROUTED' : 'INFORMATIVE'} tone={routed ? 'ok' : 'neutral'} icon={Link2} onClick={() => navigate('/back-office/bot-routing')} />
      <StatusChip testid="status-dm"     label="DAILY DM" value={dmOn ? 'ON' : 'OFF'}               tone={dmOn ? 'ok' : 'warn'}      icon={Megaphone} onClick={() => navigate('/back-office/bot-routing')} />
      <StatusChip testid="status-voita"  label="VOITA"    value={voitaOn ? 'LIVE' : 'GATED'}        tone={voitaOn ? 'ok' : 'warn'}   icon={Trophy}    onClick={() => navigate('/back-office/settings')} />
      <span style={{ flex: 1 }} />
      <StatusChip testid="status-signups" label="24H SIGNUPS"  value={signups} icon={Users}     onClick={() => navigate('/back-office/funnel')} />
      <StatusChip testid="status-bound"   label="24H BOUND"    value={bound}   icon={Shield}    onClick={() => navigate('/back-office/bot-routing')} />
      <StatusChip testid="status-dmsent"  label="24H DM"       value={dmSent}  tone={dmSent === 0 && dmOn ? 'warn' : 'neutral'} icon={Megaphone} onClick={() => navigate('/back-office/funnel')} />
    </div>
  );
};


// ─── Left nav ────────────────────────────────────────────────────────
const Sidebar = ({ onLogout, onOpenCmd, density, setDensity }) => {
  return (
    <aside data-testid="bo-shell-sidebar" style={{
      width: 240, background: '#0B0A09', borderRight: '1px solid #1a1815',
      display: 'flex', flexDirection: 'column', position: 'sticky', top: 0,
      height: '100vh', overflowY: 'auto',
    }}>
      <NavLink to="/back-office" style={{
        padding: '20px 22px 16px', borderBottom: '1px solid #1a1815',
        textDecoration: 'none',
      }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.3em', color: '#9C8B6B', fontWeight: 800 }}>
          PUTKI HQ
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#F2EBE0', letterSpacing: '-0.01em', marginTop: 2 }}>
          Back-office
        </div>
      </NavLink>

      <button onClick={onOpenCmd} data-testid="bo-shell-cmdk-trigger"
        style={{
          margin: '14px 14px 4px', padding: '8px 12px', background: '#13110d',
          border: '1px solid #2a2722', color: '#9C8B6B', cursor: 'pointer',
          fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 8, borderRadius: 4,
        }}>
        <Search size={13} />
        <span>Jump to…</span>
        <span style={{ marginLeft: 'auto', padding: '1px 5px', background: '#1a1815', border: '1px solid #2a2722', borderRadius: 3, fontSize: 9.5, letterSpacing: '0.06em' }}>⌘K</span>
      </button>

      <nav style={{ padding: '8px 0 24px', flex: 1 }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} style={{ marginTop: 14 }}>
            <div style={{ padding: '4px 22px', fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.24em', color: '#5a4c2e', fontWeight: 800 }}>
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to}
                  data-testid={`bo-shell-nav-${item.to.split('/').pop()}`}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 22px', fontFamily: 'Georgia, serif', fontSize: 14,
                    color: isActive ? '#E8C26E' : '#D8CDB9', textDecoration: 'none',
                    background: isActive ? '#1a1610' : 'transparent',
                    borderLeft: isActive ? '2px solid #E8C26E' : '2px solid transparent',
                    transition: 'background 100ms ease',
                  })}>
                  <Icon size={14} strokeWidth={2} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid #1a1815', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
          data-testid="bo-shell-density-toggle"
          title="Toggle density"
          style={{ background: 'transparent', border: '1px solid #2a2722', color: '#9C8B6B', cursor: 'pointer', fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', padding: '5px 10px', borderRadius: 4 }}>
          {density === 'comfortable' ? 'COMPACT' : 'COMFORT'}
        </button>
        <button onClick={onLogout} data-testid="bo-shell-logout"
          style={{ background: 'transparent', border: 0, color: '#9C8B6B', cursor: 'pointer', fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <LogOut size={12} /> LOG OUT
        </button>
      </div>
    </aside>
  );
};


// ─── Command palette ─────────────────────────────────────────────────
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
          padding: '8px 14px', borderTop: '1px solid var(--border, #2a2722)',
          fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.06em',
          color: feedback?.ok === false ? '#FF8A7F' : '#6FA37D',
          background: feedback?.ok === false ? '#211010' : '#0e1d12',
        }}>
          {busy ? 'Running…' : feedback?.text}
        </div>
      )}
    </CommandDialog>
  );
};


// ─── Density CSS injection (shell-scoped) ────────────────────────────
const DensityStyles = ({ density }) => (
  <style>{`
    .bo-shell-page { padding: ${density === 'compact' ? '20px 22px' : '32px 28px 64px'}; max-width: ${density === 'compact' ? 1280 : 1120}px; margin: 0 auto; }
    .bo-shell-page h1 { font-size: ${density === 'compact' ? 26 : 36}px !important; margin-bottom: ${density === 'compact' ? 4 : 6}px !important; }
    .bo-shell-page h2 { font-size: ${density === 'compact' ? 18 : 22}px !important; }
    .bo-shell-page section { margin-bottom: ${density === 'compact' ? 18 : 32}px !important; }
  `}</style>
);


// ─── Main shell ──────────────────────────────────────────────────────
const BackOfficeShell = () => {
  const [token, setTokenState] = useState(() => tokenStore.get());
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('putki_bo_density') || 'comfortable'; } catch { return 'comfortable'; }
  });
  const location = useLocation();

  // Verify the token by calling a cheap admin endpoint.
  const verify = useCallback(async (candidate) => {
    if (!candidate) return false;
    try {
      const r = await fetch(`${BACKEND}/api/admin/bot/config`, {
        headers: { 'X-Admin-Token': candidate },
      });
      if (r.ok) { setAuthed(true); setAuthError(''); return true; }
      setAuthed(false); setAuthError(r.status === 401 ? 'Invalid admin token.' : `Auth failed (${r.status}).`);
      return false;
    } catch (e) { setAuthed(false); setAuthError(String(e?.message || e)); return false; }
  }, []);

  // Try the persisted token on mount.
  useEffect(() => { if (token) verify(token); }, [token, verify]);

  const onUnlock = async (val) => {
    setTokenState(val); tokenStore.set(val);
    await verify(val);
  };

  const onLogout = () => { tokenStore.clear(); setTokenState(''); setAuthed(false); };

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

  if (!authed) return <AuthGate onUnlock={onUnlock} error={authError} />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0B0A09', color: '#F2EBE0' }}>
      <DensityStyles density={density} />
      <Sidebar onLogout={onLogout} onOpenCmd={() => setCmdkOpen(true)} density={density} setDensity={setDensity} />
      <main data-testid="bo-shell-main" style={{ flex: 1, minWidth: 0 }}>
        <StatusStrip token={token} />
        {currentItem && (
          <div data-testid="bo-shell-breadcrumb" style={{
            padding: '10px 28px', borderBottom: '1px solid #1a1815',
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em', color: '#9C8B6B',
          }}>
            BACK-OFFICE <span style={{ margin: '0 8px' }}>›</span>
            <span style={{ color: '#E8C26E', fontWeight: 700 }}>{currentItem.label.toUpperCase()}</span>
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
