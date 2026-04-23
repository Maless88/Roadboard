'use client';

import { useState } from 'react';
import { TaskRow } from './task-row';
import type { Phase, Task } from '@/lib/api';


const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  draft: 'bg-gray-500/10 text-gray-400',
  paused: 'bg-yellow-500/10 text-yellow-400',
  completed: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-indigo-500/10 text-indigo-400',
  archived: 'bg-gray-500/[0.07] text-gray-500',
  planned: 'bg-purple-500/10 text-purple-400',
  blocked: 'bg-red-500/10 text-red-400',
  pending: 'bg-gray-500/10 text-gray-400',
};


interface PhaseAccordionProps {
  phase: Phase;
  tasks: Task[];
  projectId: string;
}


export function PhaseAccordion({ phase, tasks, projectId }: PhaseAccordionProps) {

  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg
            className={`shrink-0 w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div className="min-w-0">
            <span className="text-sm font-medium text-white">{phase.title}</span>
            {phase.description && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{phase.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs text-gray-500">{tasks.length} task</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[phase.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
            {phase.status}
          </span>
        </div>
      </button>

      {open && tasks.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {tasks.map((task, i) => (
            <TaskRow key={task.id} task={task} projectId={projectId} isLast={i === tasks.length - 1} />
          ))}
        </div>
      )}

      {open && tasks.length === 0 && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.01)' }}>
          <p className="text-xs text-gray-500">Nessun task in questa fase.</p>
        </div>
      )}
    </div>
  );
}
