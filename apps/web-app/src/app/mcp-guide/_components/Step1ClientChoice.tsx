'use client';

import type { McpClient } from '@/lib/mcp/snippet-generator';
import { useDict } from '@/lib/i18n/locale-context';


interface Props {
  selected: McpClient | null;
  onSelect: (client: McpClient) => void;
}


const CLIENTS: { id: McpClient; icon: string; key: number }[] = [
  { id: 'claude-code', icon: '⚡', key: 1 },
  { id: 'zed', icon: '🔷', key: 2 },
  { id: 'vscode', icon: '🟣', key: 3 },
  { id: 'codex', icon: '✏️', key: 4 },
];


export function Step1ClientChoice({ selected, onSelect }: Props) {

  const dict = useDict().mcp.wizard;

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">{dict.step1.title}</h2>

      <div className="grid gap-3 mb-8">
        {CLIENTS.map((c) => {

          const labelMap: Record<McpClient, string> = {
            'claude-code': dict.step1.claudeCode,
            zed: dict.step1.zed,
            vscode: dict.step1.vscode,
            codex: dict.step1.codex,
          };
          const subMap: Record<McpClient, string> = {
            'claude-code': dict.step1.claudeCodeSub,
            zed: dict.step1.zedSub,
            vscode: dict.step1.vscodeSub,
            codex: dict.step1.codexSub,
          };
          const label = labelMap[c.id];
          const sub = subMap[c.id];
          const isSelected = selected === c.id;

          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`flex items-center gap-4 w-full text-left rounded-lg border px-5 py-4 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-950/50 text-white'
                  : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
              }`}
              aria-pressed={isSelected}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded border border-gray-600 bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                {c.key}
              </span>
              <span className="text-lg flex-shrink-0">{c.icon}</span>
              <span className="flex-1">
                <span className="font-medium">{label}</span>
                <span className="ml-2 text-sm text-gray-400">{sub}</span>
              </span>
              {isSelected && (
                <span className="text-indigo-400 flex-shrink-0">●</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-gray-500 text-center">💡 {dict.multiClientHint}</p>
    </div>
  );
}
