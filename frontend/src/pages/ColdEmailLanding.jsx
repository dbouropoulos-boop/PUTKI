import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Users, Bell } from 'lucide-react';
import StreamerAvatar from '../components/StreamerAvatar';
import { useStreamers } from '../hooks/useRegistry';
import { useLang } from '../context/LanguageContext';

const FAQS_FI = [
  { q: 'Onko palvelu ilmainen?',         a: 'Kyllä. PUTKI HQ -ilmoitukset ovat täysin ilmaisia. Emme veloita käyttäjältä - affiliaatti rahoittaa toiminnan.' },
  { q: 'Tarvitseeko luoda tili?',        a: 'Voit aloittaa pelkällä sähköpostilla. Tiliä ei tarvitse rekisteröidä erikseen.' },
  { q: 'Kuinka usein ilmoituksia tulee?', a: 'Vain silloin kun valitsemasi striimaaja menee liveen. Keskimäärin 3-10 viestiä viikossa per seurattava.' },
  { q: 'Voiko ilmoitukset peruuttaa?',    a: 'Yhdellä klikkauksella. Jokainen viesti sisältää suoran perumislinkin.' },
];
const FAQS_EN = [
  { q: 'Is the service free?',          a: 'Yes. PUTKI HQ notifications are completely free. We don\u2019t charge users - affiliates fund the operation.' },
  { q: 'Do I need to create an account?', a: 'Email is enough to start. No separate registration required.' },
  { q: 'How often will I get alerts?',   a: 'Only when a streamer you\u2019ve picked goes live. Typically 3-10 messages per week per streamer.' },
  { q: 'Can I unsubscribe?',             a: 'One click. Every message includes a direct unsubscribe link.' },
];

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const ColdEmailLanding = () => {
  const { lang, t } = useLang();
  const { data: streamers } = useStreamers({ market: 'fi' });
  const featuredStreamers = streamers.filter((s) => s.tier === 1).slice(0, 3);
  const [subCount, setSubCount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/signup/count`).then((r) => r.json()).then((d) => { if (!cancelled) setSubCount(d.count ?? 0); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const faqs = lang === 'en' ? FAQS_EN : FAQS_FI;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="cold-email-page">
      <header className="py-6">
        <div className="container-wide">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display font-black text-xl tracking-tighter" style={{ color: 'var(--ink)' }}>PUTKI HQ</span>
            <span className="mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>.fi</span>
          </Link>
        </div>
      </header>

      <section className="container-wide pt-8 sm:pt-16 pb-12">
        <div className="max-w-3xl">
          <h1 className="display text-4xl sm:text-6xl lg:text-7xl mb-6 leading-[1.05]">
            {t('landing.headline')}
          </h1>
          <p className="font-serif text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl" style={{ color: 'var(--muted)' }}>
            {t('landing.sub')}
          </p>

          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row gap-3 max-w-xl">
            <input
              type="email"
              required
              placeholder={t('home.placeholder_email')}
              className="flex-1 mono"
              style={{ padding: '18px 20px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13, letterSpacing: '0.08em', outline: 'none' }}
              data-testid="landing-email-input"
            />
            <Link to="/aloita" className="btn-primary" data-testid="landing-cta">
              {t('btn.start_notifications')}
            </Link>
          </form>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex -space-x-2">
              {featuredStreamers.map((s) => (
                <StreamerAvatar
                  key={s.slug}
                  streamer={s}
                  size={40}
                  shape="circle"
                  style={{ border: `2px solid var(--bg)` }}
                />
              ))}
            </div>
            <div className="mono" style={{ fontSize: 13, letterSpacing: '0.04em', color: 'var(--ink)', fontWeight: 500 }}>
              {subCount != null && <strong>{subCount.toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI').replace(/,/g, ' ')}</strong>} {t('home.email_proof')}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-3">{t('landing.how').toUpperCase()}</div>
          <h2 className="display text-3xl sm:text-4xl mb-12 max-w-2xl">{t('landing.how_title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Mail,  title: t('landing.step1.title'), body: t('landing.step1.body') },
              { icon: Users, title: t('landing.step2.title'), body: t('landing.step2.body') },
              { icon: Bell,  title: t('landing.step3.title'), body: t('landing.step3.body') },
            ].map((step, i) => (
              <div key={i} className="pt-6" style={{ borderTop: '1px solid var(--ink)' }} data-testid={`step-${i}`}>
                <div className="mono mb-3" style={{ fontSize: 11, letterSpacing: '0.22em', fontWeight: 600, color: 'var(--brand-blue)' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <step.icon strokeWidth={1.4} size={32} className="mb-4" style={{ color: 'var(--ink)' }} />
                <h3 className="display text-2xl mb-2">{step.title}</h3>
                <p className="font-serif text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-narrow">
          <div className="eyebrow mb-3">{t('common.faq').toUpperCase()}</div>
          <h2 className="display text-3xl sm:text-4xl mb-8">
            {lang === 'en' ? 'You probably know enough - but here\u2019s more' : 'Tiedät jo kaiken - mutta tässä lisätietoa'}
          </h2>
          <div className="space-y-6">
            {faqs.map((f, i) => (
              <div key={i} className="pt-5" data-testid={`faq-item-${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                <h3 className="font-display text-lg font-semibold mb-2" style={{ color: 'var(--ink)' }}>{f.q}</h3>
                <p className="font-serif text-[15px] leading-relaxed" style={{ color: 'var(--ink)' }}>{f.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link to="/aloita" className="btn-primary" data-testid="landing-bottom-cta">
              {t('btn.start_notifications')}
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-8" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide flex flex-col sm:flex-row gap-3 justify-between mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)' }}>
          <span>© PUTKIHQ.FI · {t('common.18plus')}</span>
          <div className="flex gap-4">
            <span>{t('footer.privacy')}</span>
            <span>GDPR</span>
            <a href="https://peluuri.fi" target="_blank" rel="noreferrer" className="hover:opacity-70">{t('footer.peluuri')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ColdEmailLanding;
