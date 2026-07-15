import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from '@/lib/auth';


const AUTH_API = process.env.AUTH_URL ?? 'http://localhost:3002';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function POST(request: NextRequest) {

  // Session-gated: without this the route is an unauthenticated online
  // validity oracle for MCP tokens.
  const session = await getToken();

  if (!session) {
    return NextResponse.json({ valid: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: { token?: string };

  try {

    body = (await request.json()) as { token?: string };
  } catch {

    return NextResponse.json({ valid: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token } = body;

  if (!token) {

    return NextResponse.json({ valid: false, error: 'token is required' }, { status: 400 });
  }

  try {

    const res = await fetch(`${AUTH_API}/tokens/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {

      return NextResponse.json({ valid: true });
    }

    const err = await res.json().catch(() => ({})) as { message?: string };

    return NextResponse.json({
      valid: false,
      error: err.message ?? `HTTP ${res.status}`,
    });
  } catch (e) {

    const msg = e instanceof Error ? e.message : 'Unknown error';

    return NextResponse.json({ valid: false, error: msg });
  }
}
