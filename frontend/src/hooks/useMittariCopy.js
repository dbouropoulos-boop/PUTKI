/**
 * useMittariCopy - fetch the editable copy tree from the backend.
 *
 * Falls back gracefully: while loading or on network error, returns null
 * so the component can decide whether to render a skeleton. Once the
 * fetch resolves, every field is guaranteed present (backend deep-merges
 * admin overrides on top of DEFAULT_MITTARI_COPY).
 */
import { useEffect, useState } from 'react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function useMittariCopy() {
  const [copy, setCopy] = useState(null);
  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/mittari/copy`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!stop && d) setCopy(d); })
      .catch(() => { /* keep null - Mittari.jsx renders a skeleton */ });
    return () => { stop = true; };
  }, []);
  return copy;
}
