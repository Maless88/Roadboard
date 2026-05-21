/**
 * Build an absolute URL for a thumbnail stored on core-api.
 *
 * Server-side: uses CORE_API_URL or NEXT_PUBLIC_CORE_API_URL.
 * Client-side: only NEXT_PUBLIC_CORE_API_URL is available.
 */


const PUBLIC_BASE = process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:3001';


export function resolveThumbnailUrl(thumbnailUrl: string | null | undefined): string | null {

  if (!thumbnailUrl) return null;

  if (/^https?:\/\//i.test(thumbnailUrl)) return thumbnailUrl;

  if (thumbnailUrl.startsWith('/')) return `${PUBLIC_BASE}${thumbnailUrl}`;

  return thumbnailUrl;
}
