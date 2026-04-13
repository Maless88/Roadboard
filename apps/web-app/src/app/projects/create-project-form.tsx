'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProjectAction } from '@/app/actions';
import type { Team } from '@/lib/api';


interface CreateProjectFormProps {
  teams: Team[];
}


export function CreateProjectForm({ teams }: CreateProjectFormProps) {

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [ownerTeamId, setOwnerTeamId] = useState(teams[0]?.id ?? '');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {

    const value = e.target.value;
    setName(value);
    setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  }

  function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (!name.trim() || !slug.trim() || !ownerTeamId) return;

    startTransition(async () => {
      const result = await createProjectAction({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        ownerTeamId,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.id) {
        router.push(`/projects/${result.id}`);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
      >
        + Nuovo progetto
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-5 mb-6">
      <h2 className="text-sm font-semibold text-white mb-4">Nuovo progetto</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          autoFocus
          type="text"
          placeholder="Nome"
          value={name}
          onChange={handleNameChange}
          className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <input
          type="text"
          placeholder="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <textarea
          placeholder="Descrizione (opzionale)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />

        {teams.length > 0 && (
          <select
            value={ownerTeamId}
            onChange={(e) => setOwnerTeamId(e.target.value)}
            className="w-full text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || !name.trim() || !slug.trim() || !ownerTeamId}
            className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Creo…' : 'Crea progetto'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(''); }}
            className="text-xs px-3 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
