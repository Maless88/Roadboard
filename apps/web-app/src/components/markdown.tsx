'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


interface MarkdownProps {
  children: string;
  className?: string;
}


/**
 * Renders Markdown only after client hydration. The first paint is plain
 * pre-wrapped text — cheap on the server even when there are hundreds of
 * memory bodies / task descriptions on a single page. ReactMarkdown then
 * upgrades the output once the component mounts.
 *
 * Without this gate the project page (memory tab, task list, decision
 * accordion) was rendering 200+ markdown trees server-side per request,
 * adding hundreds of milliseconds to every tab navigation.
 */
export function Markdown({ children, className }: MarkdownProps) {

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const cls = `rb-markdown ${className ?? ''}`.trim();

  if (!hydrated) {
    return (
      <div className={cls} style={{ whiteSpace: 'pre-wrap' }} suppressHydrationWarning>
        {children}
      </div>
    );
  }

  return (
    <div className={cls}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
