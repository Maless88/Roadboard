'use server';

import { revalidatePath } from 'next/cache';
import { getToken } from '@/lib/auth';
import {
  assignNodeToDomainGroup,
  createArchitectureLink,
  createDomainGroup,
  deleteArchitectureLink,
  deleteDomainGroup,
  listDecisions,
  listMemory,
  listTasks,
  updateDomainGroup,
} from '@/lib/api';


export interface EntityOption {
  id: string;
  title: string;
}


export async function listEntityOptionsAction(
  projectId: string,
  entityType: string,
): Promise<{ items?: EntityOption[]; error?: string }> {

  const token = await getToken();

  if (!token) return { error: 'unauthorized' };

  try {
    let items: EntityOption[] = [];

    if (entityType === 'task') {
      const tasks = await listTasks(token, projectId);
      items = tasks.map((t) => ({ id: t.id, title: t.title }));
    } else if (entityType === 'decision') {
      const decisions = await listDecisions(token, projectId);
      items = decisions.map((d) => ({ id: d.id, title: d.title }));
    } else if (entityType === 'memory_entry') {
      const entries = await listMemory(token, projectId);
      items = entries.map((m) => ({ id: m.id, title: m.title }));
    }

    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unknown' };
  }
}


interface ActionResult {
  error?: string;
  ok?: boolean;
}


export async function createNodeLinkAction(
  projectId: string,
  nodeId: string,
  data: { entityType: string; entityId: string; linkType: string; note?: string },
): Promise<ActionResult> {

  const token = await getToken();

  if (!token) return { error: 'unauthorized' };

  try {
    await createArchitectureLink(token, projectId, nodeId, data);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unknown' };
  }
}


export async function deleteNodeLinkAction(
  projectId: string,
  linkId: string,
): Promise<ActionResult> {

  const token = await getToken();

  if (!token) return { error: 'unauthorized' };

  try {
    await deleteArchitectureLink(token, projectId, linkId);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unknown' };
  }
}


export async function createDomainGroupAction(
  projectId: string,
  data: { name: string; color?: string },
): Promise<ActionResult> {

  const token = await getToken();

  if (!token) return { error: 'unauthorized' };

  try {
    await createDomainGroup(token, projectId, data);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unknown' };
  }
}


export async function updateDomainGroupAction(
  projectId: string,
  groupId: string,
  data: { name?: string; color?: string },
): Promise<ActionResult> {

  const token = await getToken();

  if (!token) return { error: 'unauthorized' };

  try {
    await updateDomainGroup(token, projectId, groupId, data);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unknown' };
  }
}


export async function deleteDomainGroupAction(
  projectId: string,
  groupId: string,
): Promise<ActionResult> {

  const token = await getToken();

  if (!token) return { error: 'unauthorized' };

  try {
    await deleteDomainGroup(token, projectId, groupId);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unknown' };
  }
}


export async function assignNodeToDomainGroupAction(
  projectId: string,
  nodeId: string,
  domainGroupId: string | null,
): Promise<ActionResult> {

  const token = await getToken();

  if (!token) return { error: 'unauthorized' };

  try {
    await assignNodeToDomainGroup(token, projectId, nodeId, domainGroupId);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unknown' };
  }
}
