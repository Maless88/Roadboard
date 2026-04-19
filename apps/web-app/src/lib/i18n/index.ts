import { cookies } from 'next/headers';
import { itDict } from './it';
import { enDict } from './en';
import type { Dictionary, Locale } from './types';
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES } from './types';

const DICTIONARIES: Record<Locale, Dictionary> = {
  it: itDict,
  en: enDict,
};


export function resolveLocale(value: string | undefined): Locale {
  if (value && SUPPORTED_LOCALES.includes(value as Locale)) {
    return value as Locale;
  }

  return DEFAULT_LOCALE;
}


export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}


export async function getDict(): Promise<Dictionary> {
  const locale = await getLocale();
  return DICTIONARIES[locale];
}


export { itDict, enDict };
export type { Dictionary, Locale };
export { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES };
