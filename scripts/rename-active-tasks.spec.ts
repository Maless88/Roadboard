import { describe, it, expect } from "vitest";
import {
  isLegacyTitle,
  extractCode,
  stripLegacyPrefix,
  resolveArea,
  buildNewTitle,
  computeRename,
} from "./rename-active-tasks.js";
import type {} from "./rename-active-tasks.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AREA_MAP = {
  _comment: "",
  prefixes: {
    "CF-GDB": "Memgraph",
    "CF-AGENT": "Atlas",
    CF: "Atlas",
    "AI-P": "CodeFlow Stabilization",
    W4: "Workspaces",
    Audit: "Audit & Compliance",
    audit: "Audit & Compliance",
    MCP: "MCP Guide",
    UX: "UX & Vibe Coding",
    PD: "Project Discovery",
    "AI-chatbot": "AI Assistant",
  },
  exact: {
    "CF-17R": "Atlas",
    "CF-GDB-03b-7": "Memgraph",
    "CF-GDB-03b": "Memgraph",
    "CF-GDB-03": "Memgraph",
    "CF-GDB-04": "Memgraph",
    "CF-AGENT-01c": "Atlas",
    "CF-AGENT-01d": "Atlas",
    "CF-19": "Atlas",
    "CF-20": "Atlas",
    "CF-21": "Atlas",
    "CF-22": "Atlas",
    "CF-23": "Atlas",
    "W4-06": "Workspaces",
    "audit-01": "Audit & Compliance",
  },
};

// ---------------------------------------------------------------------------
// isLegacyTitle
// ---------------------------------------------------------------------------

describe("isLegacyTitle", () => {
  it("detects bracketed prefix", () => {
    expect(isLegacyTitle("[CF-GDB-03b-7] Test integration outbox")).toBe(true);
  });

  it("detects unbracketed prefix with dash separator", () => {
    expect(isLegacyTitle("CF-17R — Impact view")).toBe(true);
  });

  it("detects bracketed lowercase prefix", () => {
    expect(isLegacyTitle("[audit-01] core-api: popolare AuditEvent")).toBe(true);
  });

  it("detects W4 prefix", () => {
    expect(isLegacyTitle("[W4-06] web-app: invite flow")).toBe(true);
  });

  it("does NOT flag new-style titles", () => {
    expect(isLegacyTitle("Atlas — Impact view generalizzata")).toBe(false);
  });

  it("does NOT flag plain prose titles", () => {
    expect(isLegacyTitle("Settings → tab Usage: consumo token per utente")).toBe(false);
  });

  it("does NOT flag MVP scanner title", () => {
    expect(isLegacyTitle("MVP scanner TypeScript via ts-morph")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractCode
// ---------------------------------------------------------------------------

describe("extractCode", () => {
  it("extracts code from bracketed title", () => {
    expect(extractCode("[CF-GDB-03b-7] Some text")).toBe("CF-GDB-03b-7");
  });

  it("extracts code from unbracketed title", () => {
    expect(extractCode("CF-17R — Some text")).toBe("CF-17R");
  });

  it("returns null for non-legacy title", () => {
    expect(extractCode("Atlas — Some description")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// stripLegacyPrefix
// ---------------------------------------------------------------------------

describe("stripLegacyPrefix", () => {
  it("strips bracketed prefix and separator", () => {
    expect(
      stripLegacyPrefix("[CF-GDB-03b-7] Test integration outbox + worker contro Memgraph reale")
    ).toBe("Test integration outbox + worker contro Memgraph reale");
  });

  it("strips unbracketed prefix with em dash", () => {
    expect(stripLegacyPrefix("CF-17R — Impact view generalizzata")).toBe(
      "Impact view generalizzata"
    );
  });

  it("strips prefix with colon separator", () => {
    expect(stripLegacyPrefix("[audit-01] core-api: popolare AuditEvent")).toBe(
      "core-api: popolare AuditEvent"
    );
  });
});

// ---------------------------------------------------------------------------
// resolveArea
// ---------------------------------------------------------------------------

describe("resolveArea", () => {
  it("resolves exact match CF-GDB-03b-7 → Memgraph", () => {
    expect(resolveArea("CF-GDB-03b-7", AREA_MAP)).toBe("Memgraph");
  });

  it("resolves exact match CF-17R → Atlas", () => {
    expect(resolveArea("CF-17R", AREA_MAP)).toBe("Atlas");
  });

  it("resolves exact match W4-06 → Workspaces", () => {
    expect(resolveArea("W4-06", AREA_MAP)).toBe("Workspaces");
  });

  it("resolves exact match audit-01 → Audit & Compliance", () => {
    expect(resolveArea("audit-01", AREA_MAP)).toBe("Audit & Compliance");
  });

  it("resolves prefix CF-GDB-999 → Memgraph (prefix CF-GDB beats CF)", () => {
    expect(resolveArea("CF-GDB-999", AREA_MAP)).toBe("Memgraph");
  });

  it("resolves prefix CF-AGENT-99 → Atlas", () => {
    expect(resolveArea("CF-AGENT-99", AREA_MAP)).toBe("Atlas");
  });

  it("resolves generic CF prefix → Atlas", () => {
    expect(resolveArea("CF-99", AREA_MAP)).toBe("Atlas");
  });

  it("returns null for unknown code", () => {
    expect(resolveArea("XYZ-99", AREA_MAP)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildNewTitle
// ---------------------------------------------------------------------------

describe("buildNewTitle", () => {
  it("builds title with em dash separator", () => {
    expect(buildNewTitle("Atlas", "Impact view generalizzata")).toBe(
      "Atlas — Impact view generalizzata"
    );
  });

  it("builds title with special chars in description", () => {
    expect(buildNewTitle("Memgraph", "Test integration outbox + worker")).toBe(
      "Memgraph — Test integration outbox + worker"
    );
  });
});

// ---------------------------------------------------------------------------
// computeRename
// ---------------------------------------------------------------------------

describe("computeRename", () => {
  it("renames a legacy task", () => {
    const task = {
      id: "task-001",
      title: "[CF-GDB-03b-7] Test integration outbox + worker contro Memgraph reale",
      status: "todo",
    };

    const result = computeRename(task, AREA_MAP);

    expect(result.status).toBe("renamed");
    expect(result.newTitle).toBe(
      "Memgraph — Test integration outbox + worker contro Memgraph reale"
    );
    expect(result.oldTitle).toBe(task.title);
  });

  it("skips non-legacy task", () => {
    const task = {
      id: "task-002",
      title: "Atlas — Impact view generalizzata",
      status: "todo",
    };

    const result = computeRename(task, AREA_MAP);

    expect(result.status).toBe("skipped");
    expect(result.reason).toContain("convention");
  });

  it("skips task with unknown prefix", () => {
    const task = {
      id: "task-003",
      title: "[XYZ-99] Some unknown area task",
      status: "todo",
    };

    const result = computeRename(task, AREA_MAP);

    expect(result.status).toBe("skipped");
    expect(result.reason).toContain("unknown code prefix");
  });

  it("renames CF-17R task", () => {
    const task = {
      id: "task-004",
      title: "CF-17R — Impact view generalizzata in node-drawer (qualsiasi ArchitectureNode)",
      status: "todo",
    };

    const result = computeRename(task, AREA_MAP);

    expect(result.status).toBe("renamed");
    expect(result.newTitle).toBe(
      "Atlas — Impact view generalizzata in node-drawer (qualsiasi ArchitectureNode)"
    );
  });

  it("renames W4-06 task", () => {
    const task = {
      id: "task-005",
      title: "[W4-06] web-app: invite flow — invite user to team, pending invite list, accept invite page",
      status: "todo",
    };

    const result = computeRename(task, AREA_MAP);

    expect(result.status).toBe("renamed");
    expect(result.newTitle).toBe(
      "Workspaces — web-app: invite flow — invite user to team, pending invite list, accept invite page"
    );
  });
});
