'use client';

import { useState } from 'react';
import type { McpClient } from '@/lib/mcp/snippet-generator';
import { useDict } from '@/lib/i18n/locale-context';


interface Props {
  client: McpClient;
  onRestart: () => void;
}


export function Step5Verify({ client, onRestart }: Props) {

  const dict = useDict().mcp.wizard;
  const [copied, setCopied] = useState(false);
  const [openItems, setOpenItems] = useState<number[]>([]);

  const d = dict.step5;
  const clientData = d.clients[client];

  const testPrompt = d.testPrompt;

  async function handleCopy() {

    try {

      await navigator.clipboard.writeText(testPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function toggleItem(i: number) {

    setOpenItems((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-2">{d.title}</h2>
      <p className="text-gray-400 text-sm mb-6">{d.subtitle}</p>

      {/* Restart instructions */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 mb-6">
        <ol className="space-y-3 text-sm text-gray-300 list-decimal list-inside">
          <li>{clientData.restart}</li>
          <li>{clientData.check}</li>
          <li>Cerca "roadboard" tra i server — deve essere ✓ Connected</li>
        </ol>
      </div>

      {/* Test prompt */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-2">{d.testPromptLabel}</p>
        <div className="relative bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
          <p className="text-green-300 font-mono text-sm pr-16">{testPrompt}</p>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-3 text-xs bg-gray-800 border border-gray-600 text-gray-300 rounded px-2.5 py-1 hover:bg-gray-700 hover:text-white transition-colors"
            aria-label="Copy test prompt"
          >
            {copied ? d.copiedButton : d.copyButton}
          </button>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="mb-8">
        <p className="text-sm font-medium text-red-400 mb-3">{d.troubleshootingTitle}</p>
        <div className="space-y-2">
          {clientData.troubleshooting.map((item, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleItem(i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-800 transition-colors"
                aria-expanded={openItems.includes(i)}
              >
                <span className={`text-indigo-400 font-mono text-xs transition-transform ${openItems.includes(i) ? 'rotate-90' : ''}`}>
                  ▶
                </span>
                <span className="text-gray-300 font-medium">
                  {item.split(' → ')[0]}
                </span>
              </button>
              {openItems.includes(i) && (
                <div className="px-4 pb-3 pl-10 text-gray-400 text-sm">
                  {item.includes(' → ') ? item.split(' → ')[1] : item}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Restart button */}
      <div className="flex justify-center">
        <button
          onClick={onRestart}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-6 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {d.restartButton}
        </button>
      </div>
    </div>
  );
}
