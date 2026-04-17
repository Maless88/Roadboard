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
const SNAP_OPEN = 72;


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

  return (
    <div className="overflow-hidden rounded-lg">
      {/* flex row: card + trash, translated together */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: startX.current !== null ? 'none' : 'transform 0.2s ease',
          display: 'flex',
          width: `calc(100% + ${SNAP_OPEN}px)`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="touch-pan-y"
      >
        {/* Card */}
        <div style={{ flex: `0 0 calc(100% - ${SNAP_OPEN}px)` }}>
          <Link
            href={`/projects/${id}`}
            draggable={false}
            onClick={(e) => { if (open) e.preventDefault(); }}
            className="block rounded-lg border border-gray-800 bg-gray-900 px-5 py-4 hover:border-gray-600 transition-colors select-none"
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
        </div>

        {/* Trash */}
        <div style={{ flex: `0 0 ${SNAP_OPEN}px`, paddingLeft: 4 }}>
          <button
            onClick={handleDelete}
            disabled={isPending}
            aria-label="Elimina progetto"
            className="flex flex-col items-center justify-center w-full h-full rounded-lg bg-red-950 text-red-400 hover:bg-red-900 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <span className="text-xs">…</span>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                <span className="text-xs mt-1">elimina</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
