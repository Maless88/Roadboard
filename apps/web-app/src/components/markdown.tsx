'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


interface MarkdownProps {
  children: string;
  className?: string;
}


export function Markdown({ children, className }: MarkdownProps) {

  return (
    <div className={`rb-markdown ${className ?? ''}`.trim()}>
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
