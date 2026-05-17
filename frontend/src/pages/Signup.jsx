import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, Mail, MessageCircle, Smartphone } from 'lucide-react';
import Dial from '../components/Dial';
import { useStreamers } from '../hooks/useRegistry';
import { DIAL_STATES } from '../constants/dial';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const Signup = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState([]);
  const [channels, setChannels] = useState({ email: true, telegram: false, push: false });
  const [showMore, setShowMore] = useState(false);
  const { data: streamers } = useStreamers({ market: 'fi' });
  const [dial, setDial] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/dial`).then((r) => r.json()).then((d) => { if (!cancelled) setDial(d?.state); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const dialState = dial || DIAL_STATES.KYLMA;

  const visible = showMore ? streamers : streamers.slice(0, 12);

  const toggle = (slug) => {
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  };

  return (
    <div className="min-h-screen bg-paper" data-testid="signup-page">
      {/* Minimal nav */}
      <header className="py-6 border-b border-subtle-border">
        <div className="container-wide flex items-baseline justify-between">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display font-black text-xl tracking-tighter text-ink">Mittari</span>
            <span className="font-display text-[10px] tracking-widest uppercase text-muted-text">.fi</span>
          </Link>
          <div className="font-display text-[12px] uppercase tracking-widest text-muted-text tabular">Vaihe {step} / 4</div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b border-subtle-border">
        <div className="container-wide flex gap-1 h-1">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex-1" style={{ backgroundColor: s <= step ? '#1B2D5B' : '#E8E5DF' }}></div>
          ))}
        </div>
      </div>

      <main className="container-narrow py-12 sm:py-20">
        {step === 1 && (
          <div data-testid="signup-step-1">
            <div className="eyebrow mb-3">Aloita</div>
            <h1 className="display text-4xl sm:text-5xl mb-4">Anna sähköpostisi</h1>
            <p className="prose-mittari text-muted-text mb-8">Tiliä ei tarvitse luoda erikseen. Sähköposti riittää.</p>
            <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="etunimi@esimerkki.fi"
                className="w-full px-4 py-4 rounded-[4px] border border-subtle-border bg-paper font-serif text-lg text-ink placeholder:text-muted-text focus:outline-none focus:border-ink"
                data-testid="signup-email-input"
              />
              <button type="submit" className="btn-primary w-full justify-center" data-testid="signup-step1-next">
                Jatka →
              </button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div data-testid="signup-step-2">
            <div className="eyebrow mb-3">Vaihe 2 / 4</div>
            <h1 className="display text-4xl sm:text-5xl mb-4">Valitse striimaajat</h1>
            <p className="prose-mittari text-muted-text mb-8">Voit valita niin monta kuin haluat. Voit muuttaa valintaa myöhemmin.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {visible.map((s) => {
                const isSelected = selected.includes(s.slug);
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => toggle(s.slug)}
                    data-testid={`signup-streamer-${s.slug}`}
                    className={`text-left p-3 border rounded-[4px] transition-colors duration-150 ${
                      isSelected ? 'border-ink bg-[#F4F2EE]' : 'border-subtle-border hover:border-ink'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={s.photo} alt={s.name} className="w-9 h-9 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-sm font-semibold text-ink truncate">{s.name}</div>
                        <div className="font-display text-[11px] text-muted-text uppercase tracking-wider">{s.platform}</div>
                      </div>
                      {isSelected && <Check size={16} strokeWidth={2} className="text-brand-blue flex-shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {!showMore && (
              <button onClick={() => setShowMore(true)} className="btn-ghost mb-8" data-testid="signup-show-more">
                Näytä lisää striimaajia →
              </button>
            )}

            <div className="flex justify-between items-center pt-6 border-t border-subtle-border">
              <span className="font-display text-[13px] text-muted-text tabular">{selected.length} valittu</span>
              <button onClick={() => setStep(3)} disabled={selected.length === 0} className="btn-primary disabled:opacity-40" data-testid="signup-step2-next">
                Jatka →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div data-testid="signup-step-3">
            <div className="eyebrow mb-3">Vaihe 3 / 4</div>
            <h1 className="display text-4xl sm:text-5xl mb-4">Miten haluat ilmoitukset?</h1>
            <p className="prose-mittari text-muted-text mb-8">Valitse yksi tai useampi. Voit aktivoida loput myöhemmin.</p>

            <div className="space-y-4 mb-8">
              {[
                { key: 'email',    icon: Mail,          title: 'Sähköposti',    sub: 'Toimitus sekunneissa. Toimii kaikilla laitteilla.', connect: 'Aktivoitu' },
                { key: 'telegram', icon: MessageCircle, title: 'Telegram',       sub: 'Suomalaisten pelaajien suosima — nopea, hiljainen.', connect: 'Yhdistä Telegram' },
                { key: 'push',     icon: Smartphone,    title: 'Web push',       sub: 'Selaimen ilmoitus. Toimii myös offline-tilassa.',    connect: 'Salli ilmoitukset' },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setChannels({ ...channels, [c.key]: !channels[c.key] })}
                  data-testid={`channel-${c.key}`}
                  className={`w-full text-left p-5 sm:p-6 border rounded-[4px] flex items-start gap-5 transition-colors duration-150 ${
                    channels[c.key] ? 'border-ink bg-[#F4F2EE]' : 'border-subtle-border hover:border-ink'
                  }`}
                >
                  <c.icon strokeWidth={1.4} size={32} className="text-ink flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="font-display text-lg font-bold text-ink mb-1">{c.title}</div>
                    <p className="font-serif text-[14px] text-muted-text leading-relaxed">{c.sub}</p>
                    <div className="mt-3 font-display text-[12px] font-semibold uppercase tracking-wider text-brand-blue">
                      {channels[c.key] ? '✓ Aktiivinen' : c.connect}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button onClick={() => setStep(4)} className="btn-primary w-full justify-center" data-testid="signup-step3-next">
              Vahvista valinnat →
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="text-center" data-testid="signup-step-4">
            <div className="flex justify-center mb-8">
              <Dial size="medium" state={dialState.key} />
            </div>
            <h1 className="display text-4xl sm:text-5xl mb-4">Valmis. Mittari valvoo.</h1>
            <p className="prose-mittari text-muted-text mb-10 max-w-md mx-auto">
              Olet seuraamassa {selected.length || 0} striimaajaa. Saat ilmoituksen heti kun joku heistä menee liveen.
            </p>
            <div className="editorial-card p-6 mb-8 text-left max-w-md mx-auto">
              <div className="eyebrow mb-3">Mittari juuri nyt</div>
              <div className="font-display text-2xl font-bold text-ink mb-1" style={{ color: dialState.color }}>
                {dialState.label}
              </div>
              <p className="font-serif text-[14px] text-muted-text">{dialState.headline || ''}</p>
            </div>
            <Link to="/" className="btn-ghost" data-testid="signup-complete-cta">
              Katso mitä tapahtuu juuri nyt →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default Signup;
