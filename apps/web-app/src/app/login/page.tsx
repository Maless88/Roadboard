import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { LoginForm } from './login-form';


export default async function LoginPage() {

  const token = await getToken();

  if (token) {
    redirect('/projects');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">RoadBoard</h1>
          <p className="mt-1 text-sm text-gray-400">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
