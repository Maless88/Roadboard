'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { login, logout, updateTaskStatus } from '@/lib/api';
import { setToken, clearToken, getToken } from '@/lib/auth';


export async function loginAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {

  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  try {
    const { token } = await login(username, password);
    await setToken(token);
  } catch {
    return { error: 'Username o password non corretti.' };
  }

  redirect('/projects');
}


export async function logoutAction(): Promise<void> {

  const token = await getToken();

  if (token) {
    await logout(token).catch(() => null);
  }

  await clearToken();
  redirect('/login');
}


export async function updateTaskStatusAction(
  taskId: string,
  status: string,
  projectId: string,
): Promise<void> {

  const token = await getToken();

  if (!token) {
    redirect('/login');
  }

  await updateTaskStatus(token, taskId, status);
  revalidatePath(`/projects/${projectId}`);
}
