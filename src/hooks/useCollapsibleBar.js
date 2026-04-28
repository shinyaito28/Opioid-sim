import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'opioid_sim_bar_pref';
const COLLAPSE_DELAY_MS = 5000;

// Manages an expandable bar's expanded ↔ collapsed lifecycle.
//   mode:  'expanded' | 'collapsed'
//   pref:  'auto' | 'always-open'   (persisted in localStorage)
//
// Auto-collapse fires COLLAPSE_DELAY_MS after the last interaction, but only
// when pref === 'auto' and canCollapse is true. bumpInteraction() resets the
// timer; expand() forces expanded immediately.
export const useCollapsibleBar = ({ canCollapse }) => {
  const [pref, setPrefState] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'always-open' ? 'always-open' : 'auto';
    } catch {
      return 'auto';
    }
  });
  const [mode, setMode] = useState('collapsed');
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleCollapse = useCallback(() => {
    clearTimer();
    if (pref !== 'auto' || !canCollapse) return;
    timerRef.current = setTimeout(() => {
      setMode('collapsed');
      timerRef.current = null;
    }, COLLAPSE_DELAY_MS);
  }, [pref, canCollapse]);

  const expand = useCallback(() => {
    clearTimer();
    setMode('expanded');
    scheduleCollapse();
  }, [scheduleCollapse]);

  const collapse = useCallback(() => {
    clearTimer();
    setMode('collapsed');
  }, []);

  const toggle = useCallback(() => {
    if (mode === 'expanded') {
      collapse();
    } else {
      expand();
    }
  }, [mode, expand, collapse]);

  const bumpInteraction = useCallback(() => {
    if (mode === 'expanded') scheduleCollapse();
  }, [mode, scheduleCollapse]);

  const setPref = useCallback((next) => {
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
    setPrefState(next);
    if (next === 'always-open') {
      clearTimer();
      setMode('expanded');
    } else if (next === 'auto') {
      scheduleCollapse();
    }
  }, [scheduleCollapse]);

  // If canCollapse becomes false (e.g. weight invalid), force expanded and cancel timer.
  useEffect(() => {
    if (!canCollapse) {
      clearTimer();
      setMode('expanded');
    }
  }, [canCollapse]);

  return { mode, pref, expand, collapse, toggle, bumpInteraction, setPref };
};
