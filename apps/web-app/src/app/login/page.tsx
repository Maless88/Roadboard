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
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/roadboard-banner.png" alt="RoadBoard" className="mx-auto w-56 rounded-2xl" />
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Sign in to continue</p>
        </div>
        <LoginForm inviteToken={invite ?? null} prefilledEmail={email ?? null} />
      </div>
    </div>
  );
}
