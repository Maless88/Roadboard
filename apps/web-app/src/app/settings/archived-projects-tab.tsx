'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDict } from '@/lib/i18n/locale-context';
import { unarchiveProjectAction, deleteArchivedProjectAction } from '@/app/actions';
import type { Project } from '@/lib/api';


interface Props {
  projects: Project[];
}


export function ArchivedProjectsTab({ projects }: Props) {

  const dict = useDict();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localProjects, setLocalProjects] = useState(projects);
  const [error, setError] = useState('');

  function handleUnarchive(id: string) {

    startTransition(async () => {

      setError('');
      const res = await unarchiveProjectAction(id);

      if (res.error) {
        setError(res.error);
        return;
      }

      setLocalProjects((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    });
  }

  function handleDelete(p: Project) {

    if (!confirm(dict.settings.archived.confirmDelete(p.name))) return;

    startTransition(async () => {

      setError('');
      const res = await deleteArchivedProjectAction(p.id);

      if (res.error) {
        setError(res.error);
        return;
      }

      setLocalProjects((prev) => prev.filter((x) => x.id !== p.id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}>
        <h3 className="text-sm font-semibold text-white mb-1">{dict.settings.archived.title}</h3>
        <p className="text-xs text-gray-400 mb-4">{dict.settings.archived.description}</p>

        {error && (
          <div
            className="rounded-lg px-4 py-3 mb-3 text-sm text-red-400"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {error}
          </div>
        )}

        {localProjects.length === 0 ? (
          <p className="text-sm text-gray-500">{dict.settings.archived.empty}</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {localProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleUnarchive(p.id)}
                    disabled={isPending}
                    className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                  >
                    {dict.settings.archived.unarchive}
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={isPending}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                  >
                    {dict.settings.archived.deletePermanent}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
