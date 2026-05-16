import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bell, Mail, MessageCircle, Smartphone, Trophy, Clock, Users, Activity, Flame } from 'lucide-react';
import Dial from '../components/Dial';
import MomentCard from '../components/MomentCard';
import ShareButton from '../components/ShareButton';
import StreamerVideoPreview from '../components/StreamerVideoPreview';
import { STREAMERS, MOMENTS, OPERATORS } from '../data/mock';
import { useLang } from '../context/LanguageContext';

// ── Per-streamer mock data generators (deterministic via slug seed) ──
const seedFromSlug = (slug) => {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const rng = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
};

const dayKeys = ['MA', 'TI', 'KE', 'TO', 'PE', 'LA', 'SU'];
const dayKeysEn = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

// ── Hours-played calendar (8 time blocks × 7 days, 0–4 intensity) ──
const buildSchedule = (slug) => {
  const r = rng(seedFromSlug(slug) + 7);
  // Returns intensity matrix [day][block] 0-4
  return Array.from({ length: 7 }, (_, di) =>
    Array.from({ length: 8 }, (_, bi) => {
      // Evening blocks (5,6,7) more likely lit; early morning unlikely
      const base = bi >= 5 ? 2.4 : bi >= 3 ? 1.4 : 0.4;
      const jitter = r() * 2 - 0.6;
      const v = Math.max(0, Math.min(4, Math.round(base + jitter + (di === 5 ? -1.4 : 0))));
      return v;
    })
  );
};

const buildBiggest = (streamerName) => {
  // 4 biggest moments specific to this streamer (mocked)
  const matched = MOMENTS.filter((m) => m.streamer === streamerName);
  if (matched.length >= 4) return matched.slice(0, 4);
  // Pad from any moments, but rebrand streamer
  const pad = MOMENTS.slice(0, 4 - matched.length).map((m, i) => ({
    ...m,
    id: `${m.id}-pad-${i}`,
    streamer: streamerName,
  }));
  return [...matched, ...pad].slice(0, 4);
};

const buildOperatorUsage = (slug) => {
  // Pick top-4 operators with hours played + "last seen" days
  const r = rng(seedFromSlug(slug) + 19);
  return OPERATORS.slice(0, 4).map((op, i) => ({
    ...op,
    hours: Math.round(2 + r() * 18 + (i === 0 ? 6 : 0)),
    lastDays: Math.max(1, Math.round(r() * 9)),
  })).sort((a, b) => b.hours - a.hours);
};

const buildSocialPosts = (name, lang) => {
  const tplFi = [
    { platform: 'X / Twitter',  hours: 2,  text: 'Tänään 19:00 livenä. Pragmaticin Sweet Bonanza 1000 ja kaikki uutuudet.' },
    { platform: 'Instagram',    hours: 8,  text: 'Eilinen klippi sai 84k katsojaa. Tulee YouTubeen huomenna.' },
    { platform: 'TikTok',       hours: 22, text: 'Fire in the Hole 2 -reaktio — täysi versio kanavalla.' },
    { platform: 'X / Twitter',  hours: 31, text: 'Kicktrailer alkaa: Kick-puolella aukeaa rinnakkaisstriimi tammikuussa.' },
    { platform: 'Instagram',    hours: 50, text: 'Studio päivittyy ensi viikolla. Uudet valot, uusi mikki.' },
    { platform: 'YouTube',      hours: 72, text: 'Sunnuntain "Megaways-spesiaali" -tiivistys nyt katsottavissa.' },
  ];
  const tplEn = [
    { platform: 'X / Twitter',  hours: 2,  text: 'Live tonight at 19:00. Pragmatic\u2019s Sweet Bonanza 1000 + all new releases.' },
    { platform: 'Instagram',    hours: 8,  text: 'Last night\u2019s clip hit 84k views. YouTube cut out tomorrow.' },
    { platform: 'TikTok',       hours: 22, text: 'Fire in the Hole 2 reaction — full version on the channel.' },
    { platform: 'X / Twitter',  hours: 31, text: 'Going Kick: parallel stream opens January.' },
    { platform: 'Instagram',    hours: 50, text: 'Studio refresh next week. New lights, new mic.' },
    { platform: 'YouTube',      hours: 72, text: 'Sunday Megaways special highlight reel up now.' },
  ];
  const arr = lang === 'en' ? tplEn : tplFi;
  return arr.map((p, i) => ({ ...p, id: `${name}-soc-${i}` }));
};

// Generate viewer-rhythm heatmap (24h × 7d) — 0..1 intensity
const buildRhythm = (slug) => {
  const r = rng(seedFromSlug(slug) + 31);
  return Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, (_, h) => {
      const peak = h >= 18 && h <= 23 ? 0.65 : h >= 14 ? 0.35 : 0.05;
      const v = peak + (r() * 0.4 - 0.2);
      return Math.max(0, Math.min(1, v));
    })
  );
};

// Activity feed for this streamer (mocked, last 20)
const buildPersonalFeed = (name, lang) => {
  const r = rng(seedFromSlug(name) + 41);
  const types = lang === 'en'
    ? ['BIG WIN', 'SESSION START', 'VIEWER MILESTONE', 'BIG WIN', 'SESSION END', 'CLIP TRENDED']
    : ['ISO VOITTO', 'STRIIMI ALKOI', 'KATSOJA-MILESTONE', 'ISO VOITTO', 'STRIIMI PÄÄTTYI', 'KLIPPI NOUSI'];
  const detailsFi = [
    'Sweet Bonanza · €4,820',
    'Sessio kesto: 4h 12min',
    '5,000 katsojaa',
    'Money Train 4 · €2,140',
    'Sessio kesto: 6h 42min',
    'Ylilauta /pelit/ · +84 viestiä',
  ];
  const detailsEn = [
    'Sweet Bonanza · €4,820',
    'Session length: 4h 12min',
    '5,000 viewers',
    'Money Train 4 · €2,140',
    'Session length: 6h 42min',
    'Trended on Ylilauta · +84 posts',
  ];
  const colorMap = ['#E8924A', '#5A7BB8', '#7A7E83', '#E8924A', '#7A7E83', '#C8423C'];
  return Array.from({ length: 12 }, (_, i) => {
    const k = Math.floor(r() * types.length);
    const hoursAgo = Math.round(i * 1.6 + r() * 1.2);
    return {
      id: `feed-${name}-${i}`,
      type: types[k],
      detail: lang === 'en' ? detailsEn[k] : detailsFi[k],
      hoursAgo,
      color: colorMap[k],
    };
  });
};

// ── Stat card ──
const StatCard = ({ icon: Icon, label, value, sub }) => (
  <div className="panel" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
    <div style={{
      width: 32, height: 32, borderRadius: 4, flexShrink: 0,
      background: 'var(--bg)', border: '1px solid var(--border-strong)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)',
    }}>
      <Icon strokeWidth={1.6} size={14} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.05, marginTop: 2 }}>
        {value}
      </div>
      {sub && (
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  </div>
);

// ── Schedule heatmap (cockpit calendar grid) ──
const ScheduleGrid = ({ schedule, lang }) => {
  const blockLabels = ['00', '03', '06', '09', '12', '15', '18', '21'];
  const dk = lang === 'en' ? dayKeysEn : dayKeys;
  return (
    <div data-testid="schedule-grid">
      <div className="grid" style={{ gridTemplateColumns: `40px repeat(8, 1fr)`, gap: 4 }}>
        <div />
        {blockLabels.map((b) => (
          <div key={b} className="mono text-center" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
            {b}
          </div>
        ))}
        {schedule.map((row, di) => (
          <React.Fragment key={di}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, alignSelf: 'center' }}>
              {dk[di]}
            </div>
            {row.map((v, bi) => (
              <div
                key={bi}
                title={`${dk[di]} ${blockLabels[bi]}:00 · ${v}/4`}
                style={{
                  height: 22, borderRadius: 2,
                  background: v === 0 ? 'var(--surface-2)' : `rgba(232,146,74,${0.15 + v * 0.18})`,
                  border: '1px solid ' + (v === 0 ? 'var(--border)' : 'rgba(232,146,74,0.3)'),
                }}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="mono mt-3" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
        {lang === 'en'
          ? 'BASED ON LAST 6 WEEKS · AUTO-UPDATING'
          : 'PERUSTUU 6 VIIKON HISTORIAAN · PÄIVITTYY'}
      </div>
    </div>
  );
};

// ── Rhythm heatmap (24h × 7d viewer intensity) ──
const RhythmHeatmap = ({ matrix, lang }) => {
  const dk = lang === 'en' ? dayKeysEn : dayKeys;
  return (
    <div data-testid="rhythm-heatmap">
      <div className="grid" style={{ gridTemplateColumns: `36px repeat(24, 1fr)`, gap: 2 }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="mono text-center" style={{ fontSize: 8.5, letterSpacing: '0.1em', color: 'var(--muted)', fontWeight: 600, opacity: h % 3 === 0 ? 1 : 0 }}>
            {String(h).padStart(2, '0')}
          </div>
        ))}
        {matrix.map((row, di) => (
          <React.Fragment key={di}>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 700, alignSelf: 'center' }}>
              {dk[di]}
            </div>
            {row.map((v, hi) => (
              <div
                key={hi}
                style={{
                  height: 14, borderRadius: 2,
                  background: v < 0.1 ? 'var(--surface-2)' : `rgba(200,66,60,${0.12 + v * 0.7})`,
                }}
                title={`${dk[di]} ${String(hi).padStart(2, '0')}:00 · ${Math.round(v * 100)}%`}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const StreamerProfile = () => {
  const { slug } = useParams();
  const { lang, t } = useLang();
  const streamer = STREAMERS.find((s) => s.slug === slug) || STREAMERS[0];

  const [followEmail, setFollowEmail] = useState('');
  const [followDone, setFollowDone] = useState(false);
  const onFollow = (e) => {
    e.preventDefault();
    console.log('streamer-follow', streamer.slug, followEmail);
    setFollowDone(true);
  };

  const seed = seedFromSlug(streamer.slug);
  const r = rng(seed);

  const stats = useMemo(() => ({
    hours7d:    Math.round(28 + r() * 22), // 28-50 h / wk — Twitch-derivable
    avgViewer:  Math.round(1200 + r() * 4500), // Twitch-derivable
    momentsCount: Math.max(1, Math.round(2 + r() * 6)), // archive-derivable
  }), [streamer.slug]); // eslint-disable-line

  const moments = useMemo(() => buildBiggest(streamer.name), [streamer.name]);
  const operatorsUsed = useMemo(() => buildOperatorUsage(streamer.slug), [streamer.slug]);
  const social = useMemo(() => buildSocialPosts(streamer.name, lang), [streamer.name, lang]);
  const schedule = useMemo(() => buildSchedule(streamer.slug), [streamer.slug]);
  const rhythm = useMemo(() => buildRhythm(streamer.slug), [streamer.slug]);
  const personalFeed = useMemo(() => buildPersonalFeed(streamer.name, lang), [streamer.name, lang]);
  const related = STREAMERS.filter((s) => s.slug !== streamer.slug).slice(0, 5);

  const fmt = (n) => n.toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI').replace(/,/g, lang === 'en' ? ',' : ' ');

  // Editorial commentary (institutional Mittarin toimitus voice) — name-localized
  const commentary = lang === 'en'
    ? [
        `${streamer.name} has been around long enough to know what slot streaming actually is — and it isn\u2019t shouting at every spin.`,
        `Mittari\u2019s read: stake size restrained, schedule consistent, audience engaged. The kind of streamer you can leave on in the background and trust the commentary.`,
      ]
    : [
        `${streamer.name} ei kuulu siihen joukkoon, joka huutaa kameralle joka spinnillä. Tyyli on hallittu, panostus malttava.`,
        `Mittarin huomio: viime kuukauden striimitiheys on tasainen — viisi sessiota viikossa, kestot kahdesta kuuteen tuntiin. Bonuksen metsästäminen ei näy aikatauluissa, ja se on hyvä asia.`,
      ];

  return (
    <div data-testid={`streamer-profile-${streamer.slug}`}>
      {/* HERO */}
      <section className="container-wide pt-10 sm:pt-14 pb-8 sm:pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-7">
            <div className="eyebrow mb-3 inline-flex items-center gap-2">
              {streamer.platform.toUpperCase()} · <span className="mono">{streamer.followers}</span> {lang === 'en' ? 'FOLLOWERS' : 'SEURAAJAA'}
            </div>
            <h1 className="display text-5xl sm:text-6xl lg:text-7xl mb-4" data-testid="profile-name">{streamer.name}</h1>

            {streamer.live ? (
              <div className="flex items-center gap-2 mb-5" data-testid="live-status">
                <span className="led" />
                <span className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#C8423C', fontWeight: 700 }}>
                  {lang === 'en' ? 'LIVE NOW' : 'LIVE NYT'}
                </span>
                <span className="mono ml-3" style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.1em' }}>
                  {streamer.playing} · {fmt(streamer.viewers)} {lang === 'en' ? 'viewers' : 'katsojaa'}
                </span>
              </div>
            ) : (
              <div className="mono mb-5" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                {lang === 'en' ? 'OFFLINE — NEXT STREAM TODAY 19:00' : 'OFFLINE — SEURAAVA STRIIMI TÄNÄÄN 19:00'}
              </div>
            )}

            {streamer.sub && <p className="prose-mittari mb-7 max-w-xl">{streamer.sub}</p>}

            {/* Cockpit stat row — only metrics the real pipeline can verify (V2 honesty rule). */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-7" data-testid="profile-stats">
              <StatCard icon={Clock}    label={lang === 'en' ? 'HOURS · 7D' : 'TUNTIA · 7PV'}  value={`${stats.hours7d}h`} />
              <StatCard icon={Users}    label={lang === 'en' ? 'AVG VIEW'   : 'KATSOJA·KA'}     value={fmt(stats.avgViewer)} />
              <StatCard icon={Activity} label={lang === 'en' ? 'MOMENTS · 30D' : 'HETKIÄ · 30PV'} value={`${stats.momentsCount}`} />
            </div>

            {/* Follow CTA — varies by status */}
            {!streamer.live ? (
              followDone ? (
                <div className="panel p-5 inline-flex items-center gap-3" data-testid="follow-success">
                  <div className="led" style={{ background: '#E8924A' }} />
                  <span className="mono" style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--ink)', fontWeight: 600 }}>
                    {lang === 'en' ? `✓ YOU\u2019LL HEAR FROM US WHEN ${streamer.name.toUpperCase()} GOES LIVE.` : `✓ ILMOITAMME KUN ${streamer.name.toUpperCase()} MENEE LIVEEN.`}
                  </span>
                </div>
              ) : (
                <form onSubmit={onFollow} className="flex flex-col sm:flex-row gap-2 max-w-md" data-testid="profile-follow-form">
                  <input
                    type="email"
                    required
                    value={followEmail}
                    onChange={(e) => setFollowEmail(e.target.value)}
                    placeholder={t('home.placeholder_email')}
                    className="mono flex-1"
                    style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13, letterSpacing: '0.06em' }}
                    data-testid="profile-follow-email"
                  />
                  <button type="submit" className="btn-primary" data-testid="profile-follow-submit" style={{ minHeight: 48 }}>
                    <Bell strokeWidth={1.7} size={14} className="mr-2" />
                    {lang === 'en' ? 'NOTIFY ME' : 'ILMOITA MINULLE'}
                  </button>
                </form>
              )
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <a
                  href={streamer.platform === 'Twitch' ? `https://twitch.tv/${streamer.channel}` : `https://kick.com/${streamer.channel}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-primary"
                  data-testid="profile-watch-cta"
                >
                  {lang === 'en' ? `WATCH ON ${streamer.platform.toUpperCase()} →` : `KATSO ${streamer.platform.toUpperCase()}ISSÄ →`}
                </a>
                <button onClick={() => setFollowDone(true)} className="btn-secondary" data-testid="profile-follow-when-offline">
                  <Bell strokeWidth={1.7} size={13} className="mr-2" />
                  {lang === 'en' ? 'NOTIFY NEXT TIME' : 'ILMOITA SEURAAVALLA KERRALLA'}
                </button>
              </div>
            )}

            <div className="mt-5 mono inline-flex items-center gap-4" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
              <span className="inline-flex items-center gap-1.5"><Mail size={11} strokeWidth={1.5} /> EMAIL</span>
              <span className="inline-flex items-center gap-1.5"><MessageCircle size={11} strokeWidth={1.5} /> TELEGRAM</span>
              <span className="inline-flex items-center gap-1.5"><Smartphone size={11} strokeWidth={1.5} /> PUSH</span>
            </div>
          </div>

          {/* Cockpit dial column */}
          <div className="lg:col-span-5">
            <div className="panel p-4 sm:p-6 flex flex-col items-center" data-testid="profile-cockpit">
              <div className="eyebrow mb-3">
                {lang === 'en' ? 'PERSONAL MITTARI · 7D' : 'HENKILÖKOHTAINEN MITTARI · 7PV'}
              </div>
              <Dial size="medium" state={streamer.dial} />
              <div className="grid grid-cols-2 gap-3 mt-5 w-full">
                <StatCard icon={Activity} label={lang === 'en' ? 'MOMENTS · 30D' : 'HETKIÄ · 30PV'} value={`${stats.momentsCount}`} />
                <StatCard icon={Flame}  label={lang === 'en' ? 'TOP GAME' : 'SUOSIKKIPELI'} value={(streamer.playing || 'Sweet Bonanza').split(' ').slice(0, 2).join(' ')} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE EMBED — full-width when live */}
      {streamer.live && (
        <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div className="container-wide py-6 sm:py-8">
            <div className="aspect-video relative overflow-hidden rounded-[4px]" data-testid="profile-live-embed">
              <StreamerVideoPreview streamer={streamer} trigger="always" className="absolute inset-0 w-full h-full" />
            </div>
          </div>
        </section>
      )}

      {/* MITTARI COMMENTARY */}
      <section className="container-wide py-12 sm:py-16">
        <div className="container-narrow !px-0">
          <div className="eyebrow mb-3">{lang === 'en' ? `MITTARI · ${streamer.name.toUpperCase()}` : `MITTARI · ${streamer.name.toUpperCase()}`}</div>
          <h2 className="display text-3xl sm:text-4xl mb-6">
            {lang === 'en' ? 'Steady work, no circus.' : 'Tasaista työtä, ei sirkusta.'}
          </h2>
          <div className="prose-mittari">
            {commentary.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      </section>

      {/* BIGGEST MOMENTS */}
      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-3">{lang === 'en' ? 'BIGGEST MOMENTS' : 'SUURIMMAT HETKET'}</div>
          <h2 className="display text-3xl sm:text-4xl mb-9">
            {lang === 'en' ? `${streamer.name}\u2019s best clips` : `${streamer.name}n parhaat klipit`}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {moments.map((m) => <MomentCard key={m.id} moment={m} />)}
          </div>
        </div>
      </section>

      {/* SCHEDULE — cockpit calendar grid */}
      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-4">
            <div className="eyebrow mb-3">{lang === 'en' ? 'SCHEDULE' : 'AIKATAULU'}</div>
            <h2 className="display text-3xl sm:text-4xl mb-4">
              {lang === 'en' ? `A week with ${streamer.name}` : `Viikko ${streamer.name}lla`}
            </h2>
            <p className="font-serif" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>
              {lang === 'en'
                ? 'Heat shows hours streamed. Auto-updates from the last 6 weeks.'
                : 'Lämpö osoittaa striimitunnit. Päivittyy viimeisestä 6 viikosta.'}
            </p>
          </div>
          <div className="lg:col-span-8">
            <ScheduleGrid schedule={schedule} lang={lang} />
          </div>
        </div>
      </section>

      {/* WHERE STREAMER PLAYS — conversion bridge */}
      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-3">{lang === 'en' ? `WHERE ${streamer.name.toUpperCase()} PLAYS` : `MISSÄ ${streamer.name.toUpperCase()} PELAA`}</div>
          <h2 className="display text-3xl sm:text-4xl mb-9">
            {lang === 'en' ? 'Operators in the last 30 days' : 'Operaattorit viimeisen 30 päivän aikana'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {operatorsUsed.map((op) => (
              <Link
                key={op.slug}
                to={`/kasinot/${op.slug}`}
                className="panel panel-hover p-5 flex flex-col gap-3"
                data-testid={`profile-op-${op.slug}`}
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-[3px] flex items-center justify-center font-display font-bold" style={{ background: 'var(--ink)', color: 'var(--bg)', fontSize: 16 }}>
                    {op.logo}
                  </div>
                  <div className="text-right">
                    <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>MITTARI</div>
                    <div className="mono" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>{op.score}</div>
                  </div>
                </div>
                <div>
                  <div className="font-display font-bold" style={{ color: 'var(--ink)', fontSize: 16 }}>{op.name}</div>
                  <div className="mono mt-1" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: '#E8924A', fontWeight: 600 }}>
                    {op.hours}h · {lang === 'en' ? `LAST ${op.lastDays}D AGO` : `VIIM. ${op.lastDays}PV SITTEN`}
                  </div>
                  <div className="font-serif mt-2" style={{ fontSize: 12, color: 'var(--muted)' }}>{op.offer}</div>
                </div>
                <div className="mono mt-auto" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--brand-blue)', fontWeight: 600 }}>
                  {lang === 'en' ? 'PLAY HERE →' : 'PELAA TÄÄLLÄ →'}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PERSONAL ACTIVITY FEED for this streamer */}
      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-3">{lang === 'en' ? `${streamer.name.toUpperCase()}\u2019S LIVE FEED` : `${streamer.name.toUpperCase()}:N LIVE-SYÖTE`}</div>
          <h2 className="display text-3xl sm:text-4xl mb-8">
            {lang === 'en' ? 'Recent activity' : 'Viimeaikainen toiminta'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="profile-activity-feed">
            {personalFeed.map((ev) => (
              <div key={ev.id} className="panel p-4 flex gap-3 items-start">
                <div style={{ width: 6, height: 36, background: ev.color, borderRadius: 1, marginTop: 2, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: ev.color, fontWeight: 700 }}>
                    {ev.type}
                  </div>
                  <div className="font-serif mt-1" style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.3 }}>
                    {ev.detail}
                  </div>
                  <div className="mono mt-1.5" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
                    {ev.hoursAgo}h {lang === 'en' ? 'ago' : 'sitten'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RHYTHM — viewer heatmap */}
      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-3">{lang === 'en' ? `${streamer.name.toUpperCase()}\u2019S RHYTHM` : `${streamer.name.toUpperCase()}:N RYTMI`}</div>
          <h2 className="display text-3xl sm:text-4xl mb-3">
            {lang === 'en' ? 'When this streamer typically peaks' : 'Milloin striimari yleensä huipentuu'}
          </h2>
          <p className="font-serif mb-7 max-w-xl" style={{ fontSize: 14, color: 'var(--muted)' }}>
            {lang === 'en'
              ? 'Viewer concentration by day-of-week × hour-of-day. Helps you plan your viewing.'
              : 'Katsojien keskittyminen viikonpäivän ja tunnin mukaan. Auttaa suunnittelemaan katsomistasi.'}
          </p>
          <RhythmHeatmap matrix={rhythm} lang={lang} />
        </div>
      </section>

      {/* SOCIAL */}
      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-3">{lang === 'en' ? 'FROM SOCIAL' : 'SOSIAALISESSA MEDIASSA'}</div>
          <h2 className="display text-3xl sm:text-4xl mb-8">
            {lang === 'en' ? `${streamer.name} elsewhere` : `${streamer.name} muualla`}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {social.map((p) => (
              <article key={p.id} className="panel p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="eyebrow">{p.platform}</span>
                  <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
                    {p.hours}h {lang === 'en' ? 'ago' : 'sitten'}
                  </span>
                </div>
                <p className="font-serif" style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink)' }}>{p.text}</p>
              </article>
            ))}
          </div>
          <div className="mono mt-5" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            {lang === 'en' ? 'MOCKED · PHYLLO INTEGRATION IN PHASE 3' : 'MOCKATTU · PHYLLO-YHDISTYS PHASE 3:SSA'}
          </div>
        </div>
      </section>

      {/* SHARE */}
      <section className="py-10 sm:py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <div className="eyebrow mb-1.5">{lang === 'en' ? 'SHARE' : 'JAA'}</div>
            <h3 className="display text-xl sm:text-2xl">
              {lang === 'en' ? `Share ${streamer.name}\u2019s profile` : `Jaa ${streamer.name}n profiili`}
            </h3>
          </div>
          <ShareButton
            variant="dial"
            payload={{
              label: streamer.dial,
              intensity: streamer.dial,
              headline: lang === 'en'
                ? `${streamer.name} · ${streamer.dial} · ${stats.hours7d}h this week`
                : `${streamer.name} · ${streamer.dial} · ${stats.hours7d}h tällä viikolla`,
            }}
            label={lang === 'en' ? 'CREATE SHARE CARD' : 'LUO JAKO-KORTTI'}
            className="btn-secondary"
            dataTestId="profile-share"
          />
        </div>
      </section>

      {/* RELATED */}
      <section className="py-10 sm:py-14" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide mb-5">
          <div className="eyebrow mb-2">{lang === 'en' ? 'SIMILAR' : 'SAMANKALTAISIA'}</div>
          <h2 className="display text-2xl sm:text-3xl">
            {lang === 'en' ? 'Others worth following' : 'Muita seurattavia'}
          </h2>
        </div>
        <div className="container-wide overflow-x-auto scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
          <div className="flex gap-4 pb-2">
            {related.map((s) => (
              <Link
                key={s.slug}
                to={`/striimaajat/${s.slug}`}
                className="panel panel-hover flex-shrink-0 overflow-hidden"
                style={{ width: 220, scrollSnapAlign: 'start' }}
                data-testid={`profile-related-${s.slug}`}
              >
                <div className="aspect-[5/4] relative">
                  <img src={s.photo} alt={s.name} className="absolute inset-0 w-full h-full object-cover" />
                  {s.live && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-[2px]" style={{ background: 'rgba(10,10,10,0.85)' }}>
                      <span className="led" />
                      <span className="mono" style={{ fontSize: 9, letterSpacing: '0.2em', color: '#F5F3EE', fontWeight: 700 }}>LIVE</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-display font-bold" style={{ color: 'var(--ink)', fontSize: 14 }}>{s.name}</div>
                  <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
                    {s.platform.toUpperCase()} · {s.followers}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default StreamerProfile;
