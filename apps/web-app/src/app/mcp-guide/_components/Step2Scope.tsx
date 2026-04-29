'use client';

import type { McpClient, McpScope } from '@/lib/mcp/snippet-generator';
import { useDict } from '@/lib/i18n/locale-context';


interface Props {
  client: McpClient;
  selected: McpScope | null;
  onSelect: (scope: McpScope) => void;
}


const USER_FILE: Record<McpClient, string> = {
  'claude-code': '~/.claude.json',
  vscode: '~/.config/Code/User/mcp.json',
  zed: '~/.config/zed/settings.json',
  codex: '~/.codex/config.toml',
};


const WORKSPACE_FILE: Record<McpClient, string> = {
  'claude-code': '.mcp.json',
  vscode: '.vscode/mcp.json',
  zed: '~/.config/zed/settings.json',
  codex: '~/.codex/config.toml',
};


const CLIENT_LABELS: Record<McpClient, string> = {
  'claude-code': 'Claude Code',
  zed: 'Zed',
  vscode: 'VS Code',
  codex: 'Codex',
};


const SCOPES: { id: McpScope; key: number }[] = [
  { id: 'user', key: 1 },
  { id: 'workspace', key: 2 },
];


export function Step2Scope({ client, selected, onSelect }: Props) {

  const dict = useDict().mcp.wizard;

  const clientLabel = CLIENT_LABELS[client];

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">
        {dict.step2.title(clientLabel)}
      </h2>

      <div className="grid gap-3 mb-8">
        {SCOPES.map((s) => {

          const isUser = s.id === 'user';
          const label = isUser ? dict.step2.userScope : dict.step2.workspaceScope;
          const file = isUser ? USER_FILE[client] : WORKSPACE_FILE[client];
          const desc = isUser ? dict.step2.userScopeDesc(file) : dict.step2.workspaceScopeDesc(file);
          const isSelected = selected === s.id;
          const icon = isUser ? '👤' : '📁';

          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`flex items-start gap-4 w-full text-left rounded-lg border px-5 py-4 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-950/50 text-white'
                  : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
              }`}
              aria-pressed={isSelected}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded border border-gray-600 bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 mt-0.5">
                {s.key}
              </span>
              <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
              <span className="flex-1">
                <span className="font-medium block">{label}</span>
                <span className="text-sm text-gray-400 mt-0.5 block">{desc}</span>
              </span>
              {isSelected && (
                <span className="text-indigo-400 flex-shrink-0 mt-0.5">●</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
