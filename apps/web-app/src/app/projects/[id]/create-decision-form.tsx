'use client';

import { useState, useTransition } from 'react';
import { createDecisionAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';


interface CreateDecisionFormProps {
  projectId: string;
}


export function CreateDecisionForm({ projectId }: CreateDecisionFormProps) {

  const dict = useDict();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [rationale, setRationale] = useState('');
  const [outcome, setOutcome] = useState('');
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
        outcome: outcome.trim() || undefined,
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
      setOutcome('');
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
        {dict.forms.createDecision}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-xl p-4 space-y-3">
      <input
        autoFocus
        type="text"
        placeholder={dict.forms.decisionTitlePlaceholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="glass-input w-full text-sm rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <textarea
        placeholder={dict.forms.decisionSummaryPlaceholder}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={2}
        className="glass-input w-full text-sm rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      />
      <textarea
        placeholder={dict.forms.decisionRationalePlaceholder}
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        className="glass-input w-full text-sm rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      />
      <textarea
        placeholder={dict.forms.outcomeOptional}
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        rows={2}
        className="glass-input w-full text-sm rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      />

      <div className="flex gap-2">
        <select
          value={impactLevel}
          onChange={(e) => setImpactLevel(e.target.value)}
          className="glass-input flex-1 text-xs rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="low">{dict.forms.impactLow}</option>
          <option value="medium">{dict.forms.impactMedium}</option>
          <option value="high">{dict.forms.impactHigh}</option>
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="glass-input flex-1 text-xs rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="open">{dict.forms.statusOpen}</option>
          <option value="accepted">{dict.forms.statusAccepted}</option>
          <option value="rejected">{dict.forms.statusRejected}</option>
          <option value="superseded">{dict.forms.statusSuperseded}</option>
        </select>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !title.trim() || !summary.trim()}
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
