'use client';

import { useState, useTransition } from 'react';
import { createMemoryEntryAction } from '@/app/actions';


interface CreateMemoryFormProps {
  projectId: string;
}


export function CreateMemoryForm({ projectId }: CreateMemoryFormProps) {

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('context');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (!title.trim()) return;

    startTransition(async () => {
      const result = await createMemoryEntryAction(projectId, {
        title: title.trim(),
        type,
        body: body.trim() || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setTitle('');
      setBody('');
      setType('context');
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
        + Nuova entry
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          placeholder="Titolo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="context">context</option>
          <option value="done">done</option>
          <option value="next">next</option>
          <option value="decision">decision</option>
        </select>
      </div>
      <textarea
        placeholder="Corpo (opzionale)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
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
