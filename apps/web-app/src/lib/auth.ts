'use server';

import { cookies } from 'next/headers';


const COOKIE = 'rb_token';


export async function getToken(): Promise<string | null> {

  const jar = await cookies();

  return jar.get(COOKIE)?.value ?? null;
}


export async function setToken(token: string): Promise<void> {

  const jar = await cookies();

  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}


export async function clearToken(): Promise<void> {

  const jar = await cookies();

  jar.delete(COOKIE);
}
