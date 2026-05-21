import { NextResponse, type NextRequest } from 'next/server';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function POST(request: NextRequest) {

  let body: { url?: string; token?: string };

  try {

    body = (await request.json()) as { url?: string; token?: string };
  } catch {

    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, token } = body;

  if (!url || !token) {

    return NextResponse.json({ ok: false, error: 'url and token are required' }, { status: 400 });
  }

  const start = Date.now();

  try {

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json, text/event-stream',
      },
      signal: AbortSignal.timeout(8000),
    });

    const latencyMs = Date.now() - start;

    if (res.ok || res.status === 405) {

      return NextResponse.json({ ok: true, latencyMs });
    }

    return NextResponse.json({
      ok: false,
      latencyMs,
      error: `HTTP ${res.status}`,
    });
  } catch (e) {

    const latencyMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : 'Unknown error';

    return NextResponse.json({ ok: false, latencyMs, error: msg });
  }
}
