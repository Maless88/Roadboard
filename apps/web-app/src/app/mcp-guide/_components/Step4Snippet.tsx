'use client';

import { useState } from 'react';
import { generateSnippet } from '@/lib/mcp/snippet-generator';
import type { McpClient, McpScope, McpTransport } from '@/lib/mcp/snippet-generator';
import { useDict } from '@/lib/i18n/locale-context';


interface Props {
  client: McpClient;
  scope: McpScope;
  transport: McpTransport;
  url: string;
  token: string;
}


export function Step4Snippet({ client, scope, transport, url, token }: Props) {

  const dict = useDict().mcp.wizard;
  const [copied, setCopied] = useState(false);

  const snippet = generateSnippet({ client, scope, transport, url, token });

  const d = dict.step4;

  async function handleCopy() {

    try {

      await navigator.clipboard.writeText(snippet.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select all text
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-2">{d.title}</h2>
      <p className="text-gray-400 text-sm mb-6">{d.copyIn(snippet.filePath)}</p>

      <div className="relative">
        <pre className={`bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre ${snippet.format === 'toml' ? 'text-orange-300' : 'text-green-300'}`}>
          {snippet.content}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 text-xs bg-gray-800 border border-gray-600 text-gray-300 rounded px-2.5 py-1 hover:bg-gray-700 hover:text-white transition-colors"
          aria-label="Copy snippet"
        >
          {copied ? d.copiedButton : d.copyButton}
        </button>
      </div>

      {client === 'codex' && (
        <div className="mt-4 bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3 text-xs text-yellow-300 font-mono">
          {d.codexEnvNote(token || '<your-token>')}
        </div>
      )}

      <div className="mt-4 bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3 text-xs text-gray-400">
        ⚠️ {d.mergeWarning}
      </div>
    </div>
  );
}
