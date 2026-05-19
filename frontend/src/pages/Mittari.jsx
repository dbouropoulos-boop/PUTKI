/**
 * Mittari — permanent dial home (/mittari).
 *
 * Section layout:
 *   1. Hero — state name big, plain-language reading, large DialCockpit
 *   2. Driver breakdown — current primary driver + sub-scores
 *   3. Methodology summary + link through to /menetelma
 *   4. ProgressiveOptIn — get alerted when the dial moves (sms_bets tag override)
 *   5. TrustPills
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DialCockpit from '../components/DialCockpit';
import ProgressiveOptIn from '../components/ProgressiveOptIn';
import MittariStreak from '../components/MittariStreak';
import { dialReading } from '../constants/dial';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATE_NAME = {
  fi: { KYLMA: 'TYYNI', HAALEA: 'VIRE', KUUMA: 'VIPINÄ', MYRSKY: 'MEININKI', KIIRASTULI: 'PERKELE' },
  en: { KYLMA: 'CALM',  HAALEA: 'BUZZ', KUUMA: 'ACTIVE', MYRSKY: 'ROLLING',  KIIRASTULI: 'PERKELE' },
};

const STATE_COLOR = {
  KYLMA: '#5C8A8A', HAALEA: '#6FA37D', KUUMA: '#D4B445',
  MYRSKY: '#C97A3A', KIIRASTULI: '#C13B2C',
};

const Mittari = () => {
  const { lang } = useLang();
  const [dial, setDial] = useState(null);
  const [stats, setStats] = useState(null);
  const [cockpit, setCockpit] = useState(null);

  useDocumentMeta({
    title: lang === 'en' ? 'Mittari — Scene temperature · PUTKI HQ' : 'Mittari — Skenen lämpötila · PUTKI HQ',
    description: lang === 'en'
      ? 'Mittari is the deterministic gauge of Finland\u2019s scene temperature. Subscribe to state-change alerts.'
      : 'Mittari on deterministinen Suomen skenen lämpötila­mittari. Tilaa tilanvaihto­hälytykset.',
    canonical: `${BACKEND}/mittari`,
  });

  useEffect(() => {
    let stop = false;
    const load = () => {
      Promise.all([
        fetch(`${BACKEND}/api/dial`).then((r) => r.json()),
        fetch(`${BACKEND}/api/data/live-stats`).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/cockpit`).then((r) => r.ok ? r.json() : null),
      ]).then(([d, ls, cp]) => {
        if (stop) return;
        setDial(d); setStats(ls); setCockpit(cp);
      }).catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const stateKey = dial?.state?.key || 'KYLMA';
  const stateName = STATE_NAME[lang === 'en' ? 'en' : 'fi'][stateKey];
  const color = STATE_COLOR[stateKey];
  const reading = dialReading(stateKey, lang, {
    streams: stats?.twitch_live,
    viewers: stats?.twitch_viewers,
  });

  const driverLabel = cockpit?.primary_driver_label?.[lang === 'en' ? 'en' : 'fi'] || '';
  const subScores = cockpit?.sub_scores || {};
  const composite = cockpit?.composite_score ?? dial?.composite_score ?? 0;

  return (
    <div data-testid="mittari-page" style={{
      maxWidth: 1180, margin: '0 auto', padding: '0 32px',
    }}>
      {/* HERO */}
      <section data-testid="mittari-hero" style={{ padding: '48px 0 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 360px) 1fr',
          gap: 56, alignItems: 'center',
        }} className="mittari-hero-grid">
          <div data-testid="mittari-dial-slot">
            <DialCockpit state={stateKey} />
          </div>
          <div>
            <span style={{
              color: 'var(--muted, #9C9587)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.24em', fontWeight: 700,
            }}>MITTARI · NYT</span>
            <h1 data-testid="mittari-state-name" style={{
              fontFamily: 'Georgia, serif', fontWeight: 700,
              fontSize: 'clamp(56px, 7.5vw, 104px)', lineHeight: 0.9,
              letterSpacing: '-0.03em', margin: '10px 0 22px',
              color: color,
              wordBreak: 'break-word',
            }}>{stateName}</h1>
            <p style={{
              color: 'var(--ink, #ECE6D8)', fontSize: 17, lineHeight: 1.55,
              maxWidth: 560, margin: '0 0 18px',
            }}>{reading}</p>
            <MittariStreak />
          </div>
        </div>
      </section>

      {/* DRIVER BREAKDOWN */}
      <section data-testid="mittari-drivers" style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        padding: '32px 0',
      }}>
        <span style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, display: 'block',
          marginBottom: 14,
        }}>{lang === 'en' ? 'WHAT MOVES THE METER' : 'MIKÄ MITTARIA LIIKUTTAA'}</span>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 1, background: 'var(--hairline, #221E1B)',
        }} className="mittari-drivers-grid">
          {[
            { k: 'streamers', label: lang === 'en' ? 'Streamers live' : 'Striimaajat live' },
            { k: 'sports', label: lang === 'en' ? 'Sports events' : 'Urheilutapahtumat' },
            { k: 'forum', label: lang === 'en' ? 'Forum activity' : 'Foorumi­aktiivisuus' },
          ].map((d) => {
            const score = subScores?.[d.k];
            const isPrimary = cockpit?.primary_driver === d.k;
            return (
              <div key={d.k} data-testid={`mittari-driver-${d.k}`} style={{
                padding: '18px 22px',
                background: 'var(--surface, #141210)',
                borderLeft: isPrimary ? `2px solid ${color}` : 'none',
              }}>
                <div style={{
                  color: isPrimary ? color : 'var(--muted, #9C9587)',
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.18em', fontWeight: 700, marginBottom: 4,
                }}>{d.label.toUpperCase()}</div>
                <div style={{
                  color: '#FFFFFF', fontFamily: 'Georgia, serif',
                  fontWeight: 700, fontSize: 26, lineHeight: 1,
                }}>{score == null ? '—' : Math.round(Number(score))}</div>
              </div>
            );
          })}
        </div>
        {driverLabel && (
          <p style={{
            color: 'var(--muted, #9C9587)', fontSize: 12.5, marginTop: 14,
            fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em',
          }}><span data-testid="mittari-primary-driver">{lang === 'en' ? 'PRIMARY DRIVER NOW · ' : 'PÄÄSYY NYT · '}{driverLabel.toUpperCase()}</span>
            <span style={{ opacity: 0.6, margin: '0 10px' }}>·</span>
            {lang === 'en' ? 'COMPOSITE ' : 'YHDISTELMÄ '}{Math.round(composite)}/100</p>
        )}
      </section>

      {/* METHODOLOGY SUMMARY */}
      <section data-testid="mittari-method" style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        padding: '32px 0',
      }}>
        <span style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, display: 'block',
          marginBottom: 14,
        }}>{lang === 'en' ? 'METHOD' : 'MENETELMÄ'}</span>
        <p style={{
          color: 'var(--ink, #ECE6D8)', fontSize: 15.5, lineHeight: 1.6,
          maxWidth: 720, margin: '0 0 18px',
        }}>{lang === 'en'
          ? "Mittari composites streamers live, sports events active, forum activity, and editorial publishing into one 0–100 score, then quantises it into five named states. Same data, same score — every time. No editorial fingers on the dial."
          : "Mittari yhdistää striimaajien live-määrän, aktiiviset urheilu­tapahtumat, foorumi­aktiivisuuden ja toimitusjulkaisut yhdeksi 0–100-pisteeksi ja kvantisoi sen viidelle nimetylle tilalle. Sama data, sama pistemäärä — joka kerta. Mittariin ei kosketa toimituksen sormella."}</p>
        <Link to="/menetelma" data-testid="mittari-method-link" style={{
          color: 'var(--ink, #ECE6D8)',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.18em', fontWeight: 700,
          textDecoration: 'underline', textUnderlineOffset: 4,
        }}>{lang === 'en' ? 'FULL METHODOLOGY →' : 'KOKO MENETELMÄ →'}</Link>
      </section>

      {/* PROGRESSIVE OPT-IN */}
      <section data-testid="mittari-optin" style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        padding: '32px 0 48px',
      }}>
        <span style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, display: 'block',
          marginBottom: 14,
        }}>{lang === 'en' ? 'ALERTS' : 'HÄLYTYKSET'}</span>
        <div style={{ maxWidth: 560 }}>
          <ProgressiveOptIn
            surface="mittari"
            dataTestId="mittari-optin-component"
            valueProps={{
              email: lang === 'en'
                ? 'Daily scene digest at 09:00 — Mittari state, top news, the mood.'
                : 'Päivän skene-tunnelma klo 09.00 — Mittarin tila, päivän uutiset, kokonaiskuva.',
              sms: lang === 'en'
                ? 'Instant SMS when Mittari changes state — never miss a PERKELE.'
                : 'Heti SMS kun Mittari vaihtaa tilaa — älä missaa PERKELEÄ.',
              telegram: lang === 'en'
                ? 'State-change alerts on Telegram. Same content as SMS, different inbox.'
                : 'Tilan­vaihto­hälytykset Telegramissa. Sama sisältö kuin SMS, eri postilaatikko.',
            }}
          />
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .mittari-hero-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .mittari-drivers-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Mittari;
