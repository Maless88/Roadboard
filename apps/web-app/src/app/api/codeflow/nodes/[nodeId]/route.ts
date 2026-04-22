import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from '@/lib/auth';
import { getArchitectureNode } from '@/lib/api';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nodeId: string }> },
) {

  const { nodeId } = await context.params;
  const projectId = request.nextUrl.searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const token = await getToken();

  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const node = await getArchitectureNode(token, projectId, nodeId);
    return NextResponse.json(node);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
