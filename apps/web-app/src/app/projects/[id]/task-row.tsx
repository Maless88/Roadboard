'use client';

import { useState } from 'react';
import { useDict } from '@/lib/i18n/locale-context';
import { TaskStatusSelect } from './task-status';
import { AttributionLine } from './attribution-line';
import type { Task } from '@/lib/api';


const TASK_STATUS_COLOR: Record<string, string> = {
  todo: 'bg-gray-500/10 text-gray-400',
  in_progress: 'bg-indigo-500/10 text-indigo-400',
  done: 'bg-green-500/10 text-green-400',
  blocked: 'bg-red-500/10 text-red-400',
};

const TASK_PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
};


interface TaskRowProps {
  task: Task;
  projectId: string;
  isLast?: boolean;
}


export function TaskRow({ task, projectId, isLast }: TaskRowProps) {

  const [open, setOpen] = useState(false);
  const dict = useDict();

  const hasDetails = task.description || task.dueDate || task.completionNotes || task.completedAt || task.createdBy || task.updatedBy;

  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        style={{
          borderBottom: open || !isLast ? '1px solid rgba(255,255,255,0.05)' : undefined,
          background: open ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {hasDetails && (
            <svg
              className={`shrink-0 w-3 h-3 text-gray-600 transition-transform ${open ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
          {!hasDetails && <span className="w-3 shrink-0" />}
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLOR[task.status] ?? 'bg-gray-700 text-gray-300'}`}>
            {task.status.replace('_', ' ')}
          </span>
          <span className="text-sm text-white truncate">{task.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
          {task.priority && (
            <span className={`text-xs font-medium ${TASK_PRIORITY_COLOR[task.priority] ?? 'text-gray-400'}`}>
              {task.priority}
            </span>
          )}
          <TaskStatusSelect taskId={task.id} projectId={projectId} currentStatus={task.status} />
        </div>
      </div>

      {open && hasDetails && (
        <div
          className="px-4 py-3 space-y-2"
          style={{ borderBottom: !isLast ? '1px solid rgba(255,255,255,0.05)' : undefined, background: 'rgba(255,255,255,0.01)' }}
        >
          {task.description && (
            <p className="text-xs text-gray-400 leading-relaxed">{task.description}</p>
          )}
          <div className="flex flex-wrap gap-4">
            {task.dueDate && (
              <div>
                <span className="text-xs text-gray-600 uppercase tracking-wider">Scadenza</span>
                <p className="text-xs text-gray-300 mt-0.5">
                  {new Date(task.dueDate).toLocaleDateString('it-IT')}
                </p>
              </div>
            )}
            {task.completedAt && (
              <div>
                <span className="text-xs text-gray-600 uppercase tracking-wider">Completato</span>
                <p className="text-xs text-green-400 mt-0.5">
                  {new Date(task.completedAt).toLocaleDateString('it-IT')}
                </p>
              </div>
            )}
          </div>
          {task.completionNotes && (
            <div>
              <span className="text-xs text-gray-600 uppercase tracking-wider">Note</span>
              <p className="text-xs text-gray-400 mt-0.5 italic">{task.completionNotes}</p>
            </div>
          )}
          <AttributionLine
            createdBy={task.createdBy}
            updatedBy={task.updatedBy}
            updatedAt={task.updatedAt}
            dict={dict}
            className="pt-1"
          />
        </div>
      )}
    </>
  );
}
