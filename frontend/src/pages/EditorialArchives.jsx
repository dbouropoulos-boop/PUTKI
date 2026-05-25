import React from 'react';
import { useLang } from '../context/LanguageContext';
import { EditorialArchivePage } from '../components/EditorialArchivePage';

// /raha + /kulttuuri + /sponsoroinnit + /saantely - V2 §9.4, §9.6, §11.

export const Raha = () => {
  const { lang } = useLang();
  return (
    <EditorialArchivePage
      testId="raha-page"
      surfaceKey="raha"
      eyebrow={lang === 'en' ? 'MONEY · COMMENTARY' : 'RAHA · KOMMENTTI'}
      headline={lang === 'en' ? 'Career, wealth, and Finnish money culture' : 'Ura, varallisuus ja suomalainen rahankäyttö'}
      intro={
        lang === 'en'
          ? 'Confident, money-aware commentary for the 25-35 Finnish reader building something. Real Finnish salary data, crypto skepticism, practical wealth-building - gambling is not the path, and PUTKI HQ is honest about that.'
          : 'Itsevarmaa, rahatietoista kommenttia 25-35-vuotiaalle suomalaiselle joka rakentaa jotain. Oikeita suomalaisia palkkalukuja, kryptoskeptikkoa, käytännönläheistä varallisuuden rakentamista - uhkapelaaminen ei ole se polku, ja PUTKI HQ sanoo sen suoraan.'
      }
      comingSoonHeadline={lang === 'en' ? 'Finnish men’s real 2026 income brackets, side hustles that work, first investment property, crypto vs S&P 500.' : 'Suomalaisen miehen 2026 todelliset tuloluokat, oikeasti tienaavat sivutyöt, ensimmäinen sijoitusasunto, krypto vs S&P 500.'}
      comingSoonBody={
        lang === 'en'
          ? 'PUTKI HQ prepares 4-8 money-commentary pieces per month. Each 600-1 200 words. Practical, opinionated, Finnish-context-specific. Never frames gambling as wealth-building. Never sells certainty about uncertain investments.'
          : 'PUTKI HQ -toimitus valmistelee 4-8 rahakommenttia kuukaudessa. Jokainen 600-1 200 sanaa. Käytännönläheistä, mielipiteistä, suomalaiseen kontekstiin sidottua. Ei kehystä uhkapeliä varallisuuden rakentamisena. Ei myy varmuutta epävarmoista sijoituksista.'
      }
    />
  );
};

export const Kulttuuri = () => {
  const { lang } = useLang();
  return (
    <EditorialArchivePage
      testId="kulttuuri-page"
      surfaceKey="kulttuuri"
      eyebrow={lang === 'en' ? 'CULTURE · FEATURES' : 'KULTTUURI · PIIRTEET'}
      headline={lang === 'en' ? 'Finnish hip-hop, hockey, rally and drinking culture' : 'Suomalainen hip-hop, kiekko, ralli ja juomakulttuuri'}
      intro={
        lang === 'en'
          ? 'Long-form cultural reporting on the territory the PUTKI HQ audience actually lives in - Finnish hip-hop economics, hockey fandom rituals, rally heritage, drinking culture as identity. Reporting frame, never participation frame.'
          : 'Pitkän muodon kulttuuriraportointia siitä territoriosta jossa PUTKI HQ:n yleisö oikeasti elää - suomalaisen hip-hopin talous, jääkiekkofanikulttuuri, rallihistoria, juomakulttuuri identiteettinä. Raportointikehys - ei osallistumiskehys.'
      }
      comingSoonHeadline={lang === 'en' ? 'Cheek-era money flow, Tappara as Tampere identity, Rovanperä continuum, RTD-kulttuuri.' : 'Cheek-aikakauden rahavirta, Tappara Tampereen identiteettinä, Rovanperä-jatkumo, RTD-kulttuuri.'}
      comingSoonBody={
        lang === 'en'
          ? '1-2 long-form cultural features per month, 1 500-2 500 words each. Complex / GQ-level cultural reporting written natively in Finnish.'
          : '1-2 pitkän muodon kulttuuripiirrettä kuukaudessa, 1 500-2 500 sanaa kukin. Complex / GQ -tasoista kulttuuriraportointia suomeksi syntyperäisesti.'
      }
    />
  );
};

export const Sponsoroinnit = () => {
  const { lang } = useLang();
  return (
    <EditorialArchivePage
      testId="sponsoroinnit-page"
      surfaceKey="sponsoroinnit"
      eyebrow={lang === 'en' ? 'SPONSORSHIP · TRACKER' : 'SPONSOROINTI · SEURANTA'}
      headline={lang === 'en' ? 'Operator sponsorship landscape' : 'Operaattorien sponsorointimaisema'}
      intro={
        lang === 'en'
          ? 'PUTKI HQ tracks operator sponsorship deals across Finnish sports clubs, athletes (over 18), and esports. The 2025/2027 Finnish Gambling Act allows sports sponsorship with restrictions - PUTKI HQ reports who pays whom, for how much, and on what terms.'
          : 'PUTKI HQ seuraa operaattorien sponsorointisopimuksia suomalaisten urheiluseurojen, yli 18-vuotiaiden urheilijoiden ja esportsin kanssa. Suomen rahapelilaki 2025/2027 sallii urheilun sponsoroinnin rajoituksin - PUTKI HQ raportoi kuka maksaa kenelle, kuinka paljon ja millä ehdoilla.'
      }
      comingSoonHeadline={lang === 'en' ? 'Veikkausliiga deals, Liiga sleeve patches, ENCE / HAVU partner roster.' : 'Veikkausliigan diilit, Liigan paitamerkit, ENCE / HAVU -kumppanit.'}
      comingSoonBody={
        lang === 'en'
          ? 'The sponsorship tracker opens with documented deals from public reporting and operator filings - values, terms, and PUTKI HQ analysis of strategic positioning.'
          : 'Sponsorointiseuranta aukeaa julkisesta raportoinnista ja operaattorien tiedotteista poimituilla dokumentoiduilla sopimuksilla - summilla, ehdoilla ja PUTKI HQ:n strategisen sijoittumisen analyysillä.'
      }
    />
  );
};

export const Saantely = () => {
  const { lang } = useLang();
  return (
    <EditorialArchivePage
      testId="saantely-page"
      surfaceKey="saantely"
      eyebrow={lang === 'en' ? 'REGULATION · LANDSCAPE' : 'SÄÄNTELY · MAISEMA'}
      headline={lang === 'en' ? 'Finnish Gambling Act 2025/2027' : 'Suomen rahapelilaki 2025/2027'}
      intro={
        lang === 'en'
          ? 'PUTKI HQ covers the Finnish gambling reform passed December 2025, effective July 2027. What the law bans, what it allows, what it means for operators and players, and where PUTKI HQ sits in the new regulatory landscape as a comparison site / publication.'
          : 'PUTKI HQ kattaa suomalaisen rahapeliuudistuksen joka hyväksyttiin joulukuussa 2025 ja astuu voimaan heinäkuussa 2027. Mitä laki kieltää, mitä se sallii, mitä se tarkoittaa operaattoreille ja pelaajille, ja missä PUTKI HQ sijoittuu uudessa sääntelymaisemassa vertailusivustona / julkaisuna.'
      }
      comingSoonHeadline={lang === 'en' ? 'Bans, allowances, license authority, comparison-site classification.' : 'Kiellot, sallitut muodot, lisenssiviranomainen, vertailusivustoluokitus.'}
      comingSoonBody={
        lang === 'en'
          ? 'PUTKI HQ is preparing the regulatory briefing series - the law in plain Finnish, operator implications, player implications, and ongoing tracking of regulator decisions through 2026 and into 2027.'
          : 'PUTKI HQ -toimitus valmistelee sääntely-briefing-sarjaa - laki selkokielellä, operaattorien vaikutukset, pelaajien vaikutukset, ja sääntelyviranomaisen päätösten jatkuva seuranta läpi vuoden 2026 ja vuoteen 2027.'
      }
    />
  );
};

export default Raha;
