'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';


export type Theme = 'dark' | 'light';

export const THEME_COOKIE = 'rb-theme';
const STORAGE_KEY = 'rb-theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;


interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}


const ThemeContext = createContext<ThemeContextValue | null>(null);


function writeCookie(value: Theme): void {

  if (typeof document === 'undefined') return;

  document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}


export function ThemeProvider({
  children,
  initialTheme = 'dark',
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {

  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {

    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as Theme | null;

    if ((stored === 'light' || stored === 'dark') && stored !== initialTheme) {

      setThemeState(stored);
      document.documentElement.classList.toggle('light', stored === 'light');
      writeCookie(stored);
    }
  }, [initialTheme]);

  const setTheme = useCallback((next: Theme) => {

    setThemeState(next);
    document.documentElement.classList.toggle('light', next === 'light');
    localStorage.setItem(STORAGE_KEY, next);
    writeCookie(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}


export function useTheme(): ThemeContextValue {

  const ctx = useContext(ThemeContext);

  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');

  return ctx;
}


export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='light'){document.documentElement.classList.add('light');}else if(t==='dark'){document.documentElement.classList.remove('light');}}catch(e){}})();`;
