/**
 * PUTKI HQ — 3,000-subscriber gating hook + operational-fact fallback.
 *
 * Below 3,000 subscribers we do NOT surface "{N} subscribers" social
 * proof. Instead the consumer falls back to a defensible operational
 * fact (€ paid in raffle prizes, stories aggregated today, etc.).
 *
 * Refreshes every 5 minutes — these counts move slowly.
 */
import { useEffect, useState } from 'react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const REFRESH_MS = 5 * 60 * 1000;
const SUBSCRIBER_THRESHOLD = 3000;

let _cachedCounts = null;
let _cachedFacts = null;
let _lastFetch = 0;
const _subscribers = new Set();

const refresh = async () => {
  if (Date.now() - _lastFetch < 30 * 1000) return;
  _lastFetch = Date.now();
  try {
    const [cR, fR] = await Promise.all([
      fetch(`${BACKEND}/api/public/subscriber-counts`).then((r) => r.ok ? r.json() : null),
      fetch(`${BACKEND}/api/public/ops-facts`).then((r) => r.ok ? r.json() : null),
    ]);
    _cachedCounts = cR?.counts || {};
    _cachedFacts = fR?.facts || {};
  } catch {
    // Leave previous cache in place; consumers degrade gracefully.
  }
  _subscribers.forEach((cb) => cb());
};

let _interval = null;

export const useOpsFacts = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    _subscribers.add(cb);
    if (!_interval) {
      _interval = setInterval(refresh, REFRESH_MS);
    }
    refresh();
    return () => {
      _subscribers.delete(cb);
    };
  }, []);
  return {
    counts: _cachedCounts || {},
    facts: _cachedFacts || {},
    tick,
  };
};

/**
 * Returns the subscriber count for a consent_tag, OR null if the
 * count is below the 3,000 social-proof threshold. Use the null case
 * to fall back to an operational fact.
 *
 * @param tag - consent_tag (e.g. "email_sentiment", "mittari_alerts_sms")
 * @returns count >= 3000, or null
 */
export const useSubscriberCountGated = (tag) => {
  const { counts } = useOpsFacts();
  const n = counts[tag];
  if (typeof n !== 'number' || n < SUBSCRIBER_THRESHOLD) return null;
  return n;
};

export const SUBSCRIBER_GATE = SUBSCRIBER_THRESHOLD;
