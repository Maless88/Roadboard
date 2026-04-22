'use server';

import { revalidatePath } from 'next/cache';
import { getToken } from '@/lib/auth';
import { createArchitectureLink, deleteArchitectureLink } from '@/lib/api';


interface LinkActionResult {
  error?: string;
  ok?: boolean;
}


export async function createNodeLinkAction(
  projectId: string,
  nodeId: string,
  data: { entityType: string; entityId: string; linkType: string; note?: string },
): Promise<LinkActionResult> {

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
): Promise<LinkActionResult> {

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
