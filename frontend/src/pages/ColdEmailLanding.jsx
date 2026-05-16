import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Users, Bell } from 'lucide-react';
import { STREAMERS } from '../data/mock';

const FAQS = [
  { q: 'Onko palvelu ilmainen?',         a: 'Kyllä. Mittari-ilmoitukset ovat täysin ilmaisia. Emme veloita käyttäjältä — affiliaatti rahoittaa toiminnan.' },
  { q: 'Tarvitseeko luoda tili?',        a: 'Voit aloittaa pelkällä sähköpostilla. Tiliä ei tarvitse rekisteröidä erikseen.' },
  { q: 'Kuinka usein ilmoituksia tulee?', a: 'Vain silloin kun valitsemasi striimaaja menee liveen. Keskimäärin 3–10 viestiä viikossa per seurattava.' },
  { q: 'Voiko ilmoitukset peruuttaa?',    a: 'Yhdellä klikkauksella. Jokainen viesti sisältää suoran perumislinkin.' },
];

const ColdEmailLanding = () => {
  const featuredStreamers = STREAMERS.filter((s) => s.tier === 1).slice(0, 3);

  return (
    <div className="bg-paper min-h-screen" data-testid="cold-email-page">
      {/* Minimal nav */}
      <header className="py-6">
        <div className="container-wide">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display font-black text-xl tracking-tighter text-ink">Mittari</span>
            <span className="font-display text-[10px] tracking-widest uppercase text-muted-text">.fi</span>
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="container-wide pt-8 sm:pt-16 pb-12">
        <div className="max-w-3xl">
          <h1 className="display text-4xl sm:text-6xl lg:text-7xl mb-6 leading-[1.05]">
            Saa ilmoitus kun lempi-striimari menee liveen
          </h1>
          <p className="font-serif text-lg sm:text-xl text-muted-text leading-relaxed mb-10 max-w-2xl">
            Valitse striimaajat. Saa ilmoitus sähköpostiin, Telegramiin tai puhelimeen heti kun he menevät liveen. Ei spämmiä, ei ehtoja, ilmainen.
          </p>

          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row gap-3 max-w-xl">
            <input
              type="email"
              required
              placeholder="etunimi@esimerkki.fi"
              className="flex-1 px-4 py-4 rounded-[4px] border border-subtle-border bg-paper font-serif text-base text-ink placeholder:text-muted-text focus:outline-none focus:border-ink"
              data-testid="landing-email-input"
            />
            <Link to="/aloita" className="btn-primary" data-testid="landing-cta">
              Aloita ilmoitukset →
            </Link>
          </form>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex -space-x-2">
              {featuredStreamers.map((s) => (
                <img key={s.slug} src={s.photo} alt={s.name} className="w-10 h-10 rounded-full border-2 border-paper object-cover" />
              ))}
            </div>
            <div className="font-display text-[13px] tabular text-ink">
              <strong>4 283</strong> suomalaista saa jo Mittari-ilmoituksia.
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-subtle-border py-16 sm:py-20">
        <div className="container-wide">
          <div className="eyebrow mb-3">Miten se toimii</div>
          <h2 className="display text-3xl sm:text-4xl mb-12 max-w-2xl">Kolme askelta. Kymmenen sekuntia.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Mail,  title: 'Anna sähköpostisi',  body: 'Sähköposti riittää. Ei salasanaa, ei lomaketta.' },
              { icon: Users, title: 'Valitse striimaajat', body: '18 suomalaista striimaajaa. Toggle päälle, toggle pois.' },
              { icon: Bell,  title: 'Saa ilmoitus livenä', body: 'Sekunnin kuluttua kun striimi alkaa. Sähköposti, Telegram tai push.' },
            ].map((step, i) => (
              <div key={i} className="border-t border-ink pt-6" data-testid={`step-${i}`}>
                <div className="font-display text-[11px] uppercase tracking-widest font-semibold text-brand-blue mb-3">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <step.icon strokeWidth={1.4} size={32} className="text-ink mb-4" />
                <h3 className="display text-2xl mb-2">{step.title}</h3>
                <p className="font-serif text-[15px] text-muted-text leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-subtle-border py-16">
        <div className="container-narrow">
          <div className="eyebrow mb-3">Kysyttyä</div>
          <h2 className="display text-3xl sm:text-4xl mb-8">Tiedät jo kaiken — mutta tässä lisätietoa</h2>
          <div className="space-y-6">
            {FAQS.map((f, i) => (
              <div key={i} className="border-t border-subtle-border pt-5">
                <h3 className="font-display text-lg font-semibold mb-2 text-ink">{f.q}</h3>
                <p className="font-serif text-[15px] text-ink leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link to="/aloita" className="btn-primary text-base" data-testid="landing-bottom-cta">
              Aloita ilmoitukset →
            </Link>
          </div>
        </div>
      </section>

      {/* MINIMAL FOOTER */}
      <footer className="border-t border-subtle-border py-8">
        <div className="container-wide flex flex-col sm:flex-row gap-3 justify-between text-[12px] font-display text-muted-text">
          <span>© Mittari.fi · 18+ vain täysi-ikäisille</span>
          <div className="flex gap-4">
            <span>Tietosuoja</span>
            <span>GDPR-suostumus</span>
            <a href="https://peluuri.fi" target="_blank" rel="noreferrer" className="hover:text-brand-blue">Peluuri</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ColdEmailLanding;
