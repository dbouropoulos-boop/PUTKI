import React from 'react';
import { useLang } from '../context/LanguageContext';
import { EditorialArchivePage } from '../components/EditorialArchivePage';

// /profiilit — Long-form profile features on noteworthy gamblers, athletes, rappers,
// industry figures. V2 Master Brief §9.1. Reference frame: GQ / Complex / Bloomberg.
// Cadence target: 1-2 per month (12-24 features per year).

export const Profiilit = () => {
  const { lang } = useLang();
  return (
    <EditorialArchivePage
      testId="profiilit-page"
      surfaceKey="profiilit"
      eyebrow={lang === 'en' ? 'PROFILES · LONG-FORM' : 'PROFIILIT · PITKÄT JUTUT'}
      headline={lang === 'en' ? 'The people behind the numbers' : 'Ihmiset numeroiden takana'}
      intro={
        lang === 'en'
          ? 'Mittari profiles the cultural figures the audience actually engages with — lifestyle gamblers, athletes, rappers, and industry operators. Editorial reporting, not endorsement. Read about how they really make money, not how they want you to think they do.'
          : 'Mittari profiloi ne kulttuuriset hahmot joita yleisö oikeasti seuraa — lifestyle-pelaajat, urheilijat, rapparit, alan operaattorit. Toimituksellinen raportointi, ei suosittelua. Lue miten he oikeasti tienaavat — älä sitä mitä haluavat sinun ajattelevan.'
      }
      comingSoonHeadline={lang === 'en' ? 'Roshtein, Trainwreckstv, Bottas, Ibe — first dossiers landing in the coming weeks.' : 'Roshtein, Trainwreckstv, Bottas, Ibe — ensimmäiset dossiet lähiviikkoina.'}
      comingSoonBody={
        lang === 'en'
          ? 'Mittari is researching 12 lifestyle profiles for the first publication wave. Each piece runs 2 000–3 000 words. Magazine-feature standard. No affiliate framing, no aspirational replication, no gambling-as-wealth-building. Cultural reporting on people who matter.'
          : 'Mittarin toimitus tutkii 12 lifestyle-profiilia ensimmäiseen julkaisuaaltoon. Jokainen 2 000–3 000 sanaa. Lehtitasoinen aikakauslehtiprofiili. Ei affiliate-kehystä, ei "näin sinäkin elät tämän elämän"-pohjaa, ei uhkapeliä varallisuuden rakentamisena. Kulttuuri­raportointia ihmisistä joilla on merkitystä.'
      }
    />
  );
};

export default Profiilit;
