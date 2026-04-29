'use client';

import { useState, useEffect } from 'react';
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

  if (!url.startsWith('http://') && !url.startsWith('https://')) {

    return { errorScheme: true, warnPort: false, warnPath: false, valid: false };
  }

  const warnPort = !url.includes(':3005');
  const warnPath = !url.endsWith('/mcp');

  return { errorScheme: false, warnPort, warnPath, valid: true };
}


export function Step3Connection({
  url,
  token,
  transport,
  onUrlChange,
  onTokenChange,
  onTransportChange,
}: Props) {

  const dict = useDict().mcp.wizard;
  const [urlTouched, setUrlTouched] = useState(false);

  const validation = validateUrl(url);

  useEffect(() => {

    if (url) {

      setUrlTouched(true);
    }
  }, [url]);

  function handleFixPath() {

    if (!url.endsWith('/mcp')) {

      onUrlChange(url.replace(/\/?$/, '/mcp'));
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
          value={url}
          onChange={(e) => {
            setUrlTouched(true);
            onUrlChange(e.target.value);
          }}
          placeholder={d.urlPlaceholder}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-green-300 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          aria-label={d.urlLabel}
        />

        {urlTouched && (
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
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {d.tokenLabel}
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
          placeholder={d.tokenPlaceholder}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-300 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          aria-label={d.tokenLabel}
        />
        <p className="mt-1.5 text-xs text-gray-500">
          {d.tokenHint}{' '}
          <a href="/settings" className="text-indigo-400 hover:text-indigo-300 underline">
            {d.tokenHintLink}
          </a>
        </p>
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
