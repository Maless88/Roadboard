import type { itDict } from './it';

export type Dictionary = typeof itDict;

export type Locale = 'it' | 'en';

export const SUPPORTED_LOCALES: Locale[] = ['it', 'en'];

export const DEFAULT_LOCALE: Locale = 'it';

export const LOCALE_COOKIE = 'NEXT_LOCALE';
