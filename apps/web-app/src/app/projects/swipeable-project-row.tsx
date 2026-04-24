'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveProjectAction } from '@/app/actions';


const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  draft: 'bg-gray-500/10 text-gray-400',
  paused: 'bg-yellow-500/10 text-yellow-400',
  completed: 'bg-blue-500/10 text-blue-400',
  archived: 'bg-gray-500/[0.07] text-gray-500',
};

const REVEAL_THRESHOLD = 60;
const SNAP_OPEN = 80;


interface Props {
  id: string;
  name: string;
  status: string;
  description?: string | null;
}


export function SwipeableProjectRow({ id, name, status, description }: Props) {

  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startOffset = useRef(0);
  const didSwipe = useRef(false);

  function onPointerDown(e: React.PointerEvent) {

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

    startX.current = null;
    const snap = offset < -(REVEAL_THRESHOLD / 2);
    setOffset(snap ? -SNAP_OPEN : 0);
    setOpen(snap);
  }

  function onCardClick() {

    if (didSwipe.current || open) {
      if (open) { setOpen(false); setOffset(0); }
      return;
    }

    router.push(`/projects/${id}`);
  }

  function handleArchive() {

    startTransition(async () => {
      await archiveProjectAction(id);
      router.refresh();
    });
  }

  const revealWidth = Math.abs(offset);

  return (
    <div
      className="relative rounded-lg touch-pan-y select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Card — non si muove mai */}
      <div
        onClick={onCardClick}
        className="block rounded-xl px-5 py-4 cursor-pointer transition-all"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">{name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] ?? 'bg-gray-700 text-gray-300'}`}>
            {status}
          </span>
        </div>
        {description && (
          <p className="mt-1 text-xs text-gray-400 line-clamp-1">{description}</p>
        )}
      </div>

      {/* Overlay cestino — cresce da destra */}
      <div
        className="absolute top-0 right-0 bottom-0 overflow-hidden rounded-r-lg flex items-center justify-center"
        style={{
          width: revealWidth,
          transition: startX.current !== null ? 'none' : 'width 0.2s ease',
          background: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
        }}
      >
        <button
          onClick={handleArchive}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={isPending}
          aria-label="Archivia progetto"
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
              <span className="text-xs font-medium text-amber-300 group-hover:text-amber-200 transition-colors">archivia</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
