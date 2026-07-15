'use server';

import { cookies } from 'next/headers';


const COOKIE = 'rb_token';

// Secure-by-default in production; SESSION_COOKIE_SECURE=false opts out for
// deployments served over plain HTTP on a private network (e.g. Tailscale),
// where the Secure attribute would make the browser drop the cookie.
const SECURE_COOKIE =
  process.env.SESSION_COOKIE_SECURE === 'true' ||
  (process.env.NODE_ENV === 'production' && process.env.SESSION_COOKIE_SECURE !== 'false');


export async function getToken(): Promise<string | null> {

  const jar = await cookies();

  return jar.get(COOKIE)?.value ?? null;
}


export async function setToken(token: string): Promise<void> {

  const jar = await cookies();

  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: SECURE_COOKIE,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}


export async function clearToken(): Promise<void> {

  const jar = await cookies();

  jar.delete(COOKIE);
}
