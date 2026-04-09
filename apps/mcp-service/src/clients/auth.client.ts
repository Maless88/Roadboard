import { optionalEnv } from "@roadboard/config";


const AUTH_ACCESS_HOST = optionalEnv("AUTH_ACCESS_HOST", "localhost");
const AUTH_ACCESS_PORT = optionalEnv("AUTH_ACCESS_PORT", "4002");
const VALIDATE_URL = `http://${AUTH_ACCESS_HOST}:${AUTH_ACCESS_PORT}/tokens/validate`;


interface ValidateResult {
  userId: string;
  scope: string;
}


export class AuthClient {

  async validateToken(token: string): Promise<ValidateResult | null> {

    try {
      const res = await fetch(VALIDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        return null;
      }

      return res.json() as Promise<ValidateResult>;
    } catch {
      return null;
    }
  }
}
