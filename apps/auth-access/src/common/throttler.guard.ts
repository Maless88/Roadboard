import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttler per le route auth: chiave per username (anti brute-force
 * per-account) con fallback su IP. Applicato solo su AuthController,
 * cosi' non tocca il traffico interno di validazione token/sessioni.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const username =
      typeof req?.body?.username === 'string' ? req.body.username.toLowerCase() : undefined;
    const ip = Array.isArray(req?.ips) && req.ips.length ? req.ips[0] : req?.ip;
    return username ? `user:${username}` : `ip:${ip ?? 'unknown'}`;
  }
}
