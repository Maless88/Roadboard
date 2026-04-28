'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useDict } from '@/lib/i18n/locale-context';


export function MemorySearch({ defaultValue = '' }: { defaultValue?: string }) {

  const dict = useDict();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {

    const q = e.target.value;
    const params = new URLSearchParams(searchParams.toString());

    if (q) {
      params.set('q', q);
    } else {
      params.delete('q');
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <input
      type="search"
      placeholder={dict.forms.memorySearchPlaceholder}
      defaultValue={defaultValue}
      onChange={handleChange}
      className={[
        'glass-input w-full text-sm rounded-lg px-3 py-1.5',
        'text-white placeholder-gray-500',
        'focus:outline-none focus:ring-1 focus:ring-indigo-500',
        isPending ? 'opacity-60' : '',
      ].join(' ')}
    />
  );
}
