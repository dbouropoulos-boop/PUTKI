/**
 * SmarticoGame — embeds a Smartico Visitor-Mode mini-game.
 *
 * Loads the Smartico SDK once per page (idempotent against React strict
 * mode + remounts) and renders an iframe the SDK targets by id.
 *
 * Props
 * -----
 *   template_id  number   The Smartico game template (3383 = Weezy Rally).
 *   brand_key    string   The brand whose visitor flow we're running.
 *   visitor_key  string   The visitor-mode init key (UUID-7 form).
 *   lang         'FI'|'EN' Language passed to initVisitorMode.
 *   frame_id     string   DOM id of the iframe; must be unique per page.
 *   onWin        (prize)=>void   Callback fired by Smartico on a real win.
 *                                The `prize` object includes
 *                                `visitor_win_uuid` per Smartico's docs.
 *   maxWidth     number   Iframe max-width in px (default 800).
 *   height       number   Iframe pixel height (default 700).
 *
 * The component is purely presentational — it does NOT decide what to do
 * with the win. The parent (Peli, Voyager) owns that.
 */
import React, { useEffect, useRef } from 'react';

const SDK_URL = 'https://libs.smartico.ai/smartico.js';
const SDK_LOAD_KEY = '__putki_smartico_loaded';
const SDK_PROMISE_KEY = '__putki_smartico_loading';

const ensureSmarticoSdk = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if (window[SDK_LOAD_KEY]) return Promise.resolve();
  if (window[SDK_PROMISE_KEY]) return window[SDK_PROMISE_KEY];
  window[SDK_PROMISE_KEY] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => {
      window[SDK_LOAD_KEY] = true;
      resolve();
    };
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
  return window[SDK_PROMISE_KEY];
};

const SmarticoGame = ({
  template_id,
  brand_key,
  visitor_key,
  lang = 'EN',
  frame_id,
  onWin,
  maxWidth = 800,
  height = 700,
  testid = 'smartico-game',
}) => {
  const winRef = useRef(onWin);
  useEffect(() => { winRef.current = onWin; }, [onWin]);

  useEffect(() => {
    if (!template_id || !brand_key || !visitor_key || !frame_id) return undefined;
    let cancelled = false;
    ensureSmarticoSdk()
      .then(() => {
        if (cancelled || !window._smartico) return;
        try {
          window._smartico.initVisitorMode(visitor_key, {
            brand_key,
            lang: (lang || 'EN').toUpperCase(),
          });
          window._smartico.showVisitorGame({
            template_id,
            frame_id,
            onWin: (prize) => {
              try { winRef.current && winRef.current(prize); }
              catch { /* swallow — we never crash on operator's onWin */ }
            },
          });
        } catch {
          /* Smartico itself logs to console; nothing else to do here. */
        }
      })
      .catch(() => { /* SDK fetch failed — iframe stays blank, page survives */ });
    return () => { cancelled = true; };
  }, [template_id, brand_key, visitor_key, lang, frame_id]);

  return (
    <iframe
      id={frame_id}
      title={`Smartico game ${template_id}`}
      data-testid={testid}
      style={{
        width: '100%',
        maxWidth,
        height,
        margin: '0 auto',
        display: 'block',
        border: 'none',
        borderRadius: 12,
        background: '#0B0A09',
      }}
    />
  );
};

export default SmarticoGame;
