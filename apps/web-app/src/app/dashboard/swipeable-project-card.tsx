'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProjectAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';
import type { Project, DashboardSnapshot } from '@/lib/api';


const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-400',
  paused: 'bg-yellow-400',
  draft: 'bg-gray-500',
  completed: 'bg-indigo-400',
  archived: 'bg-gray-700',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'text-green-400',
  paused: 'text-yellow-400',
  draft: 'text-gray-500',
  completed: 'text-indigo-400',
  archived: 'text-gray-600',
};

const TASK_COLORS: Record<string, string> = {
  todo: 'text-gray-500',
  in_progress: 'text-indigo-400',
  done: 'text-green-400',
  blocked: 'text-red-400',
};

const REVEAL_THRESHOLD = 60;
const SNAP_OPEN = 80;


interface Props {
  project: Project;
  snap: DashboardSnapshot | null;
}


export function SwipeableProjectCard({ project, snap }: Props) {

  const dict = useDict();
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startOffset = useRef(0);
  const didSwipe = useRef(false);

  const taskDone = snap?.tasks['done'] ?? 0;
  const taskTotal = snap ? Object.values(snap.tasks).reduce((a, b) => a + b, 0) : 0;
  const pct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
  const visibleStatuses = (['in_progress', 'todo', 'done', 'blocked'] as const).filter(
    (s) => (snap?.tasks[s] ?? 0) > 0,
  );

  function onPointerDown(e: React.PointerEvent) {

    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startY.current = e.clientY;
    startOffset.current = offset;
    didSwipe.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {

    if (startX.current === null) return;

    const dx = e.clientX - startX.current;
    const dy = Math.abs(e.clientY - (startY.current ?? e.clientY));

    if (dy > 8) return;

    if (Math.abs(dx) > 4) didSwipe.current = true;

    const next = Math.min(0, Math.max(-SNAP_OPEN - 20, startOffset.current + dx));
    setOffset(next);
  }

  function onPointerUp() {

    const wasSwipe = didSwipe.current;
    const wasOpen = open;
    startX.current = null;

    if (!wasSwipe) {

      if (wasOpen) {
        setOffset(0);
        setOpen(false);
        return;
      }

      router.push(`/projects/${project.id}?tab=tasks`);
      return;
    }

    const snapOpen = offset < -(REVEAL_THRESHOLD / 2);
    setOffset(snapOpen ? -SNAP_OPEN : 0);
    setOpen(snapOpen);
  }

  function handleDelete() {

    startTransition(async () => {
      await deleteProjectAction(project.id);
    });
  }

  const revealWidth = Math.abs(offset);

  return (
    <div
      data-testid="project-card"
      data-project-id={project.id}
      data-project-href={`/projects/${project.id}`}
      className="relative rounded-2xl touch-pan-y select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="group block rounded-2xl p-5 cursor-pointer transition-all bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.055)] hover:border-[rgba(255,255,255,0.12)] h-full"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[project.status] ?? 'bg-gray-500'}`} />
            <h2 className="text-sm font-semibold text-white truncate">{project.name}</h2>
          </div>
          <span className={`text-xs shrink-0 font-medium ${STATUS_LABEL[project.status] ?? 'text-gray-500'}`}>
            {project.status}
          </span>
        </div>

        {project.description && (
          <p className="text-xs text-gray-500 mb-4 line-clamp-2">{project.description}</p>
        )}

        {taskTotal > 0 ? (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-gray-600 mb-1.5">
              <span>{pct}% {dict.nav.completed}</span>
              <span className="font-mono">{taskDone}/{taskTotal}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#818cf8)' }}
              />
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
        )}

        {visibleStatuses.length > 0 ? (
          <div className="flex items-center gap-3 flex-wrap">
            {visibleStatuses.map((s) => (
              <span key={s} className={`flex items-center gap-1 text-[10px] ${TASK_COLORS[s]}`}>
                <span className="w-1 h-1 rounded-full bg-current" />
                {snap!.tasks[s]} {s.replace('_', '\u00a0')}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-gray-700">{dict.project.noTasks}</p>
        )}

        {snap && snap.activePhases.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[10px] text-gray-600 truncate">
              📍 {snap.activePhases[0].title}
              {snap.activePhases.length > 1 && ` +${snap.activePhases.length - 1}`}
            </p>
          </div>
        )}
      </div>

      <div
        className="absolute top-0 right-0 bottom-0 overflow-hidden rounded-r-2xl flex items-center justify-center"
        style={{
          width: revealWidth,
          transition: startX.current !== null ? 'none' : 'width 0.2s ease',
          background: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)',
        }}
      >
        <button
          onClick={handleDelete}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={isPending}
          aria-label="Elimina progetto"
          style={{ width: SNAP_OPEN, opacity: revealWidth < 20 ? 0 : Math.min(1, (revealWidth - 20) / 30) }}
          className="flex flex-col items-center justify-center gap-1.5 h-full transition-opacity disabled:opacity-40 group"
        >
          {isPending ? (
            <div className="w-5 h-5 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl bg-red-900/60 border border-red-700/50 flex items-center justify-center group-hover:bg-red-800/80 group-hover:border-red-600 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-300">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </div>
              <span className="text-xs font-medium text-red-400 group-hover:text-red-300 transition-colors">elimina</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
