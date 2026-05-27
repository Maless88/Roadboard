#!/usr/bin/env node
/**
 * agent-workflow.ts — CLI for the AI Workflow pipeline.
 * Subcommands: status, intake, lint, report, ready, sync, adapters
 * Run via: pnpm agent:workflow <command> [options]
 */

import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateTaskList } from "./tasks-list";

const ROOT = path.resolve(__dirname, "..");
const TASKS_DIR = path.join(ROOT, "tasks");

export function readPackageVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")) as { version: string };
  return pkg.version;
}
const TASK_LIST_PATH = path.join(ROOT, "TASK_LIST.md");
const TEMPLATES_DIR = path.join(ROOT, "docs", "templates");
const INTAKE_TEMPLATE = path.join(TEMPLATES_DIR, "developer-intake-template.md");
const REPORT_TEMPLATE = path.join(TEMPLATES_DIR, "final-report-template.md");

export interface FolderCount {
  folder: string;
  count: number;
}

export interface StatusResult {
  counts: FolderCount[];
}

export interface IntakeResult {
  filePath: string;
  slug: string;
}

export interface LintResult {
  ok: boolean;
  issues: number;
  message: string;
}

export interface FileLintResult {
  file: string;
  errors: string[];
  warnings: string[];
}

export interface PromptLintResult {
  errors: string[];
  warnings: string[];
}

export interface ReportResult {
  filePath: string;
  slug: string;
}

export interface ReadyResult {
  files: string[];
}

export interface StaleCheckResult {
  exists: boolean;
  stale: boolean;
  taskListMtime: Date | null;
  newestTaskMtime: Date | null;
}

export interface SyncResult {
  outputPath: string;
  run: number;
  todo: number;
  done: number;
}

export interface AdapterConfig {
  enabled: boolean;
  binary: string;
  outputDir: string;
  role?: "analyst" | "architect";
  systemPromptPath?: string;
  flags?: string[];
}

export interface RoleConfig {
  binary: string;
  model?: string;
  flags?: string[];
  systemPromptPath?: string;
}

export interface AdaptersConfig {
  adapters: Record<string, AdapterConfig>;
  roles?: Record<string, RoleConfig>;
}

export interface ConfigInitResult {
  filePath: string;
  created: boolean;
}

export interface ConfigShowResult {
  filePath: string;
  config: AdaptersConfig;
}

export interface AdapterListEntry {
  name: string;
  enabled: boolean;
}

export interface AdaptersListResult {
  adapters: AdapterListEntry[];
}

export interface AdaptersRenderResult {
  slug: string;
  filePath: string;
  content: string;
}

export interface AdaptersDryRunResult {
  slug: string;
  adapter: string;
  command: string;
  args: string[];
}

export interface AdaptersRunResult {
  slug: string;
  adapter: string;
  outputPath: string;
}

const TRACKED_FOLDERS = [
  "intake",
  "proposals",
  "briefs",
  "for-analyst",
  "todo",
  "run",
  "done",
  "reports",
];

/**
 * Counts .md files in a tasks subdirectory.
 * Returns 0 if the folder does not exist.
 */
export function countFilesInFolder(folderPath: string): number {
  if (!fs.existsSync(folderPath)) {
    return 0;
  }

  return fs
    .readdirSync(folderPath)
    .filter((f) => f.endsWith(".md")).length;
}

/**
 * Returns per-folder file counts for all tracked task folders.
 * Missing folders report count = 0.
 */
export function getStatus(): StatusResult {
  const counts = TRACKED_FOLDERS.map((folder) => ({
    folder,
    count: countFilesInFolder(path.join(TASKS_DIR, folder)),
  }));

  return { counts };
}

/**
 * Creates tasks/intake/<slug>-intake.md from the developer-intake-template.
 * Creates tasks/intake/ if it does not exist.
 * Throws if the template is missing.
 */
export function runIntake(slug: string): IntakeResult {
  if (!slug || slug.trim() === "") {
    throw new Error("--slug is required for intake command");
  }

  if (!fs.existsSync(INTAKE_TEMPLATE)) {
    throw new Error(`Intake template not found: ${INTAKE_TEMPLATE}`);
  }

  const intakeDir = path.join(TASKS_DIR, "intake");
  fs.mkdirSync(intakeDir, { recursive: true });

  const destPath = path.join(intakeDir, `${slug}-intake.md`);
  const templateContent = fs.readFileSync(INTAKE_TEMPLATE, "utf-8");
  fs.writeFileSync(destPath, templateContent, "utf-8");

  return { filePath: destPath, slug };
}

const REQUIRED_SECTIONS = [
  "## Context",
  "## Scope",
  "## Acceptance Criteria",
  "## Notes",
  "## PLAN.md Updates",
];

/**
 * Pure lint function — validates prompt markdown content.
 * Returns errors for missing required sections / checklist items,
 * and warnings for missing RoadBoard task references.
 */
export function lintPromptContent(content: string): PromptLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    if (!pattern.test(content)) {
      errors.push(`missing section: ${section}`);
    }
  }

  // Check for at least one checklist item inside the Acceptance Criteria section
  const acMatch = content.match(/## Acceptance Criteria\s*([\s\S]*?)(?=\n## |\s*$)/i);

  if (acMatch) {
    const acBlock = acMatch[1];

    if (!/- \[[ x]\]/i.test(acBlock)) {
      errors.push("missing checklist item in ## Acceptance Criteria");
    }
  }

  // Warning: no RoadBoard task reference found in Context section
  const contextMatch = content.match(/## Context\s*([\s\S]*?)(?=\n## |\s*$)/i);

  if (contextMatch) {
    const contextBlock = contextMatch[1];

    if (!/RoadBoard task/i.test(contextBlock)) {
      warnings.push("no RoadBoard task reference found in ## Context");
    }
  }

  return { errors, warnings };
}

/**
 * Runs lint validation on all .md files in tasks/<dir>/ (default: todo).
 * Prints per-file failures and exits 1 if any errors are found.
 */
export function runLint(dir?: string): LintResult {
  const targetDir = path.basename(dir ?? "todo");
  const folderPath = path.join(TASKS_DIR, targetDir);

  if (!fs.existsSync(folderPath)) {
    return {
      ok: true,
      issues: 0,
      message: `lint: ok (0 issues) — folder tasks/${targetDir} does not exist`,
    };
  }

  const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".md")).sort();
  let totalErrors = 0;
  const lines: string[] = [];

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { errors, warnings } = lintPromptContent(content);

    if (errors.length > 0) {
      totalErrors += errors.length;
      lines.push(`FAIL ${file}: missing sections: ${errors.join(", ")}`);
    }

    if (warnings.length > 0) {
      lines.push(`WARN ${file}: ${warnings.join(", ")}`);
    }
  }

  const ok = totalErrors === 0;
  const summary = `lint: ${ok ? "ok" : "FAIL"} (${totalErrors} error${totalErrors === 1 ? "" : "s"}, ${files.length} file${files.length === 1 ? "" : "s"} checked)`;
  const message = lines.length > 0 ? `${lines.join("\n")}\n${summary}` : summary;

  return { ok, issues: totalErrors, message };
}

/**
 * Returns .md filenames (no path prefix) in a folder whose names contain
 * the slug string (case-insensitive substring match).
 * Returns empty array if the folder does not exist.
 */
function matchingFiles(folder: string, slug: string): string[] {
  if (!fs.existsSync(folder)) {
    return [];
  }

  const lower = slug.toLowerCase();

  return fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".md") && f.toLowerCase().includes(lower))
    .sort();
}

/**
 * Returns all .md filenames in a folder, sorted.
 * Returns empty array if the folder does not exist.
 */
function allMdFiles(folder: string): string[] {
  if (!fs.existsSync(folder)) {
    return [];
  }

  return fs.readdirSync(folder).filter((f) => f.endsWith(".md")).sort();
}

/**
 * Renders a bullet list of filenames with their folder prefix.
 * Falls back to "_none_" when the list is empty.
 */
function renderFileList(folderLabel: string, files: string[]): string {
  if (files.length === 0) {
    return "_none_";
  }

  return files.map((f) => `- \`${folderLabel}/${f}\``).join("\n");
}

/**
 * Creates tasks/reports/<slug>-final-report.md populated with local artifacts.
 *
 * Sections:
 *   - Original Request  — intake/ files matching slug
 *   - Iterations Summary — proposals/ + briefs/ + for-analyst/ files matching slug
 *   - Final Prompts Ready — runReady() output (tasks/todo/ lint-passing files)
 *   - Blocked / Deferred — tasks/run/ files (in-progress)
 *   - GO Checklist — preserved from template
 *
 * Creates tasks/reports/ if it does not exist.
 * Throws if the template is missing.
 */
export function runReport(slug: string): ReportResult {
  if (!slug || slug.trim() === "") {
    throw new Error("--slug is required for report command");
  }

  if (!fs.existsSync(REPORT_TEMPLATE)) {
    throw new Error(`Report template not found: ${REPORT_TEMPLATE}`);
  }

  const reportsDir = path.join(TASKS_DIR, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  // Collect matching files from planning folders
  const intakeFiles = matchingFiles(path.join(TASKS_DIR, "intake"), slug);
  const proposalFiles = matchingFiles(path.join(TASKS_DIR, "proposals"), slug);
  const briefFiles = matchingFiles(path.join(TASKS_DIR, "briefs"), slug);
  const forAnalystFiles = matchingFiles(path.join(TASKS_DIR, "for-analyst"), slug);

  // Ready prompts (lint-passing todo/)
  const readyFiles = runReady().files;

  // In-progress: all files in tasks/run/
  const runFiles = allMdFiles(path.join(TASKS_DIR, "run"));

  // Build sections
  const originalRequestSection = renderFileList("tasks/intake", intakeFiles);

  const iterationParts: string[] = [];

  if (proposalFiles.length > 0) {
    iterationParts.push(`**Proposals**\n\n${renderFileList("tasks/proposals", proposalFiles)}`);
  }

  if (briefFiles.length > 0) {
    iterationParts.push(`**Briefs**\n\n${renderFileList("tasks/briefs", briefFiles)}`);
  }

  if (forAnalystFiles.length > 0) {
    iterationParts.push(`**For-analyst**\n\n${renderFileList("tasks/for-analyst", forAnalystFiles)}`);
  }

  const iterationSection =
    iterationParts.length > 0 ? iterationParts.join("\n\n") : "_none_";

  const readySection = renderFileList("tasks/todo", readyFiles);

  const runSection = renderFileList("tasks/run", runFiles);

  const now = new Date().toISOString().slice(0, 10);

  // Queue snapshot
  const status = getStatus();
  const staleCheck = checkTaskListStale();
  const taskListStatus = !staleCheck.exists
    ? "missing"
    : staleCheck.stale
      ? "stale"
      : "up to date";
  const queueSnapshotLines = status.counts
    .map(({ folder, count }) => `| ${folder} | ${count} |`)
    .join("\n");
  const queueSnapshotSection = [
    `## Queue Snapshot`,
    ``,
    `| Folder | Count |`,
    `|--------|-------|`,
    queueSnapshotLines,
    ``,
    `TASK_LIST.md: ${taskListStatus}`,
  ].join("\n");

  const content = [
    `# Final Report: ${slug}`,
    ``,
    `> Generated on ${now} by \`pnpm agent:workflow report --slug ${slug}\`.`,
    ``,
    queueSnapshotSection,
    ``,
    `## Original Request`,
    ``,
    originalRequestSection,
    ``,
    `## Iterations Summary`,
    ``,
    iterationSection,
    ``,
    `## Prompts Ready for GO`,
    ``,
    readySection,
    ``,
    `## In Progress`,
    ``,
    runSection,
    ``,
    `## Blocked / Deferred`,
    ``,
    `_Prompts or tasks that could not be completed in this cycle, with reason._`,
    ``,
    `| Item | Reason | Owner | Target cycle |`,
    `|------|--------|-------|--------------|`,
    `| | | | |`,
    ``,
    `## Stop-Points Encountered`,
    ``,
    `_Any \`stop-point\` flags that triggered human review during this cycle._`,
    ``,
    `- `,
    ``,
    `## GO Checklist`,
    ``,
    `- [ ] All \`tasks/run/\` prompts resolved (done or failure-noted)`,
    `- [ ] \`pnpm typecheck\` passes`,
    `- [ ] \`pnpm lint\` passes`,
    `- [ ] \`pnpm test\` passes (or known failures documented)`,
    `- [ ] RoadBoard task statuses are current`,
    `- [ ] PLAN.md checkboxes reflect completed work`,
    `- [ ] Handoff created in RoadBoard (\`create_handoff\`)`,
  ].join("\n");

  const destPath = path.join(reportsDir, `${slug}-final-report.md`);
  fs.writeFileSync(destPath, content, "utf-8");

  return { filePath: destPath, slug };
}

/**
 * Lists .md files in tasks/todo/ that pass lint with 0 errors.
 * Returns empty array if folder does not exist.
 */
export function runReady(): ReadyResult {
  const todoDir = path.join(TASKS_DIR, "todo");

  if (!fs.existsSync(todoDir)) {
    return { files: [] };
  }

  const files = fs
    .readdirSync(todoDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .filter((file) => {
      const content = fs.readFileSync(path.join(todoDir, file), "utf-8");
      const { errors } = lintPromptContent(content);

      return errors.length === 0;
    });

  return { files };
}

/** Folders compared for stale detection (subset of TRACKED_FOLDERS). */
const STALE_CHECK_FOLDERS = ["todo", "run", "done"];

/**
 * Returns the newest mtime among all .md files in the given directories.
 * Returns null when no files are found.
 */
function newestMtimeInFolders(tasksDir: string, folders: string[]): Date | null {
  let newest: Date | null = null;

  for (const folder of folders) {
    const folderPath = path.join(tasksDir, folder);

    if (!fs.existsSync(folderPath)) {
      continue;
    }

    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const mtime = fs.statSync(path.join(folderPath, file)).mtime;

      if (newest === null || mtime > newest) {
        newest = mtime;
      }
    }
  }

  return newest;
}

/**
 * Checks whether TASK_LIST.md is stale relative to the most-recently-modified
 * .md file across tasks/todo/, tasks/run/, and tasks/done/.
 *
 * Accepts optional overrides for tasksDir and taskListPath (used in tests).
 */
export function checkTaskListStale(options: {
  tasksDir?: string;
  taskListPath?: string;
} = {}): StaleCheckResult {
  const tasksDir = options.tasksDir ?? TASKS_DIR;
  const taskListPath = options.taskListPath ?? TASK_LIST_PATH;

  if (!fs.existsSync(taskListPath)) {
    return { exists: false, stale: true, taskListMtime: null, newestTaskMtime: null };
  }

  const taskListMtime = fs.statSync(taskListPath).mtime;
  const newestTaskMtime = newestMtimeInFolders(tasksDir, STALE_CHECK_FOLDERS);

  const stale = newestTaskMtime !== null && newestTaskMtime > taskListMtime;

  return { exists: true, stale, taskListMtime, newestTaskMtime };
}

/**
 * Regenerates TASK_LIST.md by calling generateTaskList().
 * Accepts optional overrides for tasksDir and taskListPath (used in tests).
 */
export function runSync(options: {
  tasksDir?: string;
  taskListPath?: string;
} = {}): SyncResult {
  const tasksDir = options.tasksDir ?? TASKS_DIR;
  const taskListPath = options.taskListPath ?? TASK_LIST_PATH;

  const result = generateTaskList({ tasksDir, outputPath: taskListPath });

  return {
    outputPath: result.outputPath,
    run: result.run,
    todo: result.todo,
    done: result.done,
  };
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

const AGENT_DIR = path.join(ROOT, ".agent");
const ADAPTERS_CONFIG_PATH = path.join(AGENT_DIR, "workflow-adapters.json");

/**
 * Loads the local adapters config from .agent/workflow-adapters.json.
 * Returns null if the file does not exist.
 * Never logs the full config contents.
 */
function loadAdaptersConfig(configPath?: string): AdaptersConfig | null {
  const p = configPath ?? ADAPTERS_CONFIG_PATH;

  if (!fs.existsSync(p)) {
    return null;
  }

  const raw = fs.readFileSync(p, "utf-8");

  return JSON.parse(raw) as AdaptersConfig;
}

/**
 * Lists configured adapters and their enabled status.
 * Returns an empty array if no config file is found.
 */
export function adaptersList(options: { configPath?: string } = {}): AdaptersListResult {
  const config = loadAdaptersConfig(options.configPath);

  if (config === null) {
    return { adapters: [] };
  }

  const adapters = Object.entries(config.adapters).map(([name, cfg]) => ({
    name,
    enabled: cfg.enabled,
  }));

  return { adapters };
}

/**
 * Finds a prompt file in tasks/todo/ matching the slug (case-insensitive).
 * Returns the first match or throws if none found.
 */
function findPromptFile(slug: string, tasksDir?: string): string {
  const dir = path.join(tasksDir ?? TASKS_DIR, "todo");
  const files = matchingFiles(dir, slug);

  if (files.length === 0) {
    throw new Error(`No prompt file found in tasks/todo/ matching slug: "${slug}"`);
  }

  return path.join(dir, files[0]);
}

/**
 * Renders the prompt content for a given slug to a string.
 * Does not invoke any binary.
 */
export function adaptersRender(
  slug: string,
  options: { tasksDir?: string } = {},
): AdaptersRenderResult {
  if (!slug || slug.trim() === "") {
    throw new Error("--slug is required for adapters render");
  }

  const filePath = findPromptFile(slug, options.tasksDir);
  const content = fs.readFileSync(filePath, "utf-8");

  return { slug, filePath, content };
}

/**
 * Produces the CLI command that would be invoked for a given slug/adapter pair.
 * Does not execute anything.
 */
export function adaptersDryRun(
  slug: string,
  adapterName: string,
  options: { configPath?: string; tasksDir?: string } = {},
): AdaptersDryRunResult {
  if (!slug || slug.trim() === "") {
    throw new Error("--slug is required for adapters dry-run");
  }

  if (!adapterName || adapterName.trim() === "") {
    throw new Error("--adapter is required for adapters dry-run");
  }

  const config = loadAdaptersConfig(options.configPath);
  const filePath = findPromptFile(slug, options.tasksDir);

  if (config === null || !config.adapters[adapterName]) {
    // Even without config we can show the hypothetical command shape
    return {
      slug,
      adapter: adapterName,
      command: "<binary>",
      args: [filePath],
    };
  }

  const adapterCfg = config.adapters[adapterName];

  return {
    slug,
    adapter: adapterName,
    command: adapterCfg.binary,
    args: [filePath],
  };
}

/**
 * Invokes the configured CLI binary with the prompt file as argument.
 * Requires both --execute flag AND enabled: true in .agent/workflow-adapters.json.
 * Saves output to tasks/reports/<slug>-<adapter>-output.md.
 */
export function adaptersRun(
  slug: string,
  adapterName: string,
  execute: boolean,
  options: { configPath?: string; tasksDir?: string } = {},
): AdaptersRunResult {
  if (!slug || slug.trim() === "") {
    throw new Error("--slug is required for adapters run");
  }

  if (!adapterName || adapterName.trim() === "") {
    throw new Error("--adapter is required for adapters run");
  }

  if (!execute) {
    throw new Error(
      "Safety gate: pass --execute to actually invoke the adapter. " +
      "Use `adapters dry-run` to preview the command without executing.",
    );
  }

  const config = loadAdaptersConfig(options.configPath);

  if (config === null) {
    throw new Error(
      "No adapter config found. Create .agent/workflow-adapters.json with enabled: true to proceed.",
    );
  }

  const adapterCfg = config.adapters[adapterName];

  if (!adapterCfg) {
    throw new Error(
      `Adapter "${adapterName}" not found in config. ` +
      "Check .agent/workflow-adapters.json.",
    );
  }

  // Only log the enabled field — never the full config
  if (!adapterCfg.enabled) {
    throw new Error(
      `Adapter "${adapterName}" is disabled (enabled: false). ` +
      "Set enabled: true in .agent/workflow-adapters.json to proceed.",
    );
  }

  const filePath = findPromptFile(slug, options.tasksDir);
  const tasksDir = options.tasksDir ?? TASKS_DIR;
  const reportsDir = path.join(tasksDir, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const outputPath = path.join(reportsDir, `${slug}-${adapterName}-output.md`);

  // Use execFileSync to avoid shell injection — binary path must be absolute
  const output = child_process.execFileSync(adapterCfg.binary, [filePath], {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });

  fs.writeFileSync(outputPath, output, "utf-8");

  return { slug, adapter: adapterName, outputPath };
}


const STARTER_CONFIG: AdaptersConfig = {
  adapters: {},
  roles: {
    analyst: {
      binary: "codex",
      model: "chatgpt-4.5",
      flags: [],
      systemPromptPath: "docs/templates/analyst-system-prompt.md",
    },
    architect: {
      binary: "claude",
      model: "opus",
      flags: ["--dangerously-skip-permissions"],
      systemPromptPath: "docs/templates/architect-system-prompt.md",
    },
  },
};

/**
 * Creates .agent/workflow-adapters.json with a starter config.
 * Throws if the file already exists.
 */
export function configInit(options: { configPath?: string; agentDir?: string } = {}): ConfigInitResult {
  const agentDir = options.agentDir ?? AGENT_DIR;
  const filePath = options.configPath ?? path.join(agentDir, "workflow-adapters.json");

  if (fs.existsSync(filePath)) {
    throw new Error(
      `Config already exists at ${filePath}. ` +
      "Remove it manually before re-initialising.",
    );
  }

  fs.mkdirSync(agentDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(STARTER_CONFIG, null, 2) + "\n", "utf-8");

  return { filePath, created: true };
}

/**
 * Reads and returns the current .agent/workflow-adapters.json.
 * Throws if the file does not exist.
 */
export function configShow(options: { configPath?: string } = {}): ConfigShowResult {
  const filePath = options.configPath ?? ADAPTERS_CONFIG_PATH;

  if (!fs.existsSync(filePath)) {
    throw new Error(`No config file found at ${filePath}. Run \`config --init\` first.`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const config = JSON.parse(raw) as AdaptersConfig;

  return { filePath, config };
}


// ---------------------------------------------------------------------------
// Loop runner — Analyst ↔ Architect
// ---------------------------------------------------------------------------

export interface RunLoopOptions {
  tasksDir?: string;
  configPath?: string;
  templatesDir?: string;
  execFn?: (binary: string, args: string[], opts: object) => string;
  promptFn?: () => string;
  dryRun?: boolean;
  planningOnly?: boolean;
  maxIterations?: number;
  pauseEvery?: number;
  logFn?: (msg: string) => void;
}

export interface RunLoopResult {
  converged: boolean;
  iterations: number;
  stoppedByUser: boolean;
  todoFiles: string[];
  reason: string;
}


const DEFAULT_MAX_ITERATIONS = 50;
const DEFAULT_PAUSE_EVERY = 10;


function readFileIfExists(p: string): string | null {
  if (!fs.existsSync(p)) {
    return null;
  }

  return fs.readFileSync(p, "utf-8");
}


function listFilesMatching(dir: string, pattern: RegExp): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((f) => pattern.test(f))
    .sort();
}


function readlineDefault(): string {
  // Synchronous read of a single line from stdin (used in real CLI runs only).
  // Tests inject promptFn so this path is never hit under vitest.
  try {
    const buf = fs.readFileSync(0, "utf-8");

    return buf.split("\n")[0]?.trim() ?? "";
  }

  catch {
    return "";
  }
}


function buildAnalystPrompt(args: {
  systemPrompt: string;
  intake: string;
  forAnalystSnippets: { file: string; content: string }[];
  slug: string;
  iteration: number;
}): string {
  const exchanges = args.forAnalystSnippets.length === 0
    ? "(none)"
    : args.forAnalystSnippets
        .map((s) => `---\n# ${s.file}\n${s.content}`)
        .join("\n\n");

  return [
    args.systemPrompt,
    "",
    "---",
    "## Intake",
    args.intake,
    "",
    "## Previous Analyst↔Architect exchanges",
    exchanges,
    "",
    "## Instructions",
    `Write your planning brief to: tasks/briefs/${args.slug}-brief-v${args.iteration}.md`,
    `where N is the current iteration number (${args.iteration}).`,
  ].join("\n");
}


function buildArchitectPrompt(args: {
  systemPrompt: string;
  brief: string;
  todoListing: string;
  slug: string;
  iteration: number;
  planningOnly: boolean;
}): string {
  const instructions = args.planningOnly
    ? [
        "Planning-only mode is active.",
        `If you have questions for Analyst: write to tasks/for-analyst/${args.slug}-q${args.iteration}.md`,
        `If analysis is ready for Developer review: write a proposal to tasks/proposals/${args.slug}-proposal-v${args.iteration}.md`,
        `Then write tasks/.convergence-${args.slug}`,
        `  with JSON content: {"slug":"${args.slug}","iteration":${args.iteration},"mode":"planning-only"}`,
        "Do NOT write Worker prompts.",
        "Do NOT write to tasks/todo/.",
        "Do NOT write to both for-analyst/ and .convergence-<slug> in the same iteration.",
      ]
    : [
        `If you have questions for Analyst: write to tasks/for-analyst/${args.slug}-q${args.iteration}.md`,
        `If prompts are ready: write them to tasks/todo/ and write tasks/.convergence-${args.slug}`,
        `  with JSON content: {"slug":"${args.slug}","iteration":${args.iteration}}`,
        "Do NOT write to both for-analyst/ and .convergence-<slug> in the same iteration.",
      ];

  return [
    args.systemPrompt,
    "",
    "---",
    "## Planning Brief (latest)",
    args.brief,
    "",
    "## Current tasks/todo/ state",
    args.todoListing,
    "",
    "## Instructions",
    ...instructions,
  ].join("\n");
}


/**
 * Orchestrates the Analyst ↔ Architect planning loop.
 * Pure & testable: pass execFn / promptFn / tasksDir / configPath to override
 * filesystem and subprocess interactions.
 */
export function runLoop(slug: string, options: RunLoopOptions = {}): RunLoopResult {
  if (!slug || slug.trim() === "") {
    throw new Error("--slug is required for run command");
  }

  const tasksDir = options.tasksDir ?? TASKS_DIR;
  const configPath = options.configPath ?? ADAPTERS_CONFIG_PATH;
  const templatesDir = options.templatesDir ?? TEMPLATES_DIR;
  const execFn = options.execFn ?? ((binary, args, opts) =>
    child_process.execFileSync(binary, args, { ...opts, encoding: "utf-8" }) as string);
  const promptFn = options.promptFn ?? readlineDefault;
  const log = options.logFn ?? ((msg: string) => console.log(msg));
  const dryRun = options.dryRun ?? false;
  const planningOnly = options.planningOnly ?? false;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const pauseEvery = options.pauseEvery ?? DEFAULT_PAUSE_EVERY;

  // --- 1. Validate intake ----------------------------------------------------
  const intakePath = path.join(tasksDir, "intake", `${slug}-intake.md`);

  if (!fs.existsSync(intakePath)) {
    throw new Error(
      `Intake file not found: ${intakePath}. ` +
      `Run \`pnpm agent:workflow intake --slug ${slug}\` first.`,
    );
  }

  const intake = fs.readFileSync(intakePath, "utf-8");

  // --- 2. Validate config ----------------------------------------------------
  const config = loadAdaptersConfig(configPath);

  if (config === null) {
    throw new Error(
      `No config file found at ${configPath}. ` +
      `Run \`pnpm agent:workflow config --init\` first.`,
    );
  }

  if (!config.roles || !config.roles.analyst || !config.roles.architect) {
    throw new Error(
      "Config is missing required roles. " +
      "Ensure .agent/workflow-adapters.json has roles.analyst and roles.architect. " +
      "Run `pnpm agent:workflow config --init` to scaffold a starter config.",
    );
  }

  const analystRole = config.roles.analyst;
  const architectRole = config.roles.architect;

  // --- 3. Load system prompt templates --------------------------------------
  const analystPromptPath = analystRole.systemPromptPath
    ? path.resolve(ROOT, analystRole.systemPromptPath)
    : path.join(templatesDir, "analyst-system-prompt.md");
  const architectPromptPath = architectRole.systemPromptPath
    ? path.resolve(ROOT, architectRole.systemPromptPath)
    : path.join(templatesDir, "architect-system-prompt.md");

  const analystSystemPrompt = readFileIfExists(analystPromptPath) ?? "";
  const architectSystemPrompt = readFileIfExists(architectPromptPath) ?? "";

  // --- 4. Loop ---------------------------------------------------------------
  const briefsDir = path.join(tasksDir, "briefs");
  const forAnalystDir = path.join(tasksDir, "for-analyst");
  const todoDir = path.join(tasksDir, "todo");
  const convergenceFile = path.join(tasksDir, `.convergence-${slug}`);

  fs.mkdirSync(briefsDir, { recursive: true });
  fs.mkdirSync(forAnalystDir, { recursive: true });
  fs.mkdirSync(todoDir, { recursive: true });

  const briefPattern = new RegExp(`^${slug}-brief-.*\\.md$`);
  const forAnalystPattern = new RegExp(`^${slug}-.*\\.md$`);

  let iteration = 0;
  let converged = false;
  let stoppedByUser = false;
  let reason = "";

  let prevTodoCount = listFilesMatching(todoDir, /\.md$/).length;
  let prevForAnalystCount = listFilesMatching(forAnalystDir, forAnalystPattern).length;

  while (iteration < maxIterations) {
    iteration += 1;

    // --- Analyst turn -------------------------------------------------------
    const forAnalystFiles = listFilesMatching(forAnalystDir, forAnalystPattern);
    const forAnalystSnippets = forAnalystFiles.map((f) => ({
      file: f,
      content: fs.readFileSync(path.join(forAnalystDir, f), "utf-8"),
    }));

    const analystPrompt = buildAnalystPrompt({
      systemPrompt: analystSystemPrompt,
      intake,
      forAnalystSnippets,
      slug,
      iteration,
    });
    const analystArgs = [...(analystRole.flags ?? []), analystPrompt];

    if (dryRun) {
      log(`[dry-run] iteration ${iteration} analyst: ${analystRole.binary} ${(analystRole.flags ?? []).join(" ")} <prompt:${analystPrompt.length} chars>`);
    }

    else {
      log(`[iter ${iteration}] invoking analyst (${analystRole.binary})`);
      execFn(analystRole.binary, analystArgs, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    }

    // Detect new brief
    const briefFiles = listFilesMatching(briefsDir, briefPattern);

    if (briefFiles.length === 0 && !dryRun) {
      log(`[iter ${iteration}] WARN: Analyst did not produce a brief in tasks/briefs/`);
    }

    // Analyst wrote convergence marker → brief is ready, delete marker and proceed to Architect
    if (fs.existsSync(convergenceFile)) {
      fs.unlinkSync(convergenceFile);
      log(`[iter ${iteration}] Analyst signalled brief ready, proceeding to Architect`);
    }

    // --- Architect turn -----------------------------------------------------
    const latestBrief = briefFiles.length > 0
      ? fs.readFileSync(path.join(briefsDir, briefFiles[briefFiles.length - 1]), "utf-8")
      : "(no brief available yet)";
    const todoListing = (() => {
      const list = listFilesMatching(todoDir, /\.md$/);

      return list.length === 0 ? "(empty)" : list.map((f) => `- ${f}`).join("\n");
    })();

    const architectPrompt = buildArchitectPrompt({
      systemPrompt: architectSystemPrompt,
      brief: latestBrief,
      todoListing,
      slug,
      iteration,
      planningOnly,
    });
    const architectArgs = [...(architectRole.flags ?? []), architectPrompt];

    if (dryRun) {
      log(`[dry-run] iteration ${iteration} architect: ${architectRole.binary} ${(architectRole.flags ?? []).join(" ")} <prompt:${architectPrompt.length} chars>`);
    }

    else {
      log(`[iter ${iteration}] invoking architect (${architectRole.binary})`);
      execFn(architectRole.binary, architectArgs, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    }

    // --- Convergence check --------------------------------------------------
    if (fs.existsSync(convergenceFile)) {
      converged = true;
      reason = "convergence file written";
      break;
    }

    const currentTodoCount = listFilesMatching(todoDir, /\.md$/).length;
    const currentForAnalystCount = listFilesMatching(forAnalystDir, forAnalystPattern).length;

    if (planningOnly && currentTodoCount > prevTodoCount) {
      throw new Error(
        `Planning-only mode violation: new tasks/todo/ file appeared for slug "${slug}". ` +
        "Inspect and remove the Worker prompt before continuing.",
      );
    }

    // Implicit convergence: new todo file appeared, no new for-analyst file
    if (!planningOnly && currentTodoCount > prevTodoCount && currentForAnalystCount <= prevForAnalystCount) {
      converged = true;
      reason = "implicit convergence (new todo without new for-analyst)";
      log(`[iter ${iteration}] WARN: implicit convergence detected (no explicit .convergence-${slug} file)`);
      break;
    }

    prevTodoCount = currentTodoCount;
    prevForAnalystCount = currentForAnalystCount;

    // --- Dry-run early exit -------------------------------------------------
    if (dryRun) {
      reason = "dry-run completed one iteration";
      break;
    }

    // --- Interactive pause --------------------------------------------------
    if (iteration % pauseEvery === 0) {
      const briefsNow = listFilesMatching(briefsDir, briefPattern).length;
      const forAnalystNow = listFilesMatching(forAnalystDir, forAnalystPattern).length;
      const todoNow = listFilesMatching(todoDir, /\.md$/).length;
      log(
        `\n[pause @ iter ${iteration}] briefs=${briefsNow} for-analyst=${forAnalystNow} todo=${todoNow}\n` +
        `Continue or stop? [c]ontinue / [s]top: `,
      );
      const answer = promptFn().toLowerCase();

      if (answer === "s" || answer === "stop") {
        stoppedByUser = true;
        reason = "user stopped the loop";
        break;
      }
    }
  }

  if (!converged && !stoppedByUser && iteration >= maxIterations) {
    throw new Error(
      `Safety cap reached: loop ran ${maxIterations} iterations without convergence for slug "${slug}". ` +
      `Inspect tasks/for-analyst/ and tasks/briefs/ for the current state.`,
    );
  }

  const todoFiles = listFilesMatching(todoDir, /\.md$/);

  return {
    converged,
    iterations: iteration,
    stoppedByUser,
    todoFiles,
    reason,
  };
}


function printStatus(result: StatusResult): void {
  console.log("Task folder counts:");

  for (const { folder, count } of result.counts) {
    console.log(`  ${folder.padEnd(12)} ${count}`);
  }

  const stale = checkTaskListStale();

  if (!stale.exists) {
    console.log("TASK_LIST.md: missing");
  }

  else if (stale.stale) {
    const dateStr = stale.taskListMtime
      ? stale.taskListMtime.toISOString().replace("T", " ").slice(0, 19) + " UTC"
      : "unknown";
    console.log(`TASK_LIST.md: stale (last updated ${dateStr})`);
  }

  else {
    console.log("TASK_LIST.md: up to date");
  }
}

function parseArgs(argv: string[]): {
  command: string;
  subcommand?: string;
  slug?: string;
  dir?: string;
  adapter?: string;
  execute?: boolean;
  init?: boolean;
  show?: boolean;
  dryRun?: boolean;
  planningOnly?: boolean;
} {
  const [, , command = "", subcommandOrFlag = "", ...rest] = argv;

  // If command is "adapters", first positional is the subcommand
  let subcommand: string | undefined;
  let remaining: string[];

  if (command === "adapters" && !subcommandOrFlag.startsWith("--")) {
    subcommand = subcommandOrFlag;
    remaining = rest;
  }

  else {
    remaining = subcommandOrFlag ? [subcommandOrFlag, ...rest] : rest;
  }

  let slug: string | undefined;
  let dir: string | undefined;
  let adapter: string | undefined;
  let execute = false;
  let init = false;
  let show = false;
  let dryRun = false;
  let planningOnly = false;

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i] === "--slug" && remaining[i + 1]) {
      slug = remaining[i + 1];
      i++;
    }

    else if (remaining[i] === "--dir" && remaining[i + 1]) {
      dir = remaining[i + 1];
      i++;
    }

    else if (remaining[i] === "--adapter" && remaining[i + 1]) {
      adapter = remaining[i + 1];
      i++;
    }

    else if (remaining[i] === "--execute") {
      execute = true;
    }

    else if (remaining[i] === "--init") {
      init = true;
    }

    else if (remaining[i] === "--show") {
      show = true;
    }

    else if (remaining[i] === "--dry-run") {
      dryRun = true;
    }

    else if (remaining[i] === "--planning-only") {
      planningOnly = true;
    }
  }

  return { command, subcommand, slug, dir, adapter, execute, init, show, dryRun, planningOnly };
}

function main(): void {
  if (process.argv[2] === "--version" || process.argv[2] === "-v") {
    process.stdout.write(`agent-workflow ${readPackageVersion()}\n`);
    return;
  }

  const { command, subcommand, slug, dir, adapter, execute, init, show, dryRun, planningOnly } = parseArgs(process.argv);

  try {
    if (command === "status") {
      printStatus(getStatus());
    }

    else if (command === "intake") {
      const result = runIntake(slug ?? "");
      console.log(`Created: ${result.filePath}`);
    }

    else if (command === "lint") {
      const result = runLint(dir);
      console.log(result.message);

      if (!result.ok) {
        process.exit(1);
      }
    }

    else if (command === "report") {
      const result = runReport(slug ?? "");
      console.log(`Created: ${result.filePath}`);
    }

    else if (command === "ready") {
      const result = runReady();

      if (result.files.length === 0) {
        console.log("No prompts in tasks/todo/");
      }

      else {
        console.log("Prompts ready in tasks/todo/:");

        for (const f of result.files) {
          console.log(`  ${f}`);
        }
      }
    }

    else if (command === "sync") {
      const before = checkTaskListStale();
      const result = runSync();
      const after = checkTaskListStale();
      console.log(
        `TASK_LIST.md regenerated: ${result.outputPath}` +
        ` (run=${result.run}, todo=${result.todo}, done=${result.done})`,
      );

      if (!before.exists) {
        console.log("  Created (file did not exist before)");
      }

      else if (before.stale && !after.stale) {
        console.log("  Was stale — now up to date");
      }

      else {
        console.log("  Was already up to date");
      }
    }

    else if (command === "adapters") {
      if (subcommand === "list") {
        const result = adaptersList();

        if (result.adapters.length === 0) {
          console.log("no adapters configured");
        }

        else {
          console.log("Configured adapters:");

          for (const { name, enabled } of result.adapters) {
            console.log(`  ${name.padEnd(16)} enabled: ${enabled}`);
          }
        }
      }

      else if (subcommand === "render") {
        const result = adaptersRender(slug ?? "");
        process.stdout.write(result.content);
      }

      else if (subcommand === "dry-run") {
        const result = adaptersDryRun(slug ?? "", adapter ?? "");
        const cmdStr = [result.command, ...result.args].join(" ");
        console.log(`Would invoke: ${cmdStr}`);
      }

      else if (subcommand === "run") {
        const result = adaptersRun(slug ?? "", adapter ?? "", execute ?? false);
        console.log(`Output saved: ${result.outputPath}`);
      }

      else {
        console.error(
          `Unknown adapters subcommand: "${subcommand ?? ""}"\n` +
          `Usage: pnpm agent:workflow adapters <list|render|dry-run|run> [--slug <slug>] [--adapter <name>] [--execute]`,
        );
        process.exit(1);
      }
    }

    else if (command === "run") {
      const result = runLoop(slug ?? "", { dryRun, planningOnly });

      if (result.converged) {
        console.log(`\nConverged after ${result.iterations} iteration(s): ${result.reason}`);
        console.log(`\nPrompts in tasks/todo/:`);

        if (result.todoFiles.length === 0) {
          console.log("  (none)");
        }

        else {
          for (const f of result.todoFiles) {
            console.log(`  ${f}`);
          }
        }

        console.log(`\nRun: pnpm agent:workflow ready`);
      }

      else if (result.stoppedByUser) {
        console.log(`\nLoop interrotto manualmente. Controlla tasks/for-analyst/ per lo stato corrente.`);
      }

      else {
        console.log(`\nLoop ended after ${result.iterations} iteration(s): ${result.reason}`);
      }
    }

    else if (command === "config") {
      if (init) {
        const result = configInit();
        console.log(`Created: ${result.filePath}`);
      }

      else if (show) {
        const result = configShow();
        process.stdout.write(JSON.stringify(result.config, null, 2) + "\n");
      }

      else {
        console.error(
          `Usage: pnpm agent:workflow config <--init | --show>`,
        );
        process.exit(1);
      }
    }

    else {
      console.error(
        `Unknown command: "${command}"\n` +
        `Usage: pnpm agent:workflow <status|intake|lint|report|ready|sync|adapters|config|run> [--slug <slug>] [--dir <dir>] [--dry-run]`,
      );
      process.exit(1);
    }
  }

  catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("agent-workflow.ts") ||
    process.argv[1].endsWith("agent-workflow.js"));

if (isMain) {
  main();
}
