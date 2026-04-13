'use client';

import { useState, useTransition } from 'react';
import { createDecisionAction } from '@/app/actions';


interface CreateDecisionFormProps {
  projectId: string;
}


export function CreateDecisionForm({ projectId }: CreateDecisionFormProps) {

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [rationale, setRationale] = useState('');
  const [impactLevel, setImpactLevel] = useState('medium');
  const [status, setStatus] = useState('open');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (!title.trim() || !summary.trim()) return;

    startTransition(async () => {
      const result = await createDecisionAction(projectId, {
        title: title.trim(),
        summary: summary.trim(),
        rationale: rationale.trim() || undefined,
        impactLevel,
        status,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setTitle('');
      setSummary('');
      setRationale('');
      setImpactLevel('medium');
      setStatus('open');
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
        + Nuova decisione
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
      <input
        autoFocus
        type="text"
        placeholder="Titolo decisione"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <textarea
        placeholder="Sommario *"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={2}
        className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      />
      <textarea
        placeholder="Motivazione (opzionale)"
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      />

      <div className="flex gap-2">
        <select
          value={impactLevel}
          onChange={(e) => setImpactLevel(e.target.value)}
          className="flex-1 text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="low">Impatto: low</option>
          <option value="medium">Impatto: medium</option>
          <option value="high">Impatto: high</option>
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex-1 text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="open">open</option>
          <option value="accepted">accepted</option>
          <option value="rejected">rejected</option>
          <option value="superseded">superseded</option>
        </select>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !title.trim() || !summary.trim()}
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
