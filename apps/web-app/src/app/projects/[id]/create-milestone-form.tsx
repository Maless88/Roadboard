'use client';

import { useState, useTransition } from 'react';
import { createMilestoneAction } from '@/app/actions';


interface CreateMilestoneFormProps {
  projectId: string;
  phaseId?: string;
}


export function CreateMilestoneForm({ projectId, phaseId }: CreateMilestoneFormProps) {

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (!title.trim()) return;

    startTransition(async () => {
      const result = await createMilestoneAction(projectId, {
        title: title.trim(),
        phaseId,
        dueDate: dueDate || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setTitle('');
      setDueDate('');
      setError('');
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
      >
        + Milestone
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded border border-gray-700 bg-gray-800 p-3 space-y-2 mt-2">
      <input
        autoFocus
        type="text"
        placeholder="Titolo milestone"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-full text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? '…' : 'Crea'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); }}
          className="text-xs px-2 py-1 rounded bg-gray-600 text-gray-300 hover:bg-gray-500 transition-colors"
        >
          ✕
        </button>
      </div>
    </form>
  );
}
