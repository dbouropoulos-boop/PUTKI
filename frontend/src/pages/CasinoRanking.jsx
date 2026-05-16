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
import { useLang } from '../context/LanguageContext';

const ARTICLES_FI = [
  { title: 'Miten Suomen rahapelilainsäädäntö muuttuu heinäkuussa 2027', excerpt: 'Mittarin selitys uudesta lisenssijärjestelmästä ja siitä, mitä se merkitsee pelaajalle.' },
  { title: 'Pay N Play pelaajan näkökulmasta — toimiiko se aina?', excerpt: 'Vertaamme kolmen suurimman PNP-operaattorin toimintaa kuukauden seurannan jälkeen.' },
  { title: 'Mittari-pisteet selitettynä: mikä laskee, mikä nostaa?', excerpt: 'Avoin metodologia. Ei mainos. Ei myyntiä — kerromme miten oikeasti pisteytämme.' },
  { title: 'Suomalaiset slot-striimaajat — keiden seuraamisesta voi oppia?', excerpt: 'Toimituksellinen katsaus 18 seuratuimpaan suomalaiseen pelistriimaajaan.' },
];
const ARTICLES_EN = [
  { title: 'How Finland\u2019s gambling regulation changes in July 2027', excerpt: 'Mittari\u2019s breakdown of the new license regime and what it means for players.' },
  { title: 'Pay N Play from a player\u2019s perspective — does it always work?', excerpt: 'We compared the three biggest PNP operators across a month of tracking.' },
  { title: 'P*rkele Score explained: what lowers it, what raises it', excerpt: 'Open methodology. Not advertising. Not sales — how we actually score.' },
  { title: 'Finnish slot streamers — who can you actually learn from?', excerpt: 'An editorial look at the 18 most-followed Finnish streamers.' },
];

const CasinoRanking = () => {
  const [filter, setFilter] = useState('kaikki');
  const [sort, setSort] = useState('mittari');
  const { lang, t } = useLang();

  const FILTERS = [
    { key: 'kaikki',     label: t('casino.filter_all') },
    { key: 'slotit',     label: t('casino.filter_slots') },
    { key: 'live',       label: t('casino.filter_live') },
    { key: 'paynplay',   label: t('casino.filter_paynplay') },
    { key: 'mga',        label: t('casino.filter_mga') },
    { key: 'pikamaksu',  label: t('casino.filter_fast') },
    { key: 'suomeksi',   label: t('casino.filter_finnish') },
  ];

  const SORTS = [
    { key: 'mittari', label: t('casino.sort_mittari') },
    { key: 'payout',  label: t('casino.sort_payout') },
    { key: 'trust',   label: t('casino.sort_trust') },
    { key: 'newest',  label: t('casino.sort_newest') },
  ];

  const sorted = useMemo(() => {
    const arr = [...OPERATORS];
    if (sort === 'mittari') arr.sort((a, b) => b.score - a.score);
    else if (sort === 'trust') arr.sort((a, b) => b.trustpilot - a.trustpilot);
    else if (sort === 'newest') arr.sort((a, b) => b.year - a.year);
    return arr;
  }, [sort]);

  const articles = lang === 'en' ? ARTICLES_EN : ARTICLES_FI;
  const dateStr = new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'fi-FI');

  return (
    <div data-testid="casino-ranking-page">
      <section className="container-wide pt-12 sm:pt-20 pb-8 sm:pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4">{t('casino.eyebrow', { date: dateStr })}</div>
          <h1 className="display text-4xl sm:text-6xl mb-5">{t('casino.title')}</h1>
          <p className="prose-mittari max-w-2xl" style={{ color: 'var(--muted)' }}>{t('casino.lede')}</p>
        </div>
      </section>

      <section className="container-wide pb-6">
        <Link to="/menetelma" className="editorial-card flex items-start gap-3 p-4 max-w-3xl hover:border-ink panel" data-testid="methodology-banner">
          <Info strokeWidth={1.5} size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--brand-blue)' }} />
          <div className="flex-1">
            <span className="font-display text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{t('casino.banner')}</span>
            <span className="font-serif text-[14px] ml-1" style={{ color: 'var(--muted)' }}>{t('casino.banner_sub')}</span>
            <span className="mono ml-2" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--brand-blue)', fontWeight: 600, textTransform: 'uppercase' }}>{t('common.read_methodology')}</span>
          </div>
        </Link>
      </section>

      <section className="border-y py-4 sm:py-5 sticky top-16 z-30" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="container-wide flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 sm:mx-0 sm:px-0" data-testid="filter-chips">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                data-testid={`filter-${f.key}`}
                className="whitespace-nowrap mono font-semibold px-4 py-2 rounded-full border transition-colors duration-200"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: filter === f.key ? 'var(--ink)' : 'var(--bg)',
                  color: filter === f.key ? 'var(--bg)' : 'var(--ink)',
                  borderColor: filter === f.key ? 'var(--ink)' : 'var(--border-strong)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="eyebrow">{t('casino.sort_label').toUpperCase()}</span>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[200px] rounded-[4px] font-display text-[13px]" data-testid="sort-select" style={{ borderColor: 'var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)' }}>
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

      <section className="container-wide py-6 sm:py-10">
        <div>
          {sorted.map((op, i) => (
            <OperatorRow key={op.slug} operator={op} rank={i + 1} />
          ))}
        </div>
      </section>

      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-3">{t('casino.articles_eyebrow').toUpperCase()}</div>
          <h2 className="display text-3xl sm:text-4xl mb-10">{t('casino.articles_title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
            {articles.map((a, i) => (
              <article key={i} className="pt-6" style={{ borderTop: '1px solid var(--border)' }} data-testid={`article-${i}`}>
                <div className="eyebrow mb-2">{t('common.editorial').toUpperCase()}</div>
                <h3 className="display text-2xl sm:text-3xl mb-3 cursor-pointer" style={{ color: 'var(--ink)' }}>{a.title}</h3>
                <p className="font-serif text-[15px] leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>{a.excerpt}</p>
                <span className="btn-ghost"><ArrowUpRight strokeWidth={1.6} size={14} className="ml-1" /></span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CasinoRanking;
