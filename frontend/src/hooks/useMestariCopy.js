/**
 * useMestariCopy — fetch the editable Mestari landing-page copy tree.
 *
 * Returns null while loading or on network error so the page can fall
 * back to its hardcoded COPY defaults. Once the fetch resolves, every
 * field is guaranteed present (backend deep-merges admin overrides on
 * top of DEFAULT_MESTARI_COPY).
 */
import { useEffect, useState } from 'react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function useMestariCopy() {
  const [copy, setCopy] = useState(null);
  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/mestari/copy`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!stop && d) setCopy(d); })
      .catch(() => { /* keep null — Mestari.jsx falls back to its hardcoded COPY */ });
    return () => { stop = true; };
  }, []);
  return copy;
}
