'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveProjectAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';
import { useToast } from '@/lib/toast-context';
import { withToast } from '@/lib/with-toast';
import { resolveThumbnailUrl } from '@/lib/thumbnail-url';
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


type SnapError = { error: 'forbidden' | 'unknown' };

interface Props {
  project: Project;
  snap: DashboardSnapshot | SnapError | null;
}


export function SwipeableProjectCard({ project, snap }: Props) {

  const dict = useDict();
  const { showToast } = useToast();
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startOffset = useRef(0);
  const didSwipe = useRef(false);

  const snapData = snap && !('error' in snap) ? snap : null;
  const snapError = snap && 'error' in snap ? snap : null;

  const taskDone = snapData?.tasks['done'] ?? 0;
  const taskTotal = snapData ? Object.values(snapData.tasks).reduce((a, b) => a + b, 0) : 0;
  const pct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
  const visibleStatuses = (['in_progress', 'todo', 'done', 'blocked'] as const).filter(
    (s) => (snapData?.tasks[s] ?? 0) > 0,
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

  function handleArchive() {

    startTransition(async () => {
      await withToast(
        () => archiveProjectAction(project.id),
        showToast,
        { successMsg: dict.common.toast.saved },
      );
      router.refresh();
    });
  }

  const revealWidth = Math.abs(offset);
  const isCompleted = project.status === 'completed';
  const thumbnailUrl = resolveThumbnailUrl(project.thumbnailUrl);

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
        className="group block rounded-2xl overflow-hidden cursor-pointer transition-all h-full"
        style={{
          background: thumbnailUrl
            ? `url(${thumbnailUrl}) center / cover no-repeat`
            : isCompleted ? 'var(--surface)' : 'var(--surface)',
          border: isCompleted ? '1px solid rgba(99,102,241,0.25)' : '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
        onMouseEnter={(e) => {
          if (!thumbnailUrl) e.currentTarget.style.background = 'var(--surface-hover)';
        }}
        onMouseLeave={(e) => {
          if (!thumbnailUrl) e.currentTarget.style.background = 'var(--surface)';
        }}
      >
        {thumbnailUrl && (
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.55)', zIndex: 0 }}
          />
        )}
        <div className="p-5" style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[project.status] ?? 'bg-gray-500'}`} />
            <h2 className="text-sm font-semibold text-white truncate">{project.name}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-medium ${STATUS_LABEL[project.status] ?? 'text-gray-500'}`}>
              {project.status}
            </span>
          </div>
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
                style={{
                  width: `${pct}%`,
                  background: pct === 100
                    ? 'linear-gradient(90deg,#4f46e5,#6366f1)'
                    : 'linear-gradient(90deg,#6366f1,#818cf8)',
                }}
              />
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
        )}

        {snapError ? (
          <p
            className="text-[10px] text-gray-600"
            title={dict.project.snapshotUnavailableHint}
          >
            {dict.project.snapshotUnavailable}
          </p>
        ) : visibleStatuses.length > 0 ? (
          <div className="flex items-center gap-3 flex-wrap">
            {visibleStatuses.map((s) => (
              <span key={s} className={`flex items-center gap-1 text-[10px] ${TASK_COLORS[s]}`}>
                <span className="w-1 h-1 rounded-full bg-current" />
                {snapData!.tasks[s]} {s.replace('_', ' ')}
              </span>
            ))}
          </div>
        ) : snapData !== null ? (
          <div className="flex flex-col items-center gap-1.5 py-2">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-700"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M9 12h6M12 9v6" />
            </svg>
            <p className="text-[10px] text-gray-600">{dict.projects.emptyState.title}</p>
            <a
              href={`/projects/${project.id}/tasks/new`}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
            >
              {dict.projects.emptyState.cta}
            </a>
          </div>
        ) : (
          <p className="text-[10px] text-gray-700">{dict.project.noTasks}</p>
        )}

        {snapData && snapData.activePhases.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[10px] text-gray-600 truncate">
              📍 {snapData.activePhases[0].title}
              {snapData.activePhases.length > 1 && ` +${snapData.activePhases.length - 1}`}
            </p>
          </div>
        )}
        </div>
      </div>

      <div
        className="absolute top-0 right-0 bottom-0 overflow-hidden rounded-r-2xl flex items-center justify-center"
        style={{
          width: revealWidth,
          transition: startX.current !== null ? 'none' : 'width 0.2s ease',
          background: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
          zIndex: 2,
        }}
      >
        <button
          onClick={handleArchive}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={isPending}
          aria-label={dict.project.archiveLabel}
          style={{ width: SNAP_OPEN, opacity: revealWidth < 20 ? 0 : Math.min(1, (revealWidth - 20) / 30) }}
          className="flex flex-col items-center justify-center gap-1.5 h-full transition-opacity disabled:opacity-40 group"
        >
          {isPending ? (
            <div className="w-5 h-5 rounded-full border-2 border-amber-300 border-t-transparent animate-spin" />
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl bg-amber-900/60 border border-amber-700/50 flex items-center justify-center group-hover:bg-amber-800/80 group-hover:border-amber-600 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-200">
                  <rect x="3" y="4" width="18" height="4" rx="1" />
                  <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
                  <path d="M10 12h4" />
                </svg>
              </div>
              <span className="text-xs font-medium text-amber-300 group-hover:text-amber-200 transition-colors">{dict.project.archive}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

