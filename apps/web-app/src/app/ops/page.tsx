import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Ops/System is merged into the unified "Agenti & Sistema" view.
export default function OpsPage(): never {
  redirect("/agent-office");
}
