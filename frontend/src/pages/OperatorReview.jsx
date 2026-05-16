import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, Minus, Shield, Clock, Globe, Smartphone } from 'lucide-react';
import { OperatorTeaserCard, scoreColor } from '../components/OperatorCard';
import { OPERATORS, STREAMERS } from '../data/mock';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';

const SCORE_FACTORS = [
  { label: 'Lisenssi & turva',           value: 95 },
  { label: 'Maksunopeus',                value: 92 },
  { label: 'Pelivalikoima',              value: 88 },
  { label: 'Suomenkieliset ominaisuudet', value: 82 },
  { label: 'Asiakaspalvelu',             value: 78 },
  { label: 'Bonusehdot (rehellisyys)',    value: 90 },
];

const PROS = [
  'Talletukset 1 minuutissa, kotiutukset alle 2 tunnissa.',
  'Pragmatic Play, Nolimit City, Hacksaw — täysi kirjasto.',
  'Pay N Play -tuki Brite-pankkitunnistautumisella.',
  'Suomenkielinen chat 24/7, vastausaika alle minuutti.',
];

const CONS = [
  'Tervetuliaisbonuksen kierto on 35x — markkinastandardi, ei loistava.',
  'Pikamaksut vain SEPA-instantilla — kortilla 6–8 h.',
  'VIP-ohjelmaa ei ole julkisesti dokumentoitu.',
];

const FAQS = [
  { q: 'Onko Weezybet luotettava?',                  a: 'Weezybet toimii MGA-lisenssillä, mikä on EU:n korkein vakiintunut sääntelystandardi. Operaattori on toiminut vuodesta 2022. Trustpilot 4.4 / 5, AskGamblersin valitusratkaisuprosentti yli 90 %.' },
  { q: 'Kuinka kauan kotiutus kestää?',              a: 'SEPA-instantilla alle 2 tuntia. Kortille 6–8 tuntia. Pankkisiirrolla 1–2 arkipäivää. Mittarin mittauksissa Weezybet on Suomen kärkikolmikossa maksunopeudessa.' },
  { q: 'Tarvitseeko verifioida tili erikseen?',       a: 'Pay N Play -menetelmällä ei tarvitse — pankkitunnistautuminen riittää. Kortilla talletettaessa KYC tehdään ennen ensimmäistä kotiutusta.' },
  { q: 'Voiko pelata suomeksi?',                     a: 'Koko sivusto on suomenkielinen, mukaan lukien asiakaspalvelu ja bonusehdot.' },
  { q: 'Onko mobiilisovellus?',                      a: 'Erillistä sovellusta ei ole, mutta selainpohjainen mobiilikäyttöliittymä toimii natiivin tasoisesti.' },
  { q: 'Hyväksytäänkö suomalaiset pelaajat?',         a: 'Kyllä. Weezybet hyväksyy suomalaiset pelaajat avoimesti. Huomioi, että Suomen oma rahapelilisenssijärjestelmä avautuu heinäkuussa 2027.' },
  { q: 'Mitkä maksumenetelmät toimivat?',             a: 'Brite (pankkimaksu), Visa/Mastercard, Skrill, Neteller, MuchBetter, Trustly, SEPA-tilisiirto.' },
  { q: 'Onko vastuullisen pelaamisen työkaluja?',     a: 'Kyllä. Talletusrajat, tappiorajat, aikarajat, oma-aloitteinen sulku 24h–pysyvä. Linkit Peluuriin ja Peli poikki -ohjelmaan.' },
];

const OperatorReview = () => {
  const { slug } = useParams();
  const operator = OPERATORS.find((o) => o.slug === slug) || OPERATORS[0];
  const color = scoreColor(operator.score);
  const related = OPERATORS.filter((o) => o.slug !== operator.slug).slice(0, 3);
  const streamerSample = STREAMERS.slice(0, 3);

  return (
    <div data-testid={`operator-review-${operator.slug}`}>
      {/* ABOVE THE FOLD */}
      <section className="container-wide pt-10 sm:pt-16 pb-10 sm:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-7">
            <div className="eyebrow mb-4">Mittari-arvio · {operator.year}</div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[4px] bg-ink text-paper flex items-center justify-center font-display font-black text-5xl flex-shrink-0">
                {operator.logo}
              </div>
              <h1 className="display text-5xl sm:text-7xl">{operator.name}</h1>
            </div>
            <p className="prose-mittari mb-8 max-w-xl">
              {operator.oneLiner} Mittarin näkemys: paketti on kerralla suomalaiselle pelaajalle suunniteltu — Brite, suomenkielinen chat, Pragmatic-kirjasto ja oikeasti nopeat maksut.
            </p>

            <div className="editorial-card p-5 mb-6 max-w-xl">
              <div className="eyebrow mb-2">Tarjous</div>
              <div className="font-display text-xl sm:text-2xl font-bold text-ink mb-1">
                100 % tervetuliaisbonus 500 € asti + 200 ilmaiskierrosta
              </div>
              <div className="font-serif text-[13px] text-muted-text">35x kierto, 30 päivän voimassaolo. Ei käytössä Pragmatic-jättibonuksissa.</div>
            </div>

            <a href="#cta" className="btn-primary" data-testid="operator-primary-cta">
              Pelaa {operator.name}issa →
            </a>
          </div>

          {/* P*rkele Score panel */}
          <div className="lg:col-span-5">
            <div className="editorial-card p-6 sm:p-8 sticky top-24">
              <div className="eyebrow mb-3">P*rkele-pisteet</div>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="font-display font-black text-7xl sm:text-8xl tabular leading-none" style={{ color }}>
                  {operator.score}
                </span>
                <span className="font-display text-lg text-muted-text">/100</span>
              </div>
              <div className="space-y-3">
                {SCORE_FACTORS.map((f) => (
                  <div key={f.label}>
                    <div className="flex justify-between mb-1">
                      <span className="font-display text-[13px] text-ink">{f.label}</span>
                      <span className="font-display text-[13px] font-semibold tabular text-ink">{f.value}</span>
                    </div>
                    <div className="h-[3px] bg-subtle-border rounded-full overflow-hidden">
                      <div className="h-full" style={{ width: `${f.value}%`, backgroundColor: color }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/menetelma" className="btn-ghost mt-6 text-[13px]" data-testid="link-methodology">
                Lue arviointimenetelmästä →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST SIGNALS */}
      <section className="border-y border-subtle-border py-8 sm:py-10">
        <div className="container-wide grid grid-cols-2 sm:grid-cols-5 gap-6 sm:gap-8">
          {[
            { icon: Shield,     label: 'Lisenssi',    value: operator.license },
            { icon: Clock,      label: 'Kotiutus',    value: operator.payout },
            { icon: Globe,      label: 'Trustpilot',  value: `${operator.trustpilot} / 5` },
            { icon: Smartphone, label: 'Perustettu',  value: operator.year },
            { icon: Check,      label: 'Tuki',        value: '24/7 suomeksi' },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-3" data-testid={`trust-${i}`}>
              <t.icon strokeWidth={1.5} size={22} className="text-muted-text flex-shrink-0" />
              <div>
                <div className="eyebrow text-[10px]">{t.label}</div>
                <div className="font-display text-[14px] font-semibold text-ink tabular">{t.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* QUICK FACTS */}
      <section className="container-wide py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-16">
          <div className="lg:col-span-7">
            <div className="eyebrow mb-3">Mittarin näkemys</div>
            <h2 className="display text-3xl sm:text-4xl mb-6">Maksunopeus kuin Veikkauksella, kirjasto kuin Pinnacle.</h2>
            <div className="prose-mittari">
              <p>
                Weezybet on kahdessa vuodessa noussut suomalaisille operaattoreille hankalaksi vertailukohdaksi. Talletukset menevät minuutissa, kotiutukset alle kahdessa tunnissa — luku, jolla useimmat MGA-lisenssoidut sivustot eivät pärjää.
              </p>
              <p>
                Pelikirjasto on tinkimätön: Pragmatic Play, Nolimit City, Hacksaw, Push Gaming. Sweet Bonanza 1000 ja Fire in the Hole 2 ovat saatavilla samana päivänä kuin muillakin huipuilla.
              </p>
              <p>
                Bonuksen 35x-kierto on standardi — ei loistava, ei huono. Markkinoiden parhaat tällä hetkellä Mittarin mittauksissa ovat 25–30x. Pragmatic-jättibonukset jäävät bonuksen ulkopuolelle: kohtuullista, mutta on syytä mainita.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="eyebrow mb-3">Pikatiedot</div>
            <table className="w-full font-display text-[14px]">
              <tbody>
                {[
                  ['Bonus',         operator.offer],
                  ['Minimitalletus', '10 €'],
                  ['Pikamaksu',     '< 2 tuntia'],
                  ['Kielet',        'Suomi, englanti, ruotsi'],
                  ['Valuutta',      'EUR'],
                  ['Tuki',          '24/7 suomeksi (chat)'],
                  ['Mobiilisovellus', 'Selainpohjainen'],
                  ['Maksutavat',    'Brite, Visa, MC, Skrill, Trustly'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-subtle-border">
                    <td className="py-3 pr-4 text-muted-text">{k}</td>
                    <td className="py-3 text-ink font-semibold text-right tabular">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* PROS / CONS */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16">
          <div>
            <div className="eyebrow mb-3">Puolesta</div>
            <ul className="space-y-3">
              {PROS.map((p, i) => (
                <li key={i} className="flex gap-3 font-serif text-[16px] text-ink">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink mt-2.5 flex-shrink-0"></span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">Vastaan</div>
            <ul className="space-y-3">
              {CONS.map((p, i) => (
                <li key={i} className="flex gap-3 font-serif text-[16px] text-ink">
                  <Minus strokeWidth={1.6} size={16} className="text-muted-text mt-1.5 flex-shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* RECENT ACTIVITY */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide">
          <div className="eyebrow mb-3">Striimaajat täällä viimeisen 7 päivän aikana</div>
          <div className="flex flex-wrap gap-4">
            {streamerSample.map((s) => (
              <div key={s.slug} className="flex items-center gap-3 editorial-card px-4 py-3" data-testid={`activity-${s.slug}`}>
                <img src={s.photo} alt={s.name} className="w-9 h-9 rounded-full object-cover" />
                <div>
                  <div className="font-display text-[14px] font-semibold text-ink">{s.name}</div>
                  <div className="font-serif text-[12px] text-muted-text">pelasi {s.playing || 'aiemmin viikolla'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-narrow">
          <div className="eyebrow mb-3">Usein kysytyt</div>
          <h2 className="display text-3xl sm:text-4xl mb-8">Kysymyksiä {operator.name}ista</h2>

          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b border-subtle-border" data-testid={`faq-item-${i}`}>
                <AccordionTrigger className="font-display text-[16px] font-semibold text-ink text-left py-5 hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="font-serif text-[15px] text-ink leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section id="cta" className="border-t border-subtle-border py-16 bg-[#F4F2EE]">
        <div className="container-narrow text-center">
          <div className="eyebrow mb-4">Pelaa</div>
          <h2 className="display text-4xl sm:text-5xl mb-4">{operator.name}</h2>
          <p className="font-serif text-lg text-muted-text mb-8 max-w-md mx-auto">{operator.offer} — 35x kierto, 30 päivän voimassaolo.</p>
          <a href="#" className="btn-primary text-lg" data-testid="operator-bottom-cta">
            Avaa tili {operator.name}issa →
          </a>
        </div>
      </section>

      {/* RELATED */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide">
          <div className="eyebrow mb-3">Vaihtoehtoja</div>
          <h2 className="display text-2xl sm:text-3xl mb-8">Mikäli {operator.name} ei nappaa</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {related.map((op) => (
              <OperatorTeaserCard key={op.slug} operator={op} />
            ))}
          </div>
        </div>
      </section>

      {/* STICKY MOBILE CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-paper border-t border-subtle-border p-3 z-30" data-testid="sticky-mobile-cta">
        <a href="#cta" className="btn-primary w-full justify-center">
          Pelaa {operator.name}issa →
        </a>
      </div>
      <div className="lg:hidden h-16" /> {/* spacer for sticky CTA */}
    </div>
  );
};

export default OperatorReview;
