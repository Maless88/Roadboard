import { NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';


export const dynamic = 'force-dynamic';


const CORE_API = process.env.CORE_API_URL ?? 'http://localhost:3001';


export async function GET() {

  const token = await getToken();

  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${CORE_API}/release-status`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'upstream error' }, { status: 502 });
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'upstream unreachable' }, { status: 502 });
  }
}
