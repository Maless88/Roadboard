import { NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';


export const dynamic = 'force-dynamic';


const CORE_API = process.env.CORE_API_URL ?? 'http://localhost:3001';


export async function POST() {

  const token = await getToken();

  if (token === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${CORE_API}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || 'upstream error' }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'upstream unreachable' }, { status: 502 });
  }
}
