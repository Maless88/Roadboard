const parsedLimit = Number(process.env.AUTH_THROTTLE_LIMIT);
const parsedTtlMs = Number(process.env.AUTH_THROTTLE_TTL_MS);

/**
 * Anti brute-force limits for the /auth routes (login/register).
 * Env-overridable so test/CI environments can relax them without
 * touching the production default (5 attempts / 60s per account).
 */
export const AUTH_THROTTLE_LIMIT =
  Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5;

export const AUTH_THROTTLE_TTL_MS =
  Number.isFinite(parsedTtlMs) && parsedTtlMs > 0 ? parsedTtlMs : 60000;
