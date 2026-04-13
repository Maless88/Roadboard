'use client';

import { useState, useTransition } from 'react';
import { createTaskAction } from '@/app/actions';
import type { Phase } from '@/lib/api';


interface CreateTaskFormProps {
  projectId: string;
  phases: Phase[];
}


export function CreateTaskForm({ projectId, phases }: CreateTaskFormProps) {

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (!title.trim()) return;

    startTransition(async () => {
      const result = await createTaskAction(projectId, {
        title: title.trim(),
        phaseId: phaseId || undefined,
        priority,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setTitle('');
      setPhaseId('');
      setPriority('medium');
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
        + Nuovo task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
      <input
        autoFocus
        type="text"
        placeholder="Titolo task"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      <div className="flex gap-2">
        <select
          value={phaseId}
          onChange={(e) => setPhaseId(e.target.value)}
          className="flex-1 text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">— Nessuna fase —</option>
          {phases.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="critical">critical</option>
        </select>
      </div>

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
