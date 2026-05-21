#!/usr/bin/env tsx
/**
 * rename-active-tasks.ts
 *
 * Renames active RoadBoard tasks from legacy code-prefixed titles to the
 * "Area — description" convention.
 *
 * Usage:
 *   tsx scripts/rename-active-tasks.ts --dry-run   (default, prints diff)
 *   tsx scripts/rename-active-tasks.ts --apply     (calls API to rename)
 *
 * Requires env vars:
 *   ROADBOARD_API_URL   base URL of the core-api  (e.g. http://localhost:3001)
 *   ROADBOARD_API_TOKEN bearer token with task:write scope
 */

import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AreaMap {
  _comment: string;
  prefixes: Record<string, string>;
  exact: Record<string, string>;
}

interface Task {
  id: string;
  title: string;
  status: string;
}

interface ListResponse {
  items: Task[];
  nextCursor?: string | null;
}

interface RenameResult {
  taskId: string;
  oldTitle: string;
  newTitle: string;
  status: "renamed" | "skipped" | "error";
  reason?: string;
}

// ---------------------------------------------------------------------------
// Legacy title detection
// ---------------------------------------------------------------------------

/**
 * Matches titles that look like legacy code prefixes, e.g.:
 *   [CF-GDB-03b-7] Some text
 *   CF-17R — Some text
 *   [W4-06] web-app: …
 *   [audit-01] core-api: …
 *
 * Segment pattern: starts with a letter, followed by letters/digits,
 * then one or more dash-separated alphanumeric segments.
 */
export const LEGACY_TITLE_REGEX =
  /^\[?([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)\]?\s*(?:—|-|:)?\s*/;

/**
 * Returns true if the title uses a legacy coding convention.
 */
export function isLegacyTitle(title: string): boolean {
  return LEGACY_TITLE_REGEX.test(title);
}

/**
 * Extracts the legacy code token from a title.
 * Returns null if the title is not legacy.
 */
export function extractCode(title: string): string | null {
  const match = LEGACY_TITLE_REGEX.exec(title);

  if (!match) {
    return null;
  }

  return match[1];
}

/**
 * Strips the legacy prefix from a title and returns the plain description.
 */
export function stripLegacyPrefix(title: string): string {
  return title.replace(LEGACY_TITLE_REGEX, "").trim();
}

// ---------------------------------------------------------------------------
// Area resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the area name for a given legacy code token.
 * Lookup order: exact match → longest-matching prefix → null (unknown).
 */
export function resolveArea(code: string, areaMap: AreaMap): string | null {
  // 1. Exact match
  if (areaMap.exact[code]) {
    return areaMap.exact[code];
  }

  // 2. Longest prefix match (most specific prefix wins)
  let bestMatch: string | null = null;
  let bestLength = 0;

  for (const [prefix, area] of Object.entries(areaMap.prefixes)) {
    if (code.startsWith(prefix) && prefix.length > bestLength) {
      bestMatch = area;
      bestLength = prefix.length;
    }
  }

  return bestMatch;
}

/**
 * Builds a new title from area + stripped description.
 */
export function buildNewTitle(area: string, description: string): string {
  return `${area} — ${description}`;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function getConfig(): { apiUrl: string; apiToken: string } {
  const apiUrl = process.env["ROADBOARD_API_URL"];
  const apiToken = process.env["ROADBOARD_API_TOKEN"];

  if (!apiUrl) {
    throw new Error("ROADBOARD_API_URL env var is required");
  }

  if (!apiToken) {
    throw new Error("ROADBOARD_API_TOKEN env var is required");
  }

  return { apiUrl, apiToken };
}

async function fetchTasks(
  projectId: string,
  status: string,
  apiUrl: string,
  apiToken: string
): Promise<Task[]> {
  const tasks: Task[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${apiUrl}/projects/${projectId}/tasks`);
    url.searchParams.set("status", status);
    url.searchParams.set("limit", "100");

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`GET /tasks failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as ListResponse;
    const items = Array.isArray(data) ? (data as Task[]) : data.items ?? [];
    tasks.push(...items);
    cursor = Array.isArray(data) ? null : (data.nextCursor ?? null);
  } while (cursor);

  return tasks;
}

async function renameTask(
  taskId: string,
  newTitle: string,
  apiUrl: string,
  apiToken: string
): Promise<void> {
  const res = await fetch(`${apiUrl}/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: newTitle }),
  });

  if (!res.ok) {
    throw new Error(`PATCH /tasks/${taskId} failed: ${res.status} ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

export function computeRename(task: Task, areaMap: AreaMap): RenameResult {
  if (!isLegacyTitle(task.title)) {
    return {
      taskId: task.id,
      oldTitle: task.title,
      newTitle: task.title,
      status: "skipped",
      reason: "title already follows convention",
    };
  }

  const code = extractCode(task.title);

  if (!code) {
    return {
      taskId: task.id,
      oldTitle: task.title,
      newTitle: task.title,
      status: "skipped",
      reason: "could not extract code token",
    };
  }

  const area = resolveArea(code, areaMap);

  if (!area) {
    return {
      taskId: task.id,
      oldTitle: task.title,
      newTitle: task.title,
      status: "skipped",
      reason: `unknown code prefix: ${code} — add to area-map.json manually`,
    };
  }

  const description = stripLegacyPrefix(task.title);

  if (!description) {
    return {
      taskId: task.id,
      oldTitle: task.title,
      newTitle: task.title,
      status: "skipped",
      reason: "description is empty after stripping prefix",
    };
  }

  const newTitle = buildNewTitle(area, description);

  return {
    taskId: task.id,
    oldTitle: task.title,
    newTitle,
    status: "renamed",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--apply");
  const projectId = args.find((a) => a.startsWith("--project="))?.split("=")[1]
    ?? "cmnrj9our000eo343kksv2y8o";

  console.log(
    `\n=== rename-active-tasks [${isDryRun ? "DRY-RUN" : "APPLY"}] ===`
  );
  console.log(`Project: ${projectId}\n`);

  const { apiUrl, apiToken } = getConfig();

  const areaMapPath = join(import.meta.dirname ?? __dirname, "area-map.json");
  const areaMap: AreaMap = JSON.parse(readFileSync(areaMapPath, "utf-8"));

  // Fetch todo + in_progress tasks
  const [todoTasks, inProgressTasks] = await Promise.all([
    fetchTasks(projectId, "todo", apiUrl, apiToken),
    fetchTasks(projectId, "in_progress", apiUrl, apiToken),
  ]);

  const allTasks = [...todoTasks, ...inProgressTasks];
  console.log(`Found ${allTasks.length} active tasks (todo: ${todoTasks.length}, in_progress: ${inProgressTasks.length})\n`);

  const results: RenameResult[] = [];

  for (const task of allTasks) {
    const result = computeRename(task, areaMap);
    results.push(result);
  }

  // Print diff
  const toRename = results.filter((r) => r.status === "renamed");
  const skipped = results.filter((r) => r.status === "skipped");
  const errors: RenameResult[] = [];

  console.log("--- DIFF ---");

  for (const r of toRename) {
    console.log(`\n  [RENAME] ${r.taskId}`);
    console.log(`    OLD: ${r.oldTitle}`);
    console.log(`    NEW: ${r.newTitle}`);
  }

  console.log("\n--- SKIPPED ---");

  for (const r of skipped) {
    console.log(`  [SKIP] ${r.taskId} — ${r.reason}`);
    console.log(`         "${r.oldTitle}"`);
  }

  if (!isDryRun) {
    console.log("\n--- APPLYING ---");

    for (const r of toRename) {
      try {
        await renameTask(r.taskId, r.newTitle, apiUrl, apiToken);
        console.log(`  [OK] ${r.taskId}: "${r.newTitle}"`);
      } catch (err) {
        const errResult: RenameResult = {
          ...r,
          status: "error",
          reason: err instanceof Error ? err.message : String(err),
        };

        errors.push(errResult);
        console.error(`  [ERR] ${r.taskId}: ${errResult.reason}`);
      }
    }
  }

  console.log("\n--- SUMMARY ---");
  console.log(`  Renamed : ${isDryRun ? toRename.length + " (dry-run, not applied)" : toRename.length - errors.length}`);
  console.log(`  Skipped : ${skipped.length}`);
  console.log(`  Errors  : ${errors.length}`);

  if (errors.length > 0) {
    process.exit(1);
  }
}

// Run main only when invoked directly (not when imported for testing)
const isMain =
  process.argv[1]?.endsWith("rename-active-tasks.ts") ||
  process.argv[1]?.endsWith("rename-active-tasks.js");

if (isMain) {
  main().catch((err: unknown) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
