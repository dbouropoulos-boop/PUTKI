/**
 * iter97k · track.js unit tests
 *
 * Verifies the three guarantees the funnel decision tree depends on:
 *   1. Attribution is captured once per session and persists.
 *   2. Every track() call merges sticky attribution into the payload.
 *   3. The mestari_start dedup keeps a single fire per session even
 *      across the hub-card-click + diagnostic-mount + intro-Start paths.
 *
 * Run with: cd /app/frontend && yarn test --watchAll=false
 */
import {
  captureAttribution,
  track,
  markGateShown,
  secondsSinceGate,
  fireMestariStart,
  fireMestariCompletion,
  secondsSinceMestariStart,
  clearMestariStart,
  slugifyProfile,
} from '../track';

beforeEach(() => {
  // Hermetic: clear sessionStorage and dataLayer between tests.
  sessionStorage.clear();
  window.dataLayer = [];
});

describe('captureAttribution', () => {
  test('captures UTM + partner from URL on first call', () => {
    // jsdom URL is overridable via history.replaceState
    window.history.replaceState({}, '', '/?utm_source=acme&utm_medium=email&utm_campaign=launch&partner_id=acme');
    captureAttribution();
    const stored = JSON.parse(sessionStorage.getItem('putki_attr'));
    expect(stored).toEqual({
      utm_source: 'acme', utm_medium: 'email', utm_campaign: 'launch', partner_id: 'acme',
    });
  });

  test('falls back to (direct)/(none) when URL has no params', () => {
    window.history.replaceState({}, '', '/');
    captureAttribution();
    const stored = JSON.parse(sessionStorage.getItem('putki_attr'));
    expect(stored.utm_source).toBe('(direct)');
    expect(stored.partner_id).toBe('(none)');
  });

  test('partner_id falls back to utm_source when partner_id missing', () => {
    window.history.replaceState({}, '', '/?utm_source=qa');
    captureAttribution();
    const stored = JSON.parse(sessionStorage.getItem('putki_attr'));
    expect(stored.partner_id).toBe('qa');
  });

  test('does not overwrite attribution on second call (session-sticky)', () => {
    window.history.replaceState({}, '', '/?utm_source=first');
    captureAttribution();
    window.history.replaceState({}, '', '/?utm_source=second');
    captureAttribution();
    const stored = JSON.parse(sessionStorage.getItem('putki_attr'));
    expect(stored.utm_source).toBe('first');
  });
});

describe('track()', () => {
  test('pushes event + merges sticky attribution', () => {
    window.history.replaceState({}, '', '/?utm_source=acme&partner_id=acme');
    captureAttribution();
    track('landing_view', { content_type: 'mestari' });
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toMatchObject({
      event: 'landing_view',
      content_type: 'mestari',
      utm_source: 'acme',
      partner_id: 'acme',
    });
  });

  test('event params override attribution if they conflict', () => {
    window.history.replaceState({}, '', '/?utm_source=acme');
    captureAttribution();
    // Edge case: caller passes utm_source explicitly — they win.
    track('test', { utm_source: 'override' });
    expect(window.dataLayer[0].utm_source).toBe('override');
  });

  test('works with no attribution captured (tracker called too early)', () => {
    track('test', { content_type: 'mestari' });
    expect(window.dataLayer[0]).toMatchObject({
      event: 'test', content_type: 'mestari',
    });
  });
});

describe('gate timer', () => {
  test('secondsSinceGate returns 0 before markGateShown', () => {
    expect(secondsSinceGate()).toBe(0);
  });

  test('secondsSinceGate returns rounded delta after markGateShown', () => {
    jest.useFakeTimers();
    markGateShown();
    jest.advanceTimersByTime(4321);
    expect(secondsSinceGate()).toBe(4);   // 4321ms → rounded to 4s
    jest.useRealTimers();
  });
});

describe('mestari start timer', () => {
  test('fireMestariStart pushes event + sets timer (first call)', () => {
    fireMestariStart('mestari');
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toMatchObject({
      event: 'mestari_start', content_type: 'mestari',
    });
    expect(sessionStorage.getItem('putki_mestari_start_ts')).toBeTruthy();
  });

  test('fireMestariStart is idempotent — second call is a no-op', () => {
    fireMestariStart('mestari');
    fireMestariStart('mestari');
    fireMestariStart('mestari');
    // Only ONE mestari_start in the dataLayer even though we triple-called.
    const starts = window.dataLayer.filter(e => e.event === 'mestari_start');
    expect(starts).toHaveLength(1);
  });

  test('fireMestariCompletion pushes elapsed seconds and clears timer', () => {
    jest.useFakeTimers();
    fireMestariStart('mestari');
    jest.advanceTimersByTime(31000);
    fireMestariCompletion('mestari');
    const completion = window.dataLayer.find(e => e.event === 'mestari_completion');
    expect(completion).toMatchObject({
      event: 'mestari_completion',
      content_type: 'mestari',
      completion_time_seconds: 31,
    });
    // Timer cleared → second start works fresh
    expect(sessionStorage.getItem('putki_mestari_start_ts')).toBeNull();
    jest.useRealTimers();
  });

  test('secondsSinceMestariStart returns 0 if never started', () => {
    expect(secondsSinceMestariStart()).toBe(0);
  });

  test('clearMestariStart removes the timer key', () => {
    fireMestariStart('mestari');
    clearMestariStart();
    expect(secondsSinceMestariStart()).toBe(0);
  });
});

describe('slugifyProfile', () => {
  test('lowercases + snake_cases canonical profile names', () => {
    expect(slugifyProfile('HILJAINEN TARKKA')).toBe('hiljainen_tarkka');
    expect(slugifyProfile('ITSEVARMA LOJAALI')).toBe('itsevarma_lojaali');
    expect(slugifyProfile('THE_DISCIPLINED')).toBe('the_disciplined');
  });

  test('strips Finnish diacritics so VÄISTÖPELAAJA does not split into two profiles', () => {
    expect(slugifyProfile('VÄISTÖPELAAJA')).toBe('vaistopelaaja');
  });

  test('handles empty / null inputs without crashing', () => {
    expect(slugifyProfile('')).toBe('');
    expect(slugifyProfile(null)).toBe('');
    expect(slugifyProfile(undefined)).toBe('');
  });

  test('collapses repeated non-alphanumeric runs into single underscore', () => {
    expect(slugifyProfile('  Foo--BAR  ')).toBe('foo_bar');
  });
});
