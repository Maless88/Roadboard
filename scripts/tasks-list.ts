#!/usr/bin/env node
/**
 * tasks-list.ts — generates TASK_LIST.md from tasks/{todo,run,done}/ directories.
 * Run via: pnpm tasks:list
 */

import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const TASKS_DIR = path.join(ROOT, "tasks");
const OUTPUT = path.join(ROOT, "TASK_LIST.md");
const DONE_VISIBLE_LIMIT = 20;

export interface TaskEntry {
  slug: string;
  title: string;
  mtime: Date;
  age: string;
}

/**
 * Extracts the title from the first `# ...` heading in a markdown file.
 * Falls back to the slug if no heading is found.
 */
export function extractTitle(content: string, slug: string): string {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      return trimmed.slice(2).trim();
    }
  }

  return slug;
}

/**
 * Formats a Date as a human-readable Italian age string.
 * Examples: "oggi", "ieri", "3 giorni fa", "2 settimane fa", "1 mese fa".
 */
export function formatAge(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffDays === 0) {
    return "oggi";
  }

  if (diffDays === 1) {
    return "ieri";
  }

  if (diffDays < 7) {
    return `${diffDays} giorni fa`;
  }

  if (diffWeeks === 1) {
    return "1 settimana fa";
  }

  if (diffWeeks < 4) {
    return `${diffWeeks} settimane fa`;
  }

  if (diffMonths === 1) {
    return "1 mese fa";
  }

  return `${diffMonths} mesi fa`;
}

function readTasksFromDir(dir: string): TaskEntry[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  return files.map((filename) => {
    const slug = filename.replace(/\.md$/, "");
    const filePath = path.join(dir, filename);
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const mtime = stat.mtime;

    return {
      slug,
      title: extractTitle(content, slug),
      mtime,
      age: formatAge(mtime),
    };
  });
}

function renderEntry(entry: TaskEntry): string {
  return `- **${entry.slug}** — ${entry.title}  \n  _${entry.age}_`;
}

function renderSection(
  emoji: string,
  heading: string,
  entries: TaskEntry[],
): string {
  const count = entries.length;
  const lines: string[] = [];
  lines.push(`## ${emoji} ${heading} (${count})`);
  lines.push("");

  if (count === 0) {
    lines.push("_Nessun task._");
    lines.push("");

    return lines.join("\n");
  }

  for (const entry of entries) {
    lines.push(renderEntry(entry));
  }

  lines.push("");

  return lines.join("\n");
}

function renderDoneSection(entries: TaskEntry[]): string {
  const count = entries.length;
  const visible = entries.slice(0, DONE_VISIBLE_LIMIT);
  const hidden = entries.slice(DONE_VISIBLE_LIMIT);
  const lines: string[] = [];
  lines.push(`## ✅ Completati (${count})`);
  lines.push("");

  if (count === 0) {
    lines.push("_Nessun task completato._");
    lines.push("");

    return lines.join("\n");
  }

  for (const entry of visible) {
    lines.push(renderEntry(entry));
  }

  if (hidden.length > 0) {
    lines.push("");
    lines.push("<details>");
    lines.push(`<summary>Mostra altri ${hidden.length} task completati</summary>`);
    lines.push("");

    for (const entry of hidden) {
      lines.push(renderEntry(entry));
    }

    lines.push("</details>");
  }

  lines.push("");

  return lines.join("\n");
}

export interface GenerateOptions {
  tasksDir?: string;
  outputPath?: string;
}

export interface GenerateResult {
  run: number;
  todo: number;
  done: number;
  outputPath: string;
}

/**
 * Generates TASK_LIST.md from tasks/{run,todo,done}/ directories.
 * Accepts optional overrides for tasksDir and outputPath (used in tests).
 */
export function generateTaskList(options: GenerateOptions = {}): GenerateResult {
  const tasksDir = options.tasksDir ?? TASKS_DIR;
  const outputPath = options.outputPath ?? OUTPUT;
  const now = new Date();
  const timestamp = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const run = readTasksFromDir(path.join(tasksDir, "run"));
  const todo = readTasksFromDir(path.join(tasksDir, "todo"));
  const done = readTasksFromDir(path.join(tasksDir, "done"));

  // Sort done by mtime desc (most recent first)
  done.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  const sections: string[] = [
    `# TASK_LIST`,
    ``,
    `> Generato il **${timestamp}** — rigenera con \`pnpm tasks:list\`.`,
    ``,
    renderSection("🔄", "In corso", run),
    renderSection("⏳", "Da fare", todo),
    renderDoneSection(done),
    `---`,
    ``,
    `> Auto-generato. Non modificare a mano.`,
  ];

  const output = sections.join("\n");
  fs.writeFileSync(outputPath, output, "utf-8");

  return { run: run.length, todo: todo.length, done: done.length, outputPath };
}

function generate(): void {
  const result = generateTaskList();
  console.log(`✔ TASK_LIST.md generato (run=${result.run}, todo=${result.todo}, done=${result.done})`);
}

// Only run when invoked directly (not when imported in tests)
const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("tasks-list.ts") ||
    process.argv[1].endsWith("tasks-list.js"));

if (isMain) {
  generate();
}
