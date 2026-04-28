import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { LoginForm } from './login-form';


interface Props {
  searchParams: Promise<{ invite?: string; email?: string }>;
}


export default async function LoginPage({ searchParams }: Props) {

  const { invite, email } = await searchParams;
  const token = await getToken();

  if (token) {
    redirect(invite ? `/invite/${invite}` : '/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>RoadBoard</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Sign in to continue</p>
        </div>
        <LoginForm inviteToken={invite ?? null} prefilledEmail={email ?? null} />
      </div>
    </div>
  );
}
