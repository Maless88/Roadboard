'use client';

import { useState, useTransition } from 'react';
import { createMemoryEntryAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';


interface CreateMemoryFormProps {
  projectId: string;
}


export function CreateMemoryForm({ projectId }: CreateMemoryFormProps) {

  const dict = useDict();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('done');
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
        {dict.forms.createMemory}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          placeholder={dict.forms.memoryTitlePlaceholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="glass-input flex-1 text-sm rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="glass-input text-xs rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="done">done</option>
          <option value="next">next</option>
          <option value="decision">decision</option>
          <option value="architecture">architecture</option>
          <option value="issue">issue</option>
          <option value="learning">learning</option>
          <option value="handoff">handoff</option>
          <option value="operational_note">operational note</option>
          <option value="open_question">open question</option>
        </select>
      </div>
      <textarea
        placeholder={dict.forms.memoryBodyPlaceholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="glass-input w-full text-sm rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      />

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
