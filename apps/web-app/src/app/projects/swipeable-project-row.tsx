'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { deleteProjectAction } from '@/app/actions';


const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-900 text-green-300',
  draft: 'bg-gray-700 text-gray-300',
  paused: 'bg-yellow-900 text-yellow-300',
  completed: 'bg-blue-900 text-blue-300',
  archived: 'bg-gray-800 text-gray-500',
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

  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);

  function onPointerDown(e: React.PointerEvent) {

    startX.current = e.clientX;
    startOffset.current = offset;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {

    if (startX.current === null) return;

    const delta = e.clientX - startX.current;
    const next = Math.min(0, Math.max(-SNAP_OPEN - 20, startOffset.current + delta));
    setOffset(next);
  }

  function onPointerUp() {

    startX.current = null;
    const snap = offset < -(REVEAL_THRESHOLD / 2);
    setOffset(snap ? -SNAP_OPEN : 0);
    setOpen(snap);
  }

  function handleDelete() {

    startTransition(async () => {
      await deleteProjectAction(id);
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
      <Link
        href={`/projects/${id}`}
        draggable={false}
        onClick={(e) => { if (open) e.preventDefault(); }}
        className="block rounded-lg border border-gray-800 bg-gray-900 px-5 py-4 hover:border-gray-600 transition-colors"
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
      </Link>

      {/* Overlay cestino — cresce da destra */}
      <div
        className="absolute top-0 right-0 bottom-0 overflow-hidden rounded-r-lg flex items-center justify-center"
        style={{
          width: revealWidth,
          transition: startX.current !== null ? 'none' : 'width 0.2s ease',
          background: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)',
        }}
      >
        <button
          onClick={handleDelete}
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
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5 text-red-300" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
