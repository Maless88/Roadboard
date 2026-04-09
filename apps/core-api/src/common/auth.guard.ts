import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { optionalEnv } from '@roadboard/config';


interface SessionValidateResponse {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  expiresAt: string;
}


interface McpTokenValidateResponse {
  userId: string;
  scope: string;
}


@Injectable()
export class AuthGuard implements CanActivate {

  private readonly authAccessHost: string;
  private readonly authAccessPort: string;

  constructor() {

    this.authAccessHost = optionalEnv('AUTH_ACCESS_HOST', 'localhost');
    this.authAccessPort = optionalEnv('AUTH_ACCESS_PORT', '4002');
  }


  async canActivate(context: ExecutionContext): Promise<boolean> {

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const base = `http://${this.authAccessHost}:${this.authAccessPort}`;

    try {

      const sessionRes = await fetch(`${base}/sessions/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (sessionRes.ok) {
        request.user = (await sessionRes.json()) as SessionValidateResponse;
        return true;
      }

      const mcpRes = await fetch(`${base}/tokens/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (mcpRes.ok) {
        const mcp = (await mcpRes.json()) as McpTokenValidateResponse;
        request.user = { userId: mcp.userId, username: 'mcp-agent', sessionId: '', displayName: 'MCP Agent', expiresAt: '' };
        return true;
      }

      throw new UnauthorizedException('Invalid token');
    } catch (error) {

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Authentication service unavailable');
    }
  }
}
