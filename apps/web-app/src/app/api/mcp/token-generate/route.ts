import { NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { validateSession, createToken } from '@/lib/api';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function POST() {

  const sessionToken = await getToken();

  if (!sessionToken) {

    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const session = await validateSession(sessionToken);

  if (!session) {

    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  try {

    const created = await createToken(sessionToken, {
      userId: session.userId,
      name: 'mcp-wizard',
      scopes: ['read', 'write'],
    });

    return NextResponse.json({
      token: created.token,
      name: created.name,
      scopes: created.scopes,
      expiresAt: created.expiresAt ?? null,
    });
  } catch (e) {

    const msg = e instanceof Error ? e.message : 'Failed to create token';

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
