'use client';

import { useState, useTransition } from 'react';
import { createPhaseAction } from '@/app/actions';


interface CreatePhaseFormProps {
  projectId: string;
}


export function CreatePhaseForm({ projectId }: CreatePhaseFormProps) {

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (!title.trim()) return;

    startTransition(async () => {
      const result = await createPhaseAction(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setTitle('');
      setDescription('');
      setError('');
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        + Nuova fase
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
      <input
        autoFocus
        type="text"
        placeholder="Titolo fase"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <textarea
        placeholder="Descrizione (opzionale)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Salvo…' : 'Crea'}
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
  );
}
