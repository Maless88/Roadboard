import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { ThemeProvider, THEME_INIT_SCRIPT, THEME_COOKIE } from '@/lib/theme-context';


export const metadata: Metadata = {
  title: 'RoadBoard 2.0',
  description: 'Multi-project execution platform',
};


export default async function RootLayout({ children }: { children: React.ReactNode }) {

  const cookieStore = await cookies();
  const initialTheme = cookieStore.get(THEME_COOKIE)?.value === 'light' ? 'light' : 'dark';

  return (
    <html lang="en" className={initialTheme === 'light' ? 'light' : undefined}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="min-h-screen antialiased"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
