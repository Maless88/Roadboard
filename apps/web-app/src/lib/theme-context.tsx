'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';


export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'rb-theme';


interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}


const ThemeContext = createContext<ThemeContextValue | null>(null);


export function ThemeProvider({ children }: { children: React.ReactNode }) {

  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {

    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as Theme | null;

    if (stored === 'light' || stored === 'dark') setThemeState(stored);
  }, []);

  const setTheme = useCallback((next: Theme) => {

    setThemeState(next);
    document.documentElement.classList.toggle('light', next === 'light');
    localStorage.setItem(STORAGE_KEY, next);
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


export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`;
