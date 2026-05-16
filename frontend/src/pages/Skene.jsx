import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { EditorialArchivePage } from '../components/EditorialArchivePage';

// /skene + /skene/talous — Scene news + industry business analysis. V2 §9.2 + §9.3.

export const Skene = () => {
  const { lang } = useLang();
  return (
    <div>
      <div className="container-wide pt-4 mb-2">
        <Link to="/skene/talous" className="mono" data-testid="skene-link-talous" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--brand-blue, #5A7BB8)', fontWeight: 700 }}>
          {lang === 'en' ? 'INDUSTRY · BUSINESS ANALYSIS →' : 'TOIMIALA · LIIKETOIMINTA-ANALYYSI →'}
        </Link>
      </div>
      <EditorialArchivePage
        testId="skene-page"
        surfaceKey="skene"
        eyebrow={lang === 'en' ? 'SCENE · NEWS' : 'SKENE · UUTISET'}
        headline={lang === 'en' ? 'What just happened in the scene' : 'Mitä skenessä juuri tapahtui'}
        intro={
          lang === 'en'
            ? 'Mittari covers lifestyle moments, drama, and business shifts in the slot streaming and gambling scene. Cultural reporting on the moments the audience already engages with — without aspirational framing.'
            : 'Mittari kattaa slot-striimauksen ja uhkapeliskenen lifestyle-hetkiä, draamaa ja liiketoimintamuutoksia. Kulttuuriraportointia niistä hetkistä joita yleisö jo seuraa — ilman aspiraationaalista kehystä.'
        }
        comingSoonHeadline={lang === 'en' ? 'Stake VIP system, Trainwreck Lamborghini buy, Adin Ross–Rainbet switch.' : 'Stake VIP-järjestelmä, Trainwreckin Lamborghini, Adin Ross–Rainbet-siirto.'}
        comingSoonBody={
          lang === 'en'
            ? 'Mittari opens the scene news pipeline with 5–10 pieces per week. Each 400–900 words. Cultural and business reporting on the moments that define the scene right now — drama, deals, beef, and the economics behind them.'
            : 'Mittarin toimitus aukaisee skene-uutisputken 5–10 jutulla viikossa. Jokainen 400–900 sanaa. Kulttuuri- ja liiketoimintaraportointia skenen tämänhetkisistä määrittävistä hetkistä — draama, sopimukset, beef ja näiden takana oleva talous.'
        }
      />
    </div>
  );
};

export const SkeneTalous = () => {
  const { lang } = useLang();
  return (
    <EditorialArchivePage
      testId="skene-talous-page"
      surfaceKey="skene_talous"
      eyebrow={lang === 'en' ? 'INDUSTRY · BUSINESS' : 'TOIMIALA · LIIKETOIMINTA'}
      headline={lang === 'en' ? 'The economics behind the curtain' : 'Bisnes verhon takana'}
      intro={
        lang === 'en'
          ? 'Bloomberg-style business analysis applied to the gambling industry. Operator finances, streamer economics, affiliate revenue, VIP lifetime values — demystifying the business for the audience that participates in it.'
          : 'Bloomberg-tyylinen liiketoiminta-analyysi sovellettuna uhkapelialaan. Operaattoritalous, striimaajien tulorakenteet, affiliate-tulot, VIP-pelaajan elinkaariarvo — toimiala läpinäkyvämmäksi yleisölle joka siinä toimii.'
      }
      comingSoonHeadline={lang === 'en' ? 'Stake $360M, GGR mechanics, affiliate revenues 2026, VIP lifetime values.' : 'Stake $360M, GGR-mekaniikka, affiliate-tulot 2026, VIP-elinkaariarvot.'}
      comingSoonBody={
        lang === 'en'
          ? 'Mittari is preparing 1–2 analytical pieces per week on the real numbers behind the gambling industry — what the operators, streamers, and affiliates actually make, where the money flows, and what that means for the post-2027 Finnish licensed market.'
          : 'Mittarin toimitus valmistelee 1–2 analyysijuttua viikossa uhkapelialan oikeista luvuista — paljonko operaattorit, striimaajat ja affiliatet tienaavat, mistä raha virtaa ja mitä tämä tarkoittaa Suomen 2027 jälkeisille lisensoiduille markkinoille.'
      }
    />
  );
};

export default Skene;
