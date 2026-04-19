'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLocaleAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';
import type { Locale } from '@/lib/i18n';


const LOCALES: Locale[] = ['it', 'en'];


export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {

  const dict = useDict();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(locale: Locale) {

    if (locale === currentLocale) return;

    startTransition(async () => {
      await setLocaleAction(locale);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5">
      <span className="text-[10px] text-gray-600 uppercase tracking-wider mr-0.5">
        {dict.language.switchLabel}
      </span>
      {LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          disabled={pending}
          className={[
            'text-[10px] px-2 py-0.5 rounded transition-colors',
            loc === currentLocale
              ? 'bg-indigo-600/30 text-indigo-300 font-medium'
              : 'text-gray-500 hover:text-white hover:bg-white/5',
          ].join(' ')}
        >
          {dict.language[loc]}
        </button>
      ))}
    </div>
  );
}
