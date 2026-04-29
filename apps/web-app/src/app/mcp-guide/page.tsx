import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getDict } from '@/lib/i18n';
import { Wizard } from './_components/Wizard';


export async function generateMetadata(): Promise<Metadata> {

  const dict = await getDict();

  return {
    title: dict.mcp.wizard.metaTitle,
    description: dict.mcp.wizard.metaDescription,
  };
}


export default async function McpGuidePage() {

  const dict = await getDict();
  const wDict = dict.mcp.wizard;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Header */}
      <header className="backdrop-blur sticky top-0 z-10" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-strong)' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/projects"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              {wDict.headerBack}
            </a>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>
              {wDict.headerTitle}
            </span>
          </div>
          <a
            href="/mcp-guide/reference"
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            {wDict.referenceLink}
          </a>
        </div>
      </header>

      <Suspense fallback={<div className="max-w-2xl mx-auto px-6 py-12 text-gray-500 text-sm">Loading…</div>}>
        <Wizard />
      </Suspense>
    </div>
  );
}
