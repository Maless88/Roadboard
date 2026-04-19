'use client';

import { useState, useTransition } from 'react';
import { createPhaseAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';
import type { Decision } from '@/lib/api';


interface CreatePhaseFormProps {
  projectId: string;
  decisions?: Decision[];
}


export function CreatePhaseForm({ projectId, decisions = [] }: CreatePhaseFormProps) {

  const dict = useDict();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [decisionId, setDecisionId] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (!title.trim()) return;

    startTransition(async () => {
      const result = await createPhaseAction(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        decisionId: decisionId || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setTitle('');
      setDescription('');
      setDecisionId('');
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
        {dict.forms.createPhase}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-xl p-4 space-y-3">
      <input
        autoFocus
        type="text"
        placeholder={dict.forms.phaseTitlePlaceholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="glass-input w-full text-sm rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <textarea
        placeholder={dict.forms.descriptionOptional}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="glass-input w-full text-sm rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      />

      {decisions.length > 0 && (
        <select
          value={decisionId}
          onChange={(e) => setDecisionId(e.target.value)}
          className="glass-input w-full text-sm rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Nessuna decision collegata</option>
          {decisions.map((d) => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? dict.forms.saving : dict.forms.create}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); }}
          className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          {dict.forms.cancel}
        </button>
      </div>
    </form>
  );
}
