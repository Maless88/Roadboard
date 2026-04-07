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
      className="text-xs rounded bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace('_', ' ')}
        </option>
      ))}
    </select>
  );
}
