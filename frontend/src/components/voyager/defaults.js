/**
 * Voyager — Locked week-1 content.
 *
 * Source-of-truth defaults that are used until the back-office rotation
 * calendar (`settings.voyager_rotation` doc → /api/voyager/active)
 * overrides them. Spec §8 documents the contract between this fallback
 * and the calendar — keys here are the canonical shape consumed by the
 * Voyager page components.
 */
const WEEK_1 = {
  next_rotation_iso: '2026-05-27T09:00:00+03:00',
  game: {
    title_fi: 'Weezy Rally',
    title_en: 'Weezy Rally',
    template_id: 3383,
    brand_key: '7f2db034',
    visitor_key: '9250d6a7-1401-4205-a36b-14caba30b8d9-7',
  },
  operator: {
    name: 'Weezybet',
    redirect_url: 'https://weezybet.com/register?source=putki-voyager',
    partnership_label: true, // §1, §4.4 — show "yhteistyössä"
  },
  prize: {
    label_fi: 'ilmaiskierrosta',
    label_en: 'free spins',
    min: 5, max: 20,
    slot_fi: 'valitulla slotilla', slot_en: 'on a featured slot',
  },
  verdict: {
    fi: 'Suomenkielinen rekisteröitymätön Pay N Play -kasino, jonka kotiutukset ovat oikeasti nopeita ja julkaistuja — testattu toimituksessa.',
    en: 'A Finnish-language Pay N Play casino whose payouts are genuinely fast and publicly tracked — vetted by our editor.',
  },
  tried: {
    fi: 'Kokeilimme itse: talletus 50 €, kotiutus saapui 12 minuutissa.',
    en: 'We tried it ourselves: €50 deposit, payout in 12 minutes.',
  },
  review_points: [
    {
      headline_fi: 'Pay N Play (Trustly-virta)',
      headline_en: 'Pay N Play (Trustly flow)',
      body_fi: 'Ei rekisteröitymistä. Pankkitunnukset, talletus, peli — sama istunto.',
      body_en: 'No registration. Bank ID, deposit, play — single session.',
    },
    {
      headline_fi: 'Kotiutukset alle 15 min',
      headline_en: 'Payouts under 15 min',
      body_fi: 'Toimitusseuranta: 38/40 viime kotiutusta alle 15 minuutissa. Lista julkaistu.',
      body_en: 'Editorial tracking: 38 of the last 40 payouts settled in <15 min. List is published.',
    },
    {
      headline_fi: 'Suomenkielinen tuki',
      headline_en: 'Finnish-speaking support',
      body_fi: 'Chat-tuki suomeksi 09–24, mediaanivasteaika alle 2 min toimituksen testeissä.',
      body_en: 'Live chat in Finnish 09:00–24:00, median response under 2 min in our tests.',
    },
    {
      headline_fi: 'Pelivalinta',
      headline_en: 'Game selection',
      body_fi: 'Yli 3 000 nimikettä, mukana NetEnt, Pragmatic, Hacksaw — ei pakkokierrätyspaketteja.',
      body_en: '3,000+ titles incl. NetEnt, Pragmatic, Hacksaw — no forced wagering bundles.',
    },
  ],
};

export default WEEK_1;
