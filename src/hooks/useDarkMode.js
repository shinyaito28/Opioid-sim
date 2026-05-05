import { useState, useEffect } from 'react';

const STORAGE_KEY = 'opioid-sim-theme';

// Phase 5-I-1: class-strategy dark mode. localStorage value (when present) takes
// precedence over OS preference so the toggle is final. Side-effects: toggles the
// `dark` class on <html> and updates the meta theme-color for PWA browser chrome.
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0f172a' : '#1e293b');
  }, [isDark]);

  return [isDark, setIsDark];
}
