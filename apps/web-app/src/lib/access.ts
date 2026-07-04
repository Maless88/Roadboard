import type { SessionInfo } from "./api";

// Life-OS surfaces (agent chat, agenda/calendar, agents & system, notifications, home)
// are gated during rollout: visible only to Alessio and to admins.
// Allowlist is configurable; role "admin" always passes.
// NB: the sidebar is a client component where non-NEXT_PUBLIC env is not available,
// so this default is the effective client-side allowlist (server pages also honor the
// env override + role "admin"). Keep both usernames here so the admin sees the nav too.
const LIFEOS_ALLOWED_USERNAMES = (process.env.LIFEOS_ALLOWED_USERNAMES || "alessio,admin")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isLifeOsUser(
  user: Pick<SessionInfo, "username" | "role"> | { username?: string | null; role?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  if ((user.role || "").toLowerCase() === "admin") return true;
  return LIFEOS_ALLOWED_USERNAMES.includes((user.username || "").toLowerCase());
}
