'use server';

import { revalidatePath } from 'next/cache';
import { getToken } from '@/lib/auth';
import {
  changePassword,
  createToken,
  revokeToken,
  createUser,
  deleteUser,
  resetUserPassword,
  createGrant,
  deleteGrant,
  listGrants,
  validateSession,
  createTeam,
  deleteTeam,
  createMembership,
  deleteMembership,
  listUsers,
  listMyMemberships,
  getProject,
  recordContributorEvent,
} from '@/lib/api';


export async function changePasswordAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  const session = await validateSession(token);

  if (!session) return { error: 'Sessione non valida' };

  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (newPassword !== confirmPassword) {
    return { error: 'Le nuove password non coincidono' };
  }

  if (newPassword.length < 8) {
    return { error: 'La nuova password deve essere almeno 8 caratteri' };
  }

  try {
    await changePassword(token, session.userId, currentPassword, newPassword);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { error: msg.includes('incorrect') ? 'Password attuale non corretta' : msg };
  }
}


export interface CreatedTokenInfo {
  id: string;
  token: string;
  name: string;
  scopes: string[];
  createdAt: string;
}


export async function createTokenAction(
  _prev: { error?: string; created?: CreatedTokenInfo },
  formData: FormData,
): Promise<{ error?: string; created?: CreatedTokenInfo }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  const session = await validateSession(token);

  if (!session) return { error: 'Sessione non valida' };

  const name = (formData.get('name') as string).trim();
  const scopes = formData.getAll('scopes').map((s) => String(s).trim()).filter(Boolean);

  if (!name) return { error: 'Il nome è obbligatorio' };

  if (scopes.length === 0) return { error: 'Seleziona almeno uno scope' };

  try {
    const created = await createToken(token, { userId: session.userId, name, scopes });
    revalidatePath('/settings');
    return {
      created: {
        id: created.id,
        token: created.token,
        name: created.name,
        scopes: created.scopes,
        createdAt: created.createdAt,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore' };
  }
}


export async function revokeTokenAction(tokenId: string): Promise<void> {

  const token = await getToken();

  if (!token) return;

  await revokeToken(token, tokenId);
  revalidatePath('/settings');
}


export async function createUserAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  const username = (formData.get('username') as string).trim();
  const displayName = (formData.get('displayName') as string).trim();
  const email = (formData.get('email') as string).trim();
  const password = formData.get('password') as string;
  const role = (formData.get('role') as string | null)?.trim() || undefined;
  const managerId = (formData.get('managerId') as string | null)?.trim() || undefined;

  if (!username || !displayName || !email || !password) {
    return { error: 'Tutti i campi sono obbligatori' };
  }

  try {
    await createUser(token, { username, displayName, email, password, role, managerId });
    revalidatePath('/settings');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore';
    return { error: msg.includes('Unique') ? `Username o email già in uso` : msg };
  }
}


export async function deleteUserAction(userId: string): Promise<void> {

  const token = await getToken();

  if (!token) return;

  await deleteUser(token, userId);
  revalidatePath('/settings');
}


export async function createGrantAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  const session = await validateSession(token);

  if (!session) return { error: 'Sessione non valida' };

  const projectId = formData.get('projectId') as string;
  const subjectType = formData.get('subjectType') as string;
  const subjectId = formData.get('subjectId') as string;
  const grantType = formData.get('grantType') as string;

  if (!projectId || !subjectType || !subjectId || !grantType) {
    return { error: 'Tutti i campi sono obbligatori' };
  }

  try {
    await createGrant(token, {
      projectId,
      subjectType,
      subjectId,
      grantType,
      grantedByUserId: session.userId,
    });
    revalidatePath('/settings');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore' };
  }
}


export async function deleteGrantAction(grantId: string): Promise<void> {

  const token = await getToken();

  if (!token) return;

  await deleteGrant(token, grantId);
  revalidatePath('/settings');
}


async function isProjectOwner(
  token: string,
  projectId: string,
  session: { userId: string; role: string },
): Promise<boolean> {

  if (session.role === 'admin') return true;

  const project = await getProject(token, projectId).catch(() => null);

  if (project && project.ownerUserId === session.userId) return true;

  const grants = await listGrants(token, projectId).catch(() => []);
  const myMemberships = await listMyMemberships(token, session.userId).catch(() => []);
  const myTeamIds = new Set(myMemberships.map((m) => m.teamId));

  return grants.some((g) =>
    g.grantType === 'project.admin' && (
      (g.subjectType === 'user' && g.subjectId === session.userId)
      || (g.subjectType === 'team' && myTeamIds.has(g.subjectId))
    ),
  );
}


export async function addDeveloperAction(
  projectId: string,
  userId: string,
): Promise<{ error?: string }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  const session = await validateSession(token);

  if (!session) return { error: 'Sessione non valida' };

  const owner = await isProjectOwner(token, projectId, session);

  if (!owner) return { error: 'Solo il proprietario del progetto può aggiungere contributors' };

  try {
    await Promise.all([
      createGrant(token, { projectId, subjectType: 'user', subjectId: userId, grantType: 'project.read', grantedByUserId: session.userId }),
      createGrant(token, { projectId, subjectType: 'user', subjectId: userId, grantType: 'project.write', grantedByUserId: session.userId }),
      createGrant(token, { projectId, subjectType: 'user', subjectId: userId, grantType: 'task.write', grantedByUserId: session.userId }),
      createGrant(token, { projectId, subjectType: 'user', subjectId: userId, grantType: 'memory.write', grantedByUserId: session.userId }),
      createGrant(token, { projectId, subjectType: 'user', subjectId: userId, grantType: 'decision.write', grantedByUserId: session.userId }),
      createGrant(token, { projectId, subjectType: 'user', subjectId: userId, grantType: 'codeflow.read', grantedByUserId: session.userId }),
      createGrant(token, { projectId, subjectType: 'user', subjectId: userId, grantType: 'codeflow.write', grantedByUserId: session.userId }),
    ]);

    const target = await listUsers(token).catch(() => []).then((users) => users.find((u) => u.id === userId));
    await recordContributorEvent(token, projectId, {
      eventType: 'contributor.added',
      targetUserId: userId,
      targetUsername: target?.username,
      targetDisplayName: target?.displayName,
    }).catch(() => undefined);

    revalidatePath('/settings');
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}


export async function removeDeveloperAction(
  projectId: string,
  userId: string,
): Promise<{ error?: string }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  const session = await validateSession(token);

  if (!session) return { error: 'Sessione non valida' };

  const isSelf = userId === session.userId;
  const owner = isSelf ? false : await isProjectOwner(token, projectId, session);

  if (!isSelf && !owner) {
    return { error: 'Solo il proprietario può rimuovere altri contributors' };
  }

  try {
    const grants = await listGrants(token, projectId);
    const userGrants = grants.filter((g) => g.subjectType === 'user' && g.subjectId === userId);
    await Promise.all(userGrants.map((g) => deleteGrant(token, g.id)));

    const target = await listUsers(token).catch(() => []).then((users) => users.find((u) => u.id === userId));
    await recordContributorEvent(token, projectId, {
      eventType: isSelf ? 'contributor.left' : 'contributor.removed',
      targetUserId: userId,
      targetUsername: target?.username,
      targetDisplayName: target?.displayName,
    }).catch(() => undefined);

    revalidatePath('/settings');
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}


export async function resetUserPasswordAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  const userId = formData.get('userId') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!userId || !newPassword) return { error: 'Dati mancanti' };

  if (newPassword.length < 8) {
    return { error: 'La password deve essere almeno 8 caratteri' };
  }

  try {
    await resetUserPassword(token, userId, newPassword);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore' };
  }
}


export async function createTeamAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  const session = await validateSession(token);

  if (!session) return { error: 'Sessione non valida' };

  const name = (formData.get('name') as string).trim();
  const slug = (formData.get('slug') as string).trim();
  const description = ((formData.get('description') as string) ?? '').trim();

  if (!name || !slug) return { error: 'Nome e slug sono obbligatori' };

  try {
    const team = await createTeam(token, { name, slug, description: description || undefined });
    await createMembership(token, { teamId: team.id, userId: session.userId, role: 'admin' });
    revalidatePath('/settings');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore';
    return { error: msg.includes('Unique') || msg.includes('unique') ? 'Nome o slug già in uso' : msg };
  }
}


export async function deleteTeamAction(idOrSlug: string): Promise<{ error?: string }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  try {
    await deleteTeam(token, idOrSlug);
    revalidatePath('/settings');
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore' };
  }
}


export async function addTeamMemberAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  const teamId = (formData.get('teamId') as string).trim();
  const username = (formData.get('username') as string).trim();
  const role = ((formData.get('role') as string) ?? 'member').trim();

  if (!teamId || !username) return { error: 'Team e username obbligatori' };

  try {
    const users = await listUsers(token);
    const target = users.find((u) => u.username === username || u.email === username);

    if (!target) return { error: `Utente "${username}" non trovato` };

    await createMembership(token, { teamId, userId: target.id, role });
    revalidatePath('/settings');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore';
    return { error: msg.includes('Unique') ? 'Utente già membro di questo team' : msg };
  }
}


export async function removeTeamMemberAction(membershipId: string): Promise<{ error?: string }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  try {
    await deleteMembership(token, membershipId);
    revalidatePath('/settings');
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore' };
  }
}
