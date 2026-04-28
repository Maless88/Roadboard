'use client';

import { useState, useTransition } from 'react';
import { deleteTaskAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';


interface Props {
  taskId: string;
  taskTitle: string;
  projectId: string;
}


export function TaskDeleteButton({ taskId, taskTitle, projectId }: Props) {

  const dict = useDict();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {

    if (!confirming) {
      setConfirming(true);
      return;
    }

    startTransition(async () => {
      const result = await deleteTaskAction(taskId, projectId);

      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (error) {
    return <span className="text-xs text-red-400">{error}</span>;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {confirming && (
        <span className="text-xs text-gray-400">
          {dict.project.confirmDeleteTask(taskTitle)}
        </span>
      )}
      <button
        type="button"
        onClick={confirming ? () => setConfirming(false) : handleClick}
        disabled={isPending}
        className={`text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50 ${
          confirming
            ? 'bg-transparent border border-gray-600 text-gray-400'
            : 'text-red-400 hover:bg-red-950 hover:text-red-300 border border-transparent hover:border-red-800'
        }`}
      >
        {isPending ? dict.project.deleting : confirming ? dict.project.cancelDelete : dict.project.deleteTask}
      </button>
      {confirming && !isPending && (
        <button
          type="button"
          onClick={handleClick}
          className="text-xs px-3 py-1.5 rounded bg-red-900 hover:bg-red-800 text-red-200 border border-red-700 transition-colors"
        >
          {dict.project.confirmButton}
        </button>
      )}
    </div>
  );
}
