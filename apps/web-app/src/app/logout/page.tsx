import { redirect } from 'next/navigation';
import { logout } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';


interface Props {
  searchParams: Promise<{ next?: string }>;
}


export default async function LogoutPage({ searchParams }: Props) {

  const { next } = await searchParams;
  const token = await getToken();

  if (token) {
    await logout(token).catch(() => null);
  }

  await clearToken();

  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const inviteMatch = safeNext?.match(/^\/invite\/([A-Za-z0-9_-]+)$/);

  if (inviteMatch) {
    redirect(`/login?invite=${encodeURIComponent(inviteMatch[1])}`);
  }

  redirect('/login');
}
