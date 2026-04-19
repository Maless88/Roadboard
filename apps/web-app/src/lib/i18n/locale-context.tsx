'use client';

import { createContext, useContext, useMemo } from 'react';
import { itDict } from './it';
import { enDict } from './en';
import type { Dictionary, Locale } from './types';


const DICTIONARIES: Record<Locale, Dictionary> = { it: itDict, en: enDict };

export const LocaleContext = createContext<Dictionary>(itDict);


export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {

  const dict = useMemo(() => DICTIONARIES[locale] ?? itDict, [locale]);

  return (
    <LocaleContext.Provider value={dict}>
      {children}
    </LocaleContext.Provider>
  );
}


export function useDict(): Dictionary {
  return useContext(LocaleContext);
}
