'use client';

import { useTransition } from 'react';
import { updateTaskStatusAction } from '@/app/actions';


const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked'];


interface TaskStatusSelectProps {
  taskId: string;
  projectId: string;
  currentStatus: string;
}


export function TaskStatusSelect({ taskId, projectId, currentStatus }: TaskStatusSelectProps) {

  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {

    const status = e.target.value;

    startTransition(() => {
      updateTaskStatusAction(taskId, status, projectId);
    });
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="text-xs rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
      style={{ background: 'var(--surface-overlay)', color: 'var(--text)', border: '1px solid var(--border)' }}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s} style={{ background: 'var(--surface-overlay)', color: 'var(--text)' }}>
          {s.replace('_', ' ')}
        </option>
      ))}
    </select>
  );
}
