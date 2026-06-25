import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// boardchat is deprecated: the single source of truth is Chatboard (rooms store),
// which has image generation, per-room concurrency and avatars. Redirect any
// lingering bookmarks/tabs to the new chat so the legacy /agents/chat path is dead.
export default function BoardchatPage() {
  redirect("/chatboard");
}
