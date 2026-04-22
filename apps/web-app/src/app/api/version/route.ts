import { NextResponse } from 'next/server';


export const dynamic = 'force-dynamic';


export async function GET() {

  return NextResponse.json({
    sha: process.env.BUILD_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown',
    builtAt: process.env.BUILD_TIME ?? process.env.NEXT_PUBLIC_BUILD_TIME ?? 'unknown',
    service: 'web-app',
  });
}
