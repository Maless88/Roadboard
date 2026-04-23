export type AuthSource = 'web' | 'mcp' | 'system';


export interface AuthUser {
  userId: string;
  username: string;
  displayName: string;
  sessionId: string;
  expiresAt: string;
  source: AuthSource;
}
