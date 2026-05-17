import React from 'react';
import { useLang } from '../context/LanguageContext';
import { EditorialArchivePage } from '../components/EditorialArchivePage';

// /pulssi — Finnish cultural real-time pulse. V2 §8.
// Three layers: (1) curated X republications, (2) Finland trend annotations,
// (3) editor pulls. Full feature ships in Phase 3C V2 when X API Basic tier is
// active. This page is the route shell that will absorb published items once
// any of the three Pulssi content types start being approved through the queue.

export const Pulssi = () => {
  const { lang } = useLang();
  return (
    <EditorialArchivePage
      testId="pulssi-page"
      surfaceKey="pulssi_layer_1"
      eyebrow={lang === 'en' ? 'PULSSI · FINNISH CULTURAL PULSE' : 'PULSSI · SUOMEN KULTTUURIPULSSI'}
      headline={lang === 'en' ? 'What Finland is talking about right now' : 'Mitä Suomi juuri nyt puhuu'}
      intro={
        lang === 'en'
          ? 'Pulssi captures the Finnish cultural moment in real time — curated X republications from athletes, rappers, streamers and commentators, annotated Finland-trends, and editor pulls. PUTKI HQ\u2019s daily return-visit ritual. Three layers, one feed.'
          : 'Pulssi vangitsee suomalaisen kulttuurihetken reaaliajassa — kuratoidut X-republikaatiot urheilijoilta, rappareilta, striimaajilta ja kommentaattoreilta, annotoidut Suomi-trendit ja toimituksen nostot. PUTKI HQ:n päivittäinen paluukäyntirituaali. Kolme kerrosta, yksi feed.'
      }
      comingSoonHeadline={lang === 'en' ? 'Layer 1 republications open as soon as the X API Basic tier is provisioned.' : 'Kerros 1 republikaatiot aukeavat heti kun X API Basic -tila on aktiivinen.'}
      comingSoonBody={
        lang === 'en'
          ? 'PUTKI HQ has assembled the initial 50–80 tracked X accounts (Bottas, Barkov, Rovanperä, Ibe, Mikael Gabriel, Pyhimys, Jarttu84, Roshtein, Trainwreckstv and the rest of the brief\u2019s roster). Layer 1 republishes only the culturally significant posts — never stream-promotional content. Layer 2 trend annotations and Layer 3 editor pulls follow once the feed has reach.'
          : 'PUTKI HQ on koonnut alkuperäisen 50–80 seurattavan X-tilin (Bottas, Barkov, Rovanperä, Ibe, Mikael Gabriel, Pyhimys, Jarttu84, Roshtein, Trainwreckstv ja muut briefin nimet). Kerros 1 republikoi vain kulttuurisesti merkittävät postaukset — ei koskaan striimin promootiota. Kerros 2 trendiannotaatiot ja Kerros 3 toimituksen nostot seuraavat kun feedillä on tavoittavuus.'
      }
    />
  );
};

export default Pulssi;
