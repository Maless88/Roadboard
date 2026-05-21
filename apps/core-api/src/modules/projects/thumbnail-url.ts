/**
 * URL validation for project home URLs.
 *
 * Rules:
 *  - Protocol MUST be http or https.
 *  - Hostname MUST be present.
 *  - Reject loopback / private RFC1918 / link-local hosts to prevent SSRF
 *    when the worker fetches them via headless browser.
 *
 * The regex tolerates IPv4 literals; IPv6 is rejected (we never need it here).
 */


const PRIVATE_HOST_RE = [
  /^localhost$/i,
  /^127(?:\.\d+){3}$/,
  /^10(?:\.\d+){3}$/,
  /^192\.168(?:\.\d+){2}$/,
  /^172\.(1[6-9]|2\d|3[01])(?:\.\d+){2}$/,
  /^169\.254(?:\.\d+){2}$/,
  /^0(?:\.\d+){3}$/,
  /^\[?::1\]?$/,
];


export interface UrlValidation {
  ok: boolean;
  reason?: 'protocol' | 'host' | 'private' | 'parse';
}


export function validateHomeUrl(raw: string): UrlValidation {

  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'parse' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'protocol' };
  }

  if (!parsed.hostname) {
    return { ok: false, reason: 'host' };
  }

  for (const rx of PRIVATE_HOST_RE) {

    if (rx.test(parsed.hostname)) {
      return { ok: false, reason: 'private' };
    }
  }

  return { ok: true };
}
