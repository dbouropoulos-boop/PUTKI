// Mittari V2 — registry hooks. Replace mock.js OPERATORS/STREAMERS imports.
// Each hook returns { data, loading, error } so consumers can render empty
// or loading states honestly.

import { useEffect, useState } from 'react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export const useOperators = ({ partnerOnly = false } = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const qs = partnerOnly ? '?partner_only=true' : '';
    fetch(`${BACKEND}/api/operators${qs}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => { if (!cancelled) { setData(d.operators || []); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e); setLoading(false); } });
    return () => { cancelled = true; };
  }, [partnerOnly]);
  return { data, loading, error };
};

export const useOperator = (slug) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`${BACKEND}/api/operators/${slug}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e); setLoading(false); } });
    return () => { cancelled = true; };
  }, [slug]);
  return { data, loading, error };
};

export const useStreamers = ({ market = 'fi', scene = null } = {}) => {
  const [data, setData] = useState([]);
  const [intlScenes, setIntlScenes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams();
    if (market) qs.set('market', market);
    if (scene) qs.set('scene', scene);
    fetch(`${BACKEND}/api/streamers?${qs.toString()}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => { if (!cancelled) { setData(d.streamers || []); setIntlScenes(d.intl_scenes || {}); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e); setLoading(false); } });
    return () => { cancelled = true; };
  }, [market, scene]);
  return { data, intlScenes, loading, error };
};

export const useStreamer = (slug) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`${BACKEND}/api/streamers/${slug}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e); setLoading(false); } });
    return () => { cancelled = true; };
  }, [slug]);
  return { data, loading, error };
};
