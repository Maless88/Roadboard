'use client';

import { useState } from 'react';
import { useDict } from '@/lib/i18n/locale-context';
import { AttributionLine } from './attribution-line';
import type { Decision, Phase } from '@/lib/api';


const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  draft: 'bg-gray-500/10 text-gray-400',
  paused: 'bg-yellow-500/10 text-yellow-400',
  completed: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-indigo-500/10 text-indigo-400',
  planned: 'bg-purple-500/10 text-purple-400',
  blocked: 'bg-red-500/10 text-red-400',
  open: 'bg-yellow-500/10 text-yellow-400',
  accepted: 'bg-green-500/10 text-green-400',
  rejected: 'bg-red-500/10 text-red-400',
  superseded: 'bg-gray-500/10 text-gray-400',
};

const PHASE_STATUS_COLOR: Record<string, string> = {
  planned: 'bg-purple-500/10 text-purple-400',
  in_progress: 'bg-indigo-500/10 text-indigo-400',
  completed: 'bg-green-500/10 text-green-400',
  blocked: 'bg-red-500/10 text-red-400',
  draft: 'bg-gray-500/10 text-gray-400',
};

const IMPACT_COLOR: Record<string, string> = {
  low: 'text-gray-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};


interface DecisionAccordionProps {
  decision: Decision;
  phases: Phase[];
}


export function DecisionAccordion({ decision, phases }: DecisionAccordionProps) {

  const [open, setOpen] = useState(false);
  const dict = useDict();

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <svg
            className={`shrink-0 w-3.5 h-3.5 mt-0.5 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div className="min-w-0">
            <span className="text-sm font-medium text-white">{decision.title}</span>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{decision.summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {phases.length > 0 && (
            <span className="text-xs text-gray-500">{phases.length} {phases.length === 1 ? 'fase' : 'fasi'}</span>
          )}
          {decision.impactLevel && (
            <span className={`text-xs font-medium ${IMPACT_COLOR[decision.impactLevel] ?? 'text-gray-400'}`}>
              {decision.impactLevel}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[decision.status] ?? 'bg-gray-700 text-gray-300'}`}>
            {decision.status}
          </span>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.01)' }}>
          {decision.rationale && (
            <div className="px-4 pt-3">
              <p className="text-xs text-gray-500 italic">{decision.rationale}</p>
            </div>
          )}
          {decision.outcome && (
            <div className="px-4 pt-2">
              <p className="text-xs text-green-400">Outcome: {decision.outcome}</p>
            </div>
          )}

          <div className="px-4 pt-3 pb-1">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Fasi risolutive</p>
            {phases.length === 0 ? (
              <p className="text-xs text-gray-500 pb-3">Nessuna fase collegata a questa decision.</p>
            ) : (
              <div className="space-y-1.5 pb-3">
                {phases.map((phase) => (
                  <div
                    key={phase.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-white">{phase.title}</span>
                      {phase.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{phase.description}</p>
                      )}
                    </div>
                    <span className={`shrink-0 ml-3 text-xs px-2 py-0.5 rounded-full ${PHASE_STATUS_COLOR[phase.status] ?? 'bg-gray-700 text-gray-300'}`}>
                      {phase.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {decision.resolvedAt && (
            <div className="px-4 pb-3">
              <p className="text-xs text-gray-600">Risolto: {new Date(decision.resolvedAt).toLocaleDateString('it-IT')}</p>
            </div>
          )}

          <div className="px-4 pb-3">
            <AttributionLine
              createdBy={decision.createdBy}
              updatedBy={decision.updatedBy}
              updatedAt={decision.updatedAt}
              dict={dict}
            />
          </div>
        </div>
      )}
    </div>
  );
}
