'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import type { ChatbotConfigView, ChatbotProvider } from '@/lib/api';
import { useDict } from '@/lib/i18n/locale-context';
import {
  saveChatbotConfigAction,
  deleteChatbotConfigAction,
  testChatbotConfigAction,
  type ChatbotConfigActionState,
} from './actions';


const PROVIDER_DEFAULT_MODEL: Record<ChatbotProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5-20250929',
  ollama: 'llama3.2',
};


function Card({ title, children }: { title?: string; children: React.ReactNode }) {

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}>
      {title && <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>}
      {children}
    </div>
  );
}


function Alert({ type, msg }: { type: 'error' | 'success'; msg: string }) {

  const base = 'rounded-lg px-4 py-3 text-sm';
  const cls = type === 'error' ? `${base} text-red-400` : `${base} text-green-400`;
  const style = type === 'error'
    ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }
    : { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' };

  return <div className={cls} style={style}>{msg}</div>;
}


export function AiAssistantTab({ initialConfig }: { initialConfig: ChatbotConfigView | null }) {

  const dict = useDict();
  const t = dict.settingsAiAssistant;
  const [config, setConfig] = useState<ChatbotConfigView | null>(initialConfig);
  const [provider, setProvider] = useState<ChatbotProvider>(initialConfig?.provider ?? 'openai');
  const [model, setModel] = useState<string>(initialConfig?.modelName ?? PROVIDER_DEFAULT_MODEL.openai);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>(initialConfig?.ollamaBaseUrl ?? '');
  const [apiKey, setApiKey] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(initialConfig?.isActive ?? true);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [isTesting, startTest] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [state, action, pending] = useActionState<ChatbotConfigActionState, FormData>(saveChatbotConfigAction, {});
  const formRef = useRef<HTMLFormElement>(null);


  useEffect(() => {

    if (state.saved) {
      setConfig(state.saved);
      setApiKey('');
    }
  }, [state.saved]);


  function handleProviderChange(next: ChatbotProvider) {

    setProvider(next);

    // Only reset model if it was the previous default — preserve user-typed values.
    if (model === PROVIDER_DEFAULT_MODEL[provider] || !model) {
      setModel(PROVIDER_DEFAULT_MODEL[next]);
    }

    setTestResult(null);
  }


  async function handleTest() {

    setTestResult(null);

    startTest(async () => {

      const res = await testChatbotConfigAction();
      setTestResult(res);
    });
  }


  function handleDelete() {

    if (!confirm(t.confirmDelete)) return;

    startDelete(async () => {

      await deleteChatbotConfigAction();
      setConfig(null);
      setApiKey('');
      setTestResult(null);
      formRef.current?.reset();
    });
  }


  const hasStoredKey = config?.hasApiKey ?? false;
  const requiresKey = provider !== 'ollama';
  const requiresBaseUrl = provider === 'ollama';
  const modelHelp =
    provider === 'openai' ? t.modelHelpOpenai
    : provider === 'anthropic' ? t.modelHelpAnthropic
    : t.modelHelpOllama;

  return (
    <div className="space-y-5">

      <Card title={t.title}>
        <p className="text-xs text-gray-400 mb-4">{t.description}</p>

        <form ref={formRef} action={action} className="space-y-4 max-w-xl">

          {state.error && <Alert type="error" msg={state.error} />}
          {state.success && <Alert type="success" msg={t.saved} />}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t.provider}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['openai', 'anthropic', 'ollama'] as const).map((p) => {

                const selected = provider === p;
                const label = p === 'openai' ? t.providerOpenai : p === 'anthropic' ? t.providerAnthropic : t.providerOllama;

                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleProviderChange(p)}
                    className="rounded-lg px-3 py-2 text-sm transition-all"
                    style={{
                      background: selected ? 'rgba(99,102,241,0.1)' : 'var(--surface-overlay)',
                      border: `1px solid ${selected ? 'rgba(99,102,241,0.5)' : 'var(--border-soft)'}`,
                      color: selected ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="provider" value={provider} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t.model}</label>
            <input
              name="modelName"
              type="text"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            />
            <p className="mt-1 text-xs text-gray-500">{modelHelp}</p>
          </div>

          {requiresKey && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t.apiKey}</label>
              <input
                name="apiKey"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t.apiKeyPlaceholder}
                className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              />
              {hasStoredKey && (
                <p className="mt-1 text-xs text-gray-500">{t.apiKeyExisting}</p>
              )}
            </div>
          )}

          {requiresBaseUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t.ollamaBaseUrl}</label>
              <input
                name="ollamaBaseUrl"
                type="text"
                required
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                placeholder={t.ollamaBaseUrlPlaceholder}
                className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-white/20 bg-black/30"
            />
            <span>{t.isActive}</span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {pending ? t.saving : t.save}
            </button>

            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !config}
              className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)' }}
            >
              {isTesting ? t.testing : t.test}
            </button>

            {config && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                {t.deleteConfig}
              </button>
            )}
          </div>

          {testResult && (
            testResult.ok
              ? <Alert type="success" msg={t.testOk} />
              : <Alert type="error" msg={t.testFail(testResult.error ?? '')} />
          )}
        </form>
      </Card>

      <Card>
        <p className="text-xs text-gray-500 leading-relaxed">{t.capabilitiesNote}</p>
      </Card>
    </div>
  );
}
