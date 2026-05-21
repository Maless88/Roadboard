'use client';

import { useState, useEffect, useRef } from 'react';
import type { McpTransport } from '@/lib/mcp/snippet-generator';
import { useDict } from '@/lib/i18n/locale-context';


interface Props {
  url: string;
  token: string;
  transport: McpTransport;
  onUrlChange: (v: string) => void;
  onTokenChange: (v: string) => void;
  onTransportChange: (v: McpTransport) => void;
}


function validateUrl(url: string): {
  errorScheme: boolean;
  warnPort: boolean;
  warnPath: boolean;
  valid: boolean;
} {

  if (!url) {

    return { errorScheme: false, warnPort: false, warnPath: false, valid: false };
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {

    return { errorScheme: true, warnPort: false, warnPath: false, valid: false };
  }

  const warnPort = !url.includes(':3005');
  const warnPath = !url.endsWith('/mcp');

  return { errorScheme: false, warnPort, warnPath, valid: true };
}


const COMMIT_DELAY_MS = 400;


function useDebouncedCommit(value: string, commit: (v: string) => void, delay: number) {

  const commitRef = useRef(commit);
  commitRef.current = commit;

  const lastCommittedRef = useRef(value);

  useEffect(() => {

    if (value === lastCommittedRef.current) {

      return;
    }

    const handle = window.setTimeout(() => {

      lastCommittedRef.current = value;
      commitRef.current(value);
    }, delay);

    return () => window.clearTimeout(handle);
  }, [value, delay]);

  return lastCommittedRef;
}


type TokenCheckState = 'idle' | 'checking' | 'valid' | 'invalid';
type TokenGenState = 'idle' | 'generating' | 'done' | 'error';


export function Step3Connection({
  url,
  token,
  transport,
  onUrlChange,
  onTokenChange,
  onTransportChange,
}: Props) {

  const dict = useDict().mcp.wizard;

  const [localUrl, setLocalUrl] = useState(url);
  const [localToken, setLocalToken] = useState(token);
  const [debouncedUrl, setDebouncedUrl] = useState(url);
  const [urlTouched, setUrlTouched] = useState(false);
  const [tokenCheckState, setTokenCheckState] = useState<TokenCheckState>('idle');
  const [tokenCheckError, setTokenCheckError] = useState<string | null>(null);
  const [tokenGenState, setTokenGenState] = useState<TokenGenState>('idle');
  const [tokenGenError, setTokenGenError] = useState<string | null>(null);

  const urlCommittedRef = useDebouncedCommit(localUrl, onUrlChange, COMMIT_DELAY_MS);
  useDebouncedCommit(localToken, onTokenChange, COMMIT_DELAY_MS);

  // Sync from parent only when it diverges from what we last committed
  useEffect(() => {

    if (url !== urlCommittedRef.current && url !== localUrl) {

      setLocalUrl(url);
      urlCommittedRef.current = url;
    }
  }, [url, localUrl, urlCommittedRef]);

  useEffect(() => {

    const handle = window.setTimeout(() => setDebouncedUrl(localUrl), COMMIT_DELAY_MS);

    return () => window.clearTimeout(handle);
  }, [localUrl]);

  // Reset token check when token changes
  useEffect(() => {

    setTokenCheckState('idle');
    setTokenCheckError(null);
  }, [localToken]);

  const validation = validateUrl(debouncedUrl);

  function handleFixPath() {

    if (!localUrl.endsWith('/mcp')) {

      const fixed = localUrl.replace(/\/?$/, '/mcp');
      setLocalUrl(fixed);
      setDebouncedUrl(fixed);
      onUrlChange(fixed);
      urlCommittedRef.current = fixed;
    }
  }

  function commitUrlNow() {

    if (localUrl !== urlCommittedRef.current) {

      urlCommittedRef.current = localUrl;
      onUrlChange(localUrl);
    }

    setDebouncedUrl(localUrl);
  }

  async function handleGenerateToken() {

    setTokenGenState('generating');
    setTokenGenError(null);

    try {

      const res = await fetch('/api/mcp/token-generate', { method: 'POST' });
      const data = (await res.json()) as { token?: string; error?: string; expiresAt?: string | null };

      if (!res.ok || !data.token) {

        setTokenGenState('error');
        setTokenGenError(data.error ?? 'Generation failed');

        return;
      }

      setLocalToken(data.token);
      onTokenChange(data.token);
      setTokenGenState('done');
      setTokenCheckState('valid');
    } catch (e) {

      setTokenGenState('error');
      setTokenGenError(e instanceof Error ? e.message : 'Network error');
    }
  }

  async function handleCheckToken() {

    if (!localToken) return;

    setTokenCheckState('checking');
    setTokenCheckError(null);

    try {

      const res = await fetch('/api/mcp/token-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: localToken }),
      });
      const data = (await res.json()) as { valid?: boolean; error?: string };

      if (data.valid) {

        setTokenCheckState('valid');
      } else {

        setTokenCheckState('invalid');
        setTokenCheckError(data.error ?? 'Invalid token');
      }
    } catch (e) {

      setTokenCheckState('invalid');
      setTokenCheckError(e instanceof Error ? e.message : 'Network error');
    }
  }

  const d = dict.step3;

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">{d.title}</h2>

      {/* Callout */}
      <div className="border border-gray-600 rounded-lg p-5 mb-6 bg-gray-900 font-mono text-sm">
        <p className="text-gray-300 mb-3">ℹ️ {d.calloutTitle}</p>
        <p className="text-green-400 text-base mb-1">{d.calloutExample}</p>
        <p className="text-gray-500 text-xs">{d.calloutNote}</p>
      </div>

      {/* URL field */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {d.urlLabel}
        </label>
        <input
          type="text"
          value={localUrl}
          onChange={(e) => {
            setUrlTouched(true);
            setLocalUrl(e.target.value);
          }}
          onBlur={commitUrlNow}
          placeholder={d.urlPlaceholder}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-green-300 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          aria-label={d.urlLabel}
        />

        {urlTouched && debouncedUrl && (
          <div className="mt-2 space-y-1 text-sm">
            {validation.errorScheme && (
              <p className="text-red-400">⛔ {d.urlErrorScheme}</p>
            )}
            {!validation.errorScheme && validation.warnPort && (
              <p className="text-yellow-400">⚠️ {d.urlWarnPort}</p>
            )}
            {!validation.errorScheme && validation.warnPath && (
              <span className="flex items-center gap-2">
                <span className="text-orange-400">⚠️ {d.urlWarnPath}</span>
                <button
                  onClick={handleFixPath}
                  className="text-xs bg-orange-900/40 border border-orange-700/50 text-orange-300 rounded px-2 py-0.5 hover:bg-orange-900/60 transition-colors"
                >
                  {d.urlFixPath}
                </button>
              </span>
            )}
            {!validation.errorScheme && !validation.warnPort && !validation.warnPath && (
              <p className="text-green-400">{d.urlOkPort} · {d.urlOkPath}</p>
            )}
            {!validation.errorScheme && !validation.warnPort && validation.warnPath && (
              <p className="text-green-400">{d.urlOkPort}</p>
            )}
            {!validation.errorScheme && validation.warnPort && !validation.warnPath && (
              <p className="text-green-400">{d.urlOkPath}</p>
            )}
          </div>
        )}
      </div>

      {/* Token field */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-300">
            {d.tokenLabel}
          </label>
          <button
            onClick={handleGenerateToken}
            disabled={tokenGenState === 'generating'}
            className="text-xs bg-indigo-900/50 border border-indigo-700/60 text-indigo-300 rounded px-3 py-1 hover:bg-indigo-900/80 hover:text-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tokenGenState === 'generating' ? d.tokenGenerating : d.tokenGenerateButton}
          </button>
        </div>
        <div className="relative">
          <input
            type="password"
            value={localToken}
            onChange={(e) => setLocalToken(e.target.value)}
            onBlur={() => onTokenChange(localToken)}
            placeholder={d.tokenPlaceholder}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-300 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-24"
            aria-label={d.tokenLabel}
          />
          {localToken && tokenCheckState !== 'valid' && (
            <button
              onClick={handleCheckToken}
              disabled={tokenCheckState === 'checking'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-gray-800 border border-gray-600 text-gray-300 rounded px-2.5 py-1 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
            >
              {tokenCheckState === 'checking' ? d.tokenChecking : d.tokenCheckButton}
            </button>
          )}
        </div>

        {/* Token status feedback */}
        {tokenGenState === 'done' && (
          <p className="mt-1.5 text-xs text-green-400">✓ {d.tokenGenerated}</p>
        )}
        {tokenGenState === 'error' && tokenGenError && (
          <p className="mt-1.5 text-xs text-red-400">⛔ {tokenGenError}</p>
        )}
        {tokenCheckState === 'valid' && tokenGenState !== 'done' && (
          <p className="mt-1.5 text-xs text-green-400">✓ {d.tokenValid}</p>
        )}
        {tokenCheckState === 'invalid' && (
          <p className="mt-1.5 text-xs text-red-400">⛔ {d.tokenInvalid}{tokenCheckError ? `: ${tokenCheckError}` : ''}</p>
        )}

        {tokenGenState === 'idle' && tokenCheckState === 'idle' && (
          <p className="mt-1.5 text-xs text-gray-500">
            {d.tokenHint}{' '}
            <a href="/settings" className="text-indigo-400 hover:text-indigo-300 underline">
              {d.tokenHintLink}
            </a>
          </p>
        )}
      </div>

      {/* Transport */}
      <div>
        <p className="block text-sm font-medium text-gray-300 mb-2">{d.transportLabel}</p>
        <div className="flex gap-4">
          {(['http', 'stdio'] as McpTransport[]).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="transport"
                value={t}
                checked={transport === t}
                onChange={() => onTransportChange(t)}
                className="text-indigo-500"
              />
              <span className="text-sm text-gray-300">
                {t === 'http' ? d.transportHttp : d.transportStdio}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
