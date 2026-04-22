import { Injectable } from "@nestjs/common";


@Injectable()
export class ReleaseService {

  private pendingSha: string | null = null;
  private pendingAt: string | null = null;

  setPending(sha: string): void {

    this.pendingSha = sha;
    this.pendingAt = new Date().toISOString();
  }

  clearPending(): void {

    this.pendingSha = null;
    this.pendingAt = null;
  }

  getPending(): { sha: string; at: string } | null {

    if (this.pendingSha === null || this.pendingAt === null) {
      return null;
    }

    return { sha: this.pendingSha, at: this.pendingAt };
  }
}
