'use server';

import { revalidatePath } from 'next/cache';
import { getToken } from '@/lib/auth';
import {
  changePassword,
  createToken,
  revokeToken,
  createUser,
  deleteUser,
  createGrant,
  deleteGrant,
  validateSession,
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


export async function createTokenAction(
  _prev: { error?: string; created?: { token: string; name: string } },
  formData: FormData,
): Promise<{ error?: string; created?: { token: string; name: string } }> {

  const token = await getToken();

  if (!token) return { error: 'Non autenticato' };

  const session = await validateSession(token);

  if (!session) return { error: 'Sessione non valida' };

  const name = (formData.get('name') as string).trim();
  const scope = (formData.get('scope') as string).trim() || 'read write';

  if (!name) return { error: 'Il nome è obbligatorio' };

  try {
    const created = await createToken(token, { userId: session.userId, name, scope });
    revalidatePath('/settings');
    return { created: { token: created.token, name: created.name } };
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

  if (!username || !displayName || !email || !password) {
    return { error: 'Tutti i campi sono obbligatori' };
  }

  try {
    await createUser(token, { username, displayName, email, password });
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
