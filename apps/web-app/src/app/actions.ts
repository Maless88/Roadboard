'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  login, logout, updateTaskStatus,
  createTask, createPhase, createDecision, createMilestone, createMemoryEntry, createProject,
} from '@/lib/api';
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


export async function createTaskAction(
  projectId: string,
  data: { title: string; phaseId?: string; priority?: string; description?: string },
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
  data: { title: string; description?: string },
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
  data: { title: string; summary: string; rationale?: string; status?: string; impactLevel?: string },
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


export async function createMilestoneAction(
  projectId: string,
  data: { title: string; phaseId?: string; description?: string; dueDate?: string },
): Promise<{ error?: string }> {

  const token = await getToken();

  if (!token) {
    return { error: 'Not authenticated' };
  }

  try {
    await createMilestone(token, { projectId, ...data });
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
  return { id: project.id };
}
