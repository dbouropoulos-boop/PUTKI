/**
 * PUTKI · canonical email-gate tracking hook
 *
 * Single source of truth for the four gate events:
 *   - email_gate_displayed (on mount, with markGateShown)
 *   - gate_field_interacted (email field focus, with time delta)
 *   - email_submitted (success path, primary goal)
 *   - email_gate_skipped (dismiss path, with time delta)
 *
 * Per spec §2h: all three lanes (mestari / mittari / pelisignaalit)
 * share this hook so the tracking can never drift between gates.
 * The gate's visual / form behaviour is untouched — this hook only
 * owns the dataLayer pushes.
 *
 * Usage from a gate component:
 *   const { onFieldFocus, onSubmit, onSkip } = useEmailGateTracking({
 *     content_type: 'mestari', funnel_state: 'mestari_result',
 *   });
 *   <input onFocus={onFieldFocus} ... />
 *   <form onSubmit={(e) => { ...your existing submit logic...; onSubmit(); }} />
 */
import { useEffect, useCallback, useRef } from 'react';
import { track, markGateShown, secondsSinceGate } from '../lib/track';

export default function useEmailGateTracking({ content_type, funnel_state, enabled = true }) {
  // Guard against double-fire if the gate is conditionally rendered
  // and re-mounts (e.g., a step machine flipping back and forth).
  const firedDisplayed = useRef(false);
  // Track field-focus only once per gate session to avoid event-spam
  // when the user tabs in/out of the email field repeatedly.
  const firedFieldFocus = useRef(false);

  useEffect(() => {
    if (!enabled || firedDisplayed.current) return;
    firedDisplayed.current = true;
    markGateShown();
    track('email_gate_displayed', { content_type, funnel_state });
  }, [enabled, content_type, funnel_state]);

  const onFieldFocus = useCallback(() => {
    if (firedFieldFocus.current) return;
    firedFieldFocus.current = true;
    track('gate_field_interacted', {
      content_type, funnel_state,
      time_since_gate_displayed_sec: secondsSinceGate(),
    });
  }, [content_type, funnel_state]);

  const onSubmit = useCallback(() => {
    track('email_submitted', { content_type, funnel_state });
  }, [content_type, funnel_state]);

  const onSkip = useCallback(() => {
    track('email_gate_skipped', {
      content_type, funnel_state,
      time_since_gate_displayed_sec: secondsSinceGate(),
    });
  }, [content_type, funnel_state]);

  return { onFieldFocus, onSubmit, onSkip };
}
