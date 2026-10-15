import { useState, useEffect } from 'react';
import {APP_CHROME_COLOR} from '../lib/appShell.js';

const STORAGE_KEY = 'opioid-sim-theme';

// Phase 5-I-1: class-strategy dark mode. localStorage value (when present) takes
// precedence over OS preference so the toggle is final. Side-effects: toggles the
// `dark` class on <html> and updates the meta theme-color for PWA browser chrome.
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    let stored;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* Theme falls back to OS. */ }
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light'); } catch { /* Cosmetic preference is optional. */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', APP_CHROME_COLOR);
  }, [isDark]);

  return [isDark, setIsDark];
}
