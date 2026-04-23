'use server';

import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import {
  login, logout, register, updateTaskStatus,
  createTask, createPhase, createDecision, createMemoryEntry, createProject, deleteProject,
} from '@/lib/api';
import { setToken, clearToken, getToken } from '@/lib/auth';
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n';


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

  redirect('/dashboard');
}


export async function registerAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {

  const username = formData.get('username') as string;
  const displayName = formData.get('displayName') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  const seedDemoProject = formData.get('seedDemoProject') === 'on';

  const cookieStore = await cookies();
  const demoLocale: 'it' | 'en' = cookieStore.get(LOCALE_COOKIE)?.value === 'en' ? 'en' : 'it';

  if (password !== confirmPassword) {
    return { error: 'Le password non coincidono.' };
  }

  try {
    const { token } = await register({ username, displayName, email, password, seedDemoProject, demoLocale });
    await setToken(token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Registrazione fallita.';
    return { error: msg };
  }

  redirect('/dashboard');
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


export async function createTaskAction(
  projectId: string,
  data: { title: string; phaseId: string; priority?: string; description?: string },
): Promise<{ error?: string }> {

  const token = await getToken();

  if (!token) {
    return { error: 'Not authenticated' };
  }

  try {
    await createTask(token, { projectId, ...data });
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath(`/projects/${projectId}`);
  return {};
}


export async function createPhaseAction(
  projectId: string,
  data: { title: string; description?: string; decisionId?: string },
): Promise<{ error?: string }> {

  const token = await getToken();

  if (!token) {
    return { error: 'Not authenticated' };
  }

  try {
    await createPhase(token, { projectId, ...data });
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath(`/projects/${projectId}`);
  return {};
}


export async function createDecisionAction(
  projectId: string,
  data: { title: string; summary: string; rationale?: string; outcome?: string; status?: string; impactLevel?: string },
): Promise<{ error?: string }> {

  const token = await getToken();

  if (!token) {
    return { error: 'Not authenticated' };
  }

  try {
    await createDecision(token, { projectId, ...data });
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath(`/projects/${projectId}`);
  return {};
}


export async function createMemoryEntryAction(
  projectId: string,
  data: { title: string; type: string; body?: string },
): Promise<{ error?: string }> {

  const token = await getToken();

  if (!token) {
    return { error: 'Not authenticated' };
  }

  try {
    await createMemoryEntry(token, { projectId, ...data });
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath(`/projects/${projectId}`);
  return {};
}


export async function createProjectAction(
  data: { name: string; slug: string; description?: string; ownerTeamId: string },
): Promise<{ error?: string; id?: string }> {

  const token = await getToken();

  if (!token) {
    return { error: 'Not authenticated' };
  }

  let project;

  try {
    project = await createProject(token, { ...data, status: 'draft' });
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath('/projects');
  revalidatePath('/dashboard');
  return { id: project.id };
}


export async function setLocaleAction(locale: Locale): Promise<void> {

  if (!SUPPORTED_LOCALES.includes(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  revalidateTag('locale');
}


export async function deleteProjectAction(projectId: string): Promise<{ error?: string }> {

  const token = await getToken();

  if (!token) {
    return { error: 'Not authenticated' };
  }

  try {
    await deleteProject(token, projectId);
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/projects');
  redirect('/dashboard');
}
