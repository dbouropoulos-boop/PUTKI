/**
 * useFormAutosave — debounced autosave hook + Cmd+S shortcut.
 *
 * Plug-and-play for any back-office editor that has:
 *   - form state (a plain object)
 *   - an async save function
 *   - a "dirty" notion (form differs from last saved snapshot)
 *
 * Behavior:
 *   - When `form` changes, wait `delay` ms (default 1500). If still
 *     dirty, fire `onSave(form)`.
 *   - Tracks status `idle | dirty | saving | saved | error` and the
 *     last error message for UI display.
 *   - Cmd/Ctrl+S inside the host page triggers an immediate save
 *     (debounce skipped, save fires now if dirty).
 *   - `pause` flag disables autosave entirely — useful when you want
 *     manual-only saves during a destructive sequence.
 *   - Returns a `forceSave()` callback the host can wire to a Save
 *     button so the explicit save and autosave share one code path.
 *
 * Why a hook, not a HOC: most back-office editors already manage
 * their own form state + dirty tracking. Wrapping with a HOC would
 * force a refactor; the hook layers on top.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DELAY = 1500;

export const useFormAutosave = ({
  form,
  dirty,
  onSave,
  delay = DEFAULT_DELAY,
  pause = false,
  // When true, Cmd/Ctrl+S only triggers if the focused element is
  // inside the editor's container (data-autosave-scope="true").
  scopeToContainer = false,
}) => {
  const [status, setStatus]   = useState('idle');   // idle | dirty | saving | saved | error
  const [error, setError]     = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);
  const latestFormRef = useRef(form);

  // Always remember the most recent form snapshot so a forceSave fires
  // with the current state even if React batched a setState moments
  // before the save call.
  useEffect(() => { latestFormRef.current = form; }, [form]);

  const performSave = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('saving'); setError('');
    try {
      await onSave(latestFormRef.current);
      setStatus('saved');
      setLastSavedAt(new Date().toISOString());
      // Fade to idle after 1.4s so the cockpit feels alive but not noisy.
      setTimeout(() => {
        setStatus((s) => (s === 'saved' ? 'idle' : s));
      }, 1400);
    } catch (e) {
      setStatus('error');
      setError(e?.message || 'save failed');
    } finally {
      inFlightRef.current = false;
    }
  }, [onSave]);

  // Debounced autosave on dirty form change.
  useEffect(() => {
    if (pause || !dirty) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }
    if (status !== 'saving') setStatus('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      performSave();
    }, delay);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // form is intentionally a dep so any field tweak resets the timer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, dirty, delay, pause]);

  // Cmd+S handler. We listen at window-level but optionally scope to
  // a container that sets data-autosave-scope="true".
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        if (scopeToContainer) {
          const active = document.activeElement;
          const insideEditor = active && active.closest && active.closest('[data-autosave-scope="true"]');
          if (!insideEditor) return;
        }
        e.preventDefault();
        if (dirty && !pause) performSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dirty, pause, scopeToContainer, performSave]);

  return {
    status, error, lastSavedAt,
    forceSave: performSave,
    saving: status === 'saving',
  };
};


// ─── AutosaveStatus pill (reusable, tiny) ────────────────────────────
//
// Drop next to a Save button — shows live autosave state. Uses Phase
// 1 tokens (var(--ember*), var(--dial-myrsky), JetBrains Mono).

export const AutosaveStatus = ({ status, error, lastSavedAt, testid = 'autosave-status' }) => {
  const palette = {
    idle:   { bg: 'transparent',          fg: 'var(--ink-3)',         label: 'AUTOSAVE READY' },
    dirty:  { bg: 'var(--surface)',       fg: 'var(--ink-2)',         label: 'TYPING…' },
    saving: { bg: 'var(--ember-soft)',    fg: 'var(--ember-strong)',  label: 'SAVING…' },
    saved:  { bg: 'var(--ember-soft)',    fg: 'var(--ember-strong)',  label: 'SAVED' },
    error:  { bg: '#FBEDEC',              fg: 'var(--dial-myrsky)',   label: 'SAVE FAILED' },
  }[status] || { bg: 'transparent', fg: 'var(--ink-3)', label: status };
  return (
    <span data-testid={testid} data-autosave-status={status} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', background: palette.bg,
      border: `1px solid ${status === 'error' ? 'var(--dial-myrsky)' : 'var(--line)'}`,
      borderRadius: 4,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 10, letterSpacing: '0.16em',
      color: palette.fg, fontWeight: 700, textTransform: 'uppercase',
      transition: 'background-color 200ms ease, color 200ms ease',
    }} title={error || (lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}` : '')}>
      {palette.label}
    </span>
  );
};


export default useFormAutosave;
