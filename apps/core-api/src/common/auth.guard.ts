import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { optionalEnv } from '@roadboard/config';


interface ValidateResponse {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  expiresAt: string;
}


@Injectable()
export class AuthGuard implements CanActivate {

  private readonly authAccessPort: string;

  constructor() {

    this.authAccessPort = optionalEnv('AUTH_ACCESS_PORT', '4002');
  }


  async canActivate(context: ExecutionContext): Promise<boolean> {

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);

    try {

      const response = await fetch(
        `http://localhost:${this.authAccessPort}/sessions/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        },
      );

      if (!response.ok) {
        throw new UnauthorizedException('Invalid session token');
      }

      const data = (await response.json()) as ValidateResponse;
      request.user = data;

      return true;
    } catch (error) {

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Authentication service unavailable');
    }
  }
}
