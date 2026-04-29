'use client';

import { useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { McpClient, McpScope, McpTransport } from '@/lib/mcp/snippet-generator';
import { useDict } from '@/lib/i18n/locale-context';
import { Step1ClientChoice } from './Step1ClientChoice';
import { Step2Scope } from './Step2Scope';
import { Step3Connection } from './Step3Connection';
import { Step4Snippet } from './Step4Snippet';
import { Step5Verify } from './Step5Verify';


const CLIENTS_WITH_SCOPE: McpClient[] = ['claude-code', 'vscode'];
const TOTAL_STEPS = 5;
const MCP_URL_DEFAULT = process.env.NEXT_PUBLIC_MCP_URL ?? '';


interface WizardState {
  step: number;
  client: McpClient | null;
  scope: McpScope;
  transport: McpTransport;
  url: string;
  token: string;
}


function readState(params: URLSearchParams): WizardState {

  const step = parseInt(params.get('step') ?? '1', 10) || 1;
  const client = (params.get('client') as McpClient) || null;
  const scope = (params.get('scope') as McpScope) || 'user';
  const transport = (params.get('transport') as McpTransport) || 'http';
  const url = params.get('url') ?? MCP_URL_DEFAULT;
  const token = params.get('token') ?? '';

  return { step, client, scope, transport, url, token };
}


function buildUrl(state: Partial<WizardState> & { step: number }): string {

  const p = new URLSearchParams();
  p.set('step', String(state.step));

  if (state.client) {

    p.set('client', state.client);
  }

  if (state.scope) {

    p.set('scope', state.scope);
  }

  if (state.transport) {

    p.set('transport', state.transport);
  }

  if (state.url) {

    p.set('url', state.url);
  }

  if (state.token) {

    p.set('token', state.token);
  }

  return `/mcp-guide?${p.toString()}`;
}


export function Wizard() {

  const dict = useDict().mcp.wizard;
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = readState(searchParams);

  const { step, client, scope, transport, url, token } = state;

  const navigate = useCallback(
    (patch: Partial<WizardState> & { step: number }) => {

      router.push(buildUrl({ ...state, ...patch }), { scroll: false } as Parameters<typeof router.push>[1]);
    },
    [router, state],
  );

  // Keyboard handler
  useEffect(() => {

    function handleKey(e: KeyboardEvent) {

      const tag = (e.target as HTMLElement).tagName;

      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {

        return;
      }

      if (e.key === 'Escape') {

        const hasData = client || url !== MCP_URL_DEFAULT || token;

        if (hasData) {

          if (confirm(dict.restartConfirm)) {

            router.push('/mcp-guide?step=1', { scroll: false } as Parameters<typeof router.push>[1]);
          }
        } else {

          router.push('/mcp-guide?step=1', { scroll: false } as Parameters<typeof router.push>[1]);
        }

        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {

        e.preventDefault();
        handleNavigation(e.key === 'ArrowRight' ? 'next' : 'back');
        return;
      }

      const num = parseInt(e.key, 10);

      if (!isNaN(num) && num >= 1 && num <= 4) {

        if (step === 1) {

          const clients: McpClient[] = ['claude-code', 'zed', 'vscode', 'codex'];

          if (clients[num - 1]) {

            handleSelectClient(clients[num - 1]);
          }
        } else if (step === 2) {

          if (num === 1) {

            handleSelectScope('user');
          } else if (num === 2) {

            handleSelectScope('workspace');
          }
        }
      }
    }

    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);
  });

  function handleSelectClient(c: McpClient) {

    const skipScope = !CLIENTS_WITH_SCOPE.includes(c);

    if (skipScope) {

      navigate({ step: 3, client: c, scope: 'user' });
    } else {

      navigate({ step: 2, client: c });
    }
  }

  function handleSelectScope(s: McpScope) {

    navigate({ step: 3, scope: s });
  }

  function handleNavigation(direction: 'next' | 'back') {

    if (direction === 'next') {

      if (step < TOTAL_STEPS) {

        navigate({ step: step + 1 });
      }
    } else {

      if (step <= 1) {

        return;
      }

      if (step === 3 && client && !CLIENTS_WITH_SCOPE.includes(client)) {

        navigate({ step: 1 });
      } else {

        navigate({ step: step - 1 });
      }
    }
  }

  function handleRestart() {

    router.push('/mcp-guide?step=1', { scroll: false } as Parameters<typeof router.push>[1]);
  }

  const stepSkipped = client !== null && !CLIENTS_WITH_SCOPE.includes(client);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">

      {/* Progress */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => {

            const isSkipped = s === 2 && stepSkipped;
            const isActive = s === step;
            const isDone = s < step && !(isSkipped);

            return (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : isDone
                        ? 'bg-indigo-900 text-indigo-300 border border-indigo-700'
                        : isSkipped
                          ? 'bg-gray-800 text-gray-500 border border-gray-700 line-through'
                          : 'bg-gray-800 text-gray-500 border border-gray-700'
                  }`}
                >
                  {isDone ? '✓' : s}
                </div>
                {s < TOTAL_STEPS && (
                  <div className={`w-6 h-0.5 ${s < step ? 'bg-indigo-700' : 'bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>
        <span className="text-sm text-gray-500">{dict.progress(step, TOTAL_STEPS)}</span>
      </div>

      {stepSkipped && step > 2 && (
        <div className="mb-4 text-xs text-gray-500 italic">{dict.stepSkippedBadge}</div>
      )}

      {/* Step content */}
      <div className="min-h-64">
        {step === 1 && (
          <Step1ClientChoice
            selected={client}
            onSelect={handleSelectClient}
          />
        )}
        {step === 2 && client && CLIENTS_WITH_SCOPE.includes(client) && (
          <Step2Scope
            client={client}
            selected={scope}
            onSelect={handleSelectScope}
          />
        )}
        {step === 3 && (
          <Step3Connection
            url={url}
            token={token}
            transport={transport}
            onUrlChange={(v) => navigate({ step, url: v })}
            onTokenChange={(v) => navigate({ step, token: v })}
            onTransportChange={(v) => navigate({ step, transport: v })}
          />
        )}
        {step === 4 && client && (
          <Step4Snippet
            client={client}
            scope={scope}
            transport={transport}
            url={url}
            token={token}
          />
        )}
        {step === 5 && client && (
          <Step5Verify
            client={client}
            onRestart={handleRestart}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-gray-800 pt-6">
        <div className="flex gap-3">
          {step > 1 && step < 5 && (
            <button
              onClick={() => handleNavigation('back')}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-500"
            >
              {dict.back}
            </button>
          )}
          {step === 1 && (
            <a
              href="/mcp-guide/reference"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-500"
            >
              {dict.referenceLink}
            </a>
          )}
        </div>
        <div>
          {step < 4 && step !== 1 && step !== 2 && (
            <button
              onClick={() => handleNavigation('next')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {dict.next}
            </button>
          )}
          {step === 4 && (
            <button
              onClick={() => handleNavigation('next')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {dict.next}
            </button>
          )}
        </div>
      </div>

      {/* Keyboard hint */}
      <p className="mt-6 text-center text-xs text-gray-600">{dict.keyboardHint}</p>
    </div>
  );
}
