import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider, THEME_INIT_SCRIPT } from '@/lib/theme-context';


export const metadata: Metadata = {
  title: 'RoadBoard 2.0',
  description: 'Multi-project execution platform',
};


export default function RootLayout({ children }: { children: React.ReactNode }) {

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="min-h-screen antialiased"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
