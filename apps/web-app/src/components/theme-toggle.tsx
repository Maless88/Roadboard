'use client';

import { useTheme } from '@/lib/theme-context';
import { useDict } from '@/lib/i18n/locale-context';


interface ThemeToggleProps {
  variant?: 'menu' | 'icon';
}


export function ThemeToggle({ variant = 'menu' }: ThemeToggleProps) {

  const { theme, toggle } = useTheme();
  const dict = useDict();
  const isDark = theme === 'dark';
  const label = isDark ? dict.nav.themeLight : dict.nav.themeDark;

  if (variant === 'icon') {

    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      <span>{label}</span>
    </button>
  );
}


function SunIcon() {

  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414m0-13.728l1.414 1.414m11.314 11.314l1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}


function MoonIcon() {

  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
      />
    </svg>
  );
}
