import { Test } from "@nestjs/testing";
import { CoordinatorService } from "./coordinator.service";
import { AgentsService } from "./agents.service";

const AGENTS = [
  { slug: "assistant", capability: "general", name: "Assistant" },
  { slug: "researcher", capability: "research", name: "Researcher" },
  { slug: "coordinator", capability: "routing", name: "Coordinator" },
  { slug: "dev", capability: "code", name: "Dev" },
  { slug: "sysadmin", capability: "ops", name: "Sysadmin" },
];

async function make(list: unknown) {
  const agents = { list: vi.fn().mockResolvedValue(list) };
  const module = await Test.createTestingModule({
    providers: [CoordinatorService, { provide: AgentsService, useValue: agents }],
  }).compile();
  return module.get(CoordinatorService);
}

describe("CoordinatorService", () => {

  it("routes by detected capability, never to the router itself", async () => {
    const svc = await make(AGENTS);
    expect(await svc.route("cerca le ultime notizie")).toEqual({ slug: "researcher", reason: "capability:research" });
    expect(await svc.route("c'è un bug nel codice, refactor")).toEqual({ slug: "dev", reason: "capability:code" });
    expect(await svc.route("riavvia il container docker")).toEqual({ slug: "sysadmin", reason: "capability:ops" });
  });

  it("falls back to the general capability for unmatched text", async () => {
    const svc = await make(AGENTS);
    expect(await svc.route("ciao come va")).toEqual({ slug: "assistant", reason: "capability:general" });
  });

  it("resolveCapability maps a role to a concrete agent, null when unmet", async () => {
    const svc = await make(AGENTS);
    expect(await svc.resolveCapability("research")).toEqual({ slug: "researcher", reason: "capability:research" });
    expect(await svc.resolveCapability("routing")).toBeNull(); // router excluded from registry
    expect(await svc.resolveCapability("nonexistent")).toBeNull();
    expect(await svc.resolveCapability("")).toBeNull();
  });

  it("handles an empty roster", async () => {
    const svc = await make([]);
    expect(await svc.route("qualsiasi")).toEqual({ slug: "default", reason: "no agents" });
    expect(await svc.resolveCapability("research")).toBeNull();
  });
});
