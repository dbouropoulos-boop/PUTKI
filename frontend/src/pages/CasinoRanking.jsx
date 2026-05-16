import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Info } from 'lucide-react';
import { OperatorRow } from '../components/OperatorCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { OPERATORS } from '../data/mock';

const FILTERS = [
  { key: 'kaikki',     label: 'Kaikki' },
  { key: 'slotit',     label: 'Slotit' },
  { key: 'live',       label: 'Live-kasino' },
  { key: 'paynplay',   label: 'Pay N Play' },
  { key: 'mga',        label: 'MGA-lisenssi' },
  { key: 'pikamaksu',  label: 'Pikamaksu < 2 h' },
  { key: 'suomeksi',   label: 'Suomenkielinen' },
];

const SORTS = [
  { key: 'mittari',  label: 'P*rkele-pisteet' },
  { key: 'payout',   label: 'Maksunopeus' },
  { key: 'trust',    label: 'Trustpilot' },
  { key: 'newest',   label: 'Uusimmat' },
];

const ARTICLES = [
  { title: 'Miten Suomen rahapelilainsäädäntö muuttuu heinäkuussa 2027', excerpt: 'Mittarin selitys uudesta lisenssijärjestelmästä ja siitä, mitä se merkitsee pelaajalle.' },
  { title: 'Pay N Play pelaajan näkökulmasta — toimiiko se aina?', excerpt: 'Vertaamme kolmen suurimman PNP-operaattorin toimintaa kuukauden seurannan jälkeen.' },
  { title: 'Mittari-pisteet selitettynä: mikä laskee, mikä nostaa?', excerpt: 'Avoin metodologia. Ei mainos. Ei myyntiä — kerromme miten oikeasti pisteytämme.' },
  { title: 'Suomalaiset slot-striimaajat — keiden seuraamisesta voi oppia?', excerpt: 'Toimituksellinen katsaus 18 seuratuimpaan suomalaiseen pelistriimaajaan.' },
];

const CasinoRanking = () => {
  const [filter, setFilter] = useState('kaikki');
  const [sort, setSort] = useState('mittari');

  const sorted = useMemo(() => {
    const arr = [...OPERATORS];
    if (sort === 'mittari') arr.sort((a, b) => b.score - a.score);
    else if (sort === 'trust') arr.sort((a, b) => b.trustpilot - a.trustpilot);
    else if (sort === 'newest') arr.sort((a, b) => b.year - a.year);
    return arr;
  }, [sort]);

  return (
    <div data-testid="casino-ranking-page">
      {/* HEADER */}
      <section className="container-wide pt-12 sm:pt-20 pb-8 sm:pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4">Mittari-vertailu · Päivitetty {new Date().toLocaleDateString('fi-FI')}</div>
          <h1 className="display text-4xl sm:text-6xl mb-5">Suomen parhaat nettikasinot</h1>
          <p className="prose-mittari text-muted-text max-w-2xl">
            Mittari-pisteet syntyvät datasta ja toimituksellisesta arvioinnista. Maksunopeus, lisenssin painoarvo, pelikirjasto, suomenkieliset ominaisuudet, asiakaspalvelun reagointiaika, bonusehtojen rehellisyys. Ei sponsoroituja sijoituksia.
          </p>
        </div>
      </section>

      {/* METHODOLOGY BANNER */}
      <section className="container-wide pb-6">
        <Link to="/menetelma" className="editorial-card flex items-start gap-3 p-4 max-w-3xl hover:border-ink" data-testid="methodology-banner">
          <Info strokeWidth={1.5} size={18} className="text-brand-blue flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-display text-[14px] text-ink font-semibold">Mittari-arviointi:</span>
            <span className="font-serif text-[14px] text-muted-text ml-1">data + toimitukselliset valinnat.</span>
            <span className="font-display text-[14px] text-brand-blue font-semibold ml-2">Lue arviointimenetelmästä →</span>
          </div>
        </Link>
      </section>

      {/* FILTERS + SORT */}
      <section className="border-y border-subtle-border py-4 sm:py-5 bg-paper sticky top-16 z-30">
        <div className="container-wide flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 sm:mx-0 sm:px-0" data-testid="filter-chips">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                data-testid={`filter-${f.key}`}
                className={`whitespace-nowrap font-display text-[13px] font-semibold px-4 py-2 rounded-full border transition-colors duration-200 ${
                  filter === f.key
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-paper text-ink border-subtle-border hover:border-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="eyebrow">Järjestä</span>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[200px] rounded-[4px] border-subtle-border font-display text-[13px]" data-testid="sort-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.key} value={s.key} className="font-display text-[13px]">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* RANKING TABLE */}
      <section className="container-wide py-6 sm:py-10">
        <div>
          {sorted.map((op, i) => (
            <OperatorRow key={op.slug} operator={op} rank={i + 1} />
          ))}
        </div>
      </section>

      {/* EDITORIAL ARTICLES */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide">
          <div className="eyebrow mb-3">Vertailu ja arviointi</div>
          <h2 className="display text-3xl sm:text-4xl mb-10">Toimituksen artikkeleita</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
            {ARTICLES.map((a, i) => (
              <article key={i} className="border-t border-subtle-border pt-6" data-testid={`article-${i}`}>
                <div className="eyebrow mb-2">Toimituksellinen</div>
                <h3 className="display text-2xl sm:text-3xl mb-3 hover:text-brand-blue cursor-pointer">
                  {a.title}
                </h3>
                <p className="font-serif text-[15px] text-muted-text leading-relaxed mb-4">{a.excerpt}</p>
                <span className="btn-ghost text-[13px]">Lue artikkeli <ArrowUpRight strokeWidth={1.6} size={14} className="ml-1" /></span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CasinoRanking;
