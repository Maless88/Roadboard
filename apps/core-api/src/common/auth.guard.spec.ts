import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';


vi.mock('@roadboard/config', () => ({
  optionalEnv: (_name: string, fallback: string) => fallback,
}));


function makeContext(authHeader?: string): { context: ExecutionContext; request: Record<string, unknown> } {

  const request: Record<string, unknown> = {
    headers: authHeader ? { authorization: authHeader } : {},
  };

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}


function jsonResponse(ok: boolean, body: unknown): Response {
  return { ok, json: async () => body } as unknown as Response;
}


describe('AuthGuard MCP branch', () => {

  let guard: AuthGuard;

  beforeEach(() => {
    guard = new AuthGuard();
    vi.restoreAllMocks();
  });


  it('populates request.user.mcpTokenId from /tokens/validate response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(false, {}))
      .mockResolvedValueOnce(
        jsonResponse(true, {
          userId: 'u1',
          scopes: ['read'],
          tokenId: 'tok-1',
          tokenName: 'My token',
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const { context, request } = makeContext('Bearer raw-token');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toMatchObject({
      userId: 'u1',
      source: 'mcp',
      mcpTokenId: 'tok-1',
      mcpTokenName: 'My token',
    });
  });


  it('throws UnauthorizedException when both session and token validation fail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(false, {}))
      .mockResolvedValueOnce(jsonResponse(false, {}));

    vi.stubGlobal('fetch', fetchMock);

    const { context } = makeContext('Bearer raw-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
