#!/usr/bin/env node
/**
 * agent-workflow.ts — CLI for the AI Workflow pipeline (Analyst review-gate model).
 *
 * Paradigm: exactly three lifecycle folders — tasks/todo/, tasks/run/, tasks/done/.
 * The Analyst review happens INSIDE the prompt file via YAML frontmatter
 * (status, review_round) and an append-only "## Review log" section.
 * A prompt is spawnable only when `status: approved`.
 *
 * Subcommands: status, lint, ready, sync, review, run, review-output, promote, adapters, config
 * Run via: pnpm agent:workflow <command> [options]
 *
 * OUTPUT-GATE: run→done is gated. The Worker no longer closes its own task; on
 * completion it sets `output_status: pending`. An Analyst then reviews the diff
 * (`review-output`), and only `promote` — the single run→done path — moves the
 * file to done/, and only after (a) output_status:approved, (b) a re-executed
 * build+tests that exit 0, and (c) evidence when required.
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

/** The three lifecycle folders — the single source of truth for task state. */
const LIFECYCLE_FOLDERS = ["todo", "run", "done"] as const;


/** Prompt files are lifecycle .md files; Worker output artifacts (`-output.md`) are not prompts. */
function isPromptFileName(fileName: string): boolean {
  return fileName.endsWith(".md") && !fileName.endsWith("-output.md");
}

/** Valid frontmatter status values. A prompt is spawnable only when `approved`. */
export const PROMPT_STATUSES = [
  "draft",
  "in-review",
  "changes-requested",
  "approved",
  "blocked-review",
] as const;

export type PromptStatus = (typeof PROMPT_STATUSES)[number];

/**
 * Valid `output_status` values — the result-side gate for a prompt in run/.
 * A prompt may be promoted (run→done) only when `output_status: approved`.
 * `blocked-review` mirrors the review-round cap in runReviewOutput.
 */
export const OUTPUT_STATUSES = [
  "none",
  "pending",
  "approved",
  "changes-requested",
  "blocked-review",
] as const;

export type OutputStatus = (typeof OUTPUT_STATUSES)[number];

/** Valid values for the build/tests fields of the verification block. */
export const VERIFICATION_STATES = ["unknown", "pass", "fail"] as const;

export type VerificationState = (typeof VERIFICATION_STATES)[number];

export interface Verification {
  build: VerificationState;
  tests: VerificationState;
  evidence: string;
}

export interface FolderCount {
  folder: string;
  count: number;
}

export interface OutputStatusCounts {
  pending: number;
  approved: number;
  "changes-requested": number;
}

export interface StatusResult {
  counts: FolderCount[];
  runOutput: OutputStatusCounts;
}

export interface PromptFrontmatter {
  status: PromptStatus | null;
  reviewRound: number | null;
  outputStatus: OutputStatus | null;
  outputRound: number | null;
  verification: Verification | null;
  raw: Record<string, string>;
}

export interface ParsedPrompt {
  frontmatter: PromptFrontmatter;
  body: string;
  hasFrontmatter: boolean;
}

export interface PromptLintResult {
  errors: string[];
  warnings: string[];
}

export interface FileLintResult {
  file: string;
  status: PromptStatus | null;
  spawnable: boolean;
  errors: string[];
  warnings: string[];
}

export interface LintResult {
  ok: boolean;
  issues: number;
  message: string;
  files: FileLintResult[];
}

export interface ReadyEntry {
  file: string;
  status: PromptStatus | null;
}

export interface ReadyResult {
  approved: ReadyEntry[];
  pending: ReadyEntry[];
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

export interface VerifyConfig {
  build?: string;
  tests?: string;
}

export interface AdaptersConfig {
  adapters: Record<string, AdapterConfig>;
  roles?: Record<string, RoleConfig>;
  verify?: VerifyConfig;
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
    .filter(isPromptFileName).length;
}

/**
 * Returns per-folder file counts for the three lifecycle folders.
 * Missing folders report count = 0.
 */
export function getStatus(options: { tasksDir?: string } = {}): StatusResult {
  const tasksDir = options.tasksDir ?? TASKS_DIR;
  const counts = LIFECYCLE_FOLDERS.map((folder) => ({
    folder,
    count: countFilesInFolder(path.join(tasksDir, folder)),
  }));

  return { counts, runOutput: countRunOutputStatuses(tasksDir) };
}

/**
 * Tallies the `output_status` of prompts currently in run/. Only the three
 * "live" output states are surfaced (pending / approved / changes-requested);
 * `none` and `blocked-review` are not counted here.
 */
export function countRunOutputStatuses(tasksDir?: string): OutputStatusCounts {
  const runDir = path.join(tasksDir ?? TASKS_DIR, "run");
  const counts: OutputStatusCounts = { pending: 0, approved: 0, "changes-requested": 0 };

  if (!fs.existsSync(runDir)) {
    return counts;
  }

  for (const file of fs.readdirSync(runDir).filter(isPromptFileName)) {
    const parsed = parsePrompt(fs.readFileSync(path.join(runDir, file), "utf-8"));
    const os = parsed.frontmatter.outputStatus;

    if (os === "pending" || os === "approved" || os === "changes-requested") {
      counts[os]++;
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Prompt parsing — frontmatter + body
// ---------------------------------------------------------------------------

/**
 * Parses YAML frontmatter (a leading `---` ... `---` block) plus the body.
 * Flat `key: value` pairs are captured in `raw`. One level of nesting is
 * recognised for the `verification:` map (its `build`/`tests`/`evidence` keys),
 * enough for status/review_round and the output-gate fields.
 */
export function parsePrompt(content: string): ParsedPrompt {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!fmMatch) {
    return {
      frontmatter: {
        status: null,
        reviewRound: null,
        outputStatus: null,
        outputRound: null,
        verification: null,
        raw: {},
      },
      body: content,
      hasFrontmatter: false,
    };
  }

  const raw: Record<string, string> = {};
  const fmBlock = fmMatch[1];
  const clean = (v: string): string =>
    v.replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "").trim();

  // Nested `verification:` map — collected from indented child lines.
  let verification: Verification | null = null;
  let inVerification = false;

  for (const line of fmBlock.split(/\r?\n/)) {
    // A top-level `verification:` header with no inline value opens the block.
    if (/^verification\s*:\s*$/.test(line)) {
      inVerification = true;
      verification = { build: "unknown", tests: "unknown", evidence: "" };
      continue;
    }

    // Indented child of the verification block: `  build: pass`
    const child = line.match(/^\s+([A-Za-z0-9_]+)\s*:\s*(.*?)\s*$/);

    if (inVerification && child) {
      const key = child[1];
      const val = clean(child[2]);

      if (verification && (key === "build" || key === "tests" || key === "evidence")) {
        if (key === "evidence") {
          verification.evidence = val;
        }

        else {
          verification[key] = (VERIFICATION_STATES as readonly string[]).includes(val)
            ? (val as VerificationState)
            : "unknown";
        }
      }

      continue;
    }

    // Any non-indented line ends the verification block.
    inVerification = false;

    const kv = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(.*?)\s*$/);

    if (kv) {
      raw[kv[1]] = clean(kv[2]);
    }
  }

  const statusRaw = raw["status"] ?? null;
  const status =
    statusRaw !== null && (PROMPT_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as PromptStatus)
      : null;

  const roundRaw = raw["review_round"];
  const reviewRound =
    roundRaw !== undefined && /^\d+$/.test(roundRaw) ? Number.parseInt(roundRaw, 10) : null;

  const outStatusRaw = raw["output_status"] ?? null;
  const outputStatus =
    outStatusRaw !== null && (OUTPUT_STATUSES as readonly string[]).includes(outStatusRaw)
      ? (outStatusRaw as OutputStatus)
      : null;

  const outRoundRaw = raw["output_round"];
  const outputRound =
    outRoundRaw !== undefined && /^\d+$/.test(outRoundRaw) ? Number.parseInt(outRoundRaw, 10) : null;

  return {
    frontmatter: { status, reviewRound, outputStatus, outputRound, verification, raw },
    body: fmMatch[2],
    hasFrontmatter: true,
  };
}

const REQUIRED_SECTIONS = ["## Context", "## Scope", "## Acceptance criteria"];

/**
 * Pure lint function — validates a prompt against the review-gate shape.
 *
 * Errors:
 *   - missing or malformed frontmatter
 *   - missing / invalid `status`
 *   - missing / invalid `review_round`
 *   - missing required sections (Context, Scope, Acceptance criteria)
 *   - empty or missing checklist in Acceptance criteria
 *   - malformed Review log (present but with no recognisable round)
 *
 * Warnings:
 *   - no RoadBoard task reference in Context
 *   - no Review log yet while status is past `draft`
 */
export function lintPromptContent(content: string): PromptLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = parsePrompt(content);

  // --- Frontmatter -----------------------------------------------------------
  if (!parsed.hasFrontmatter) {
    errors.push("missing YAML frontmatter (--- ... ---)");
  }

  if (parsed.frontmatter.raw["status"] === undefined) {
    errors.push("missing frontmatter field: status");
  }

  else if (parsed.frontmatter.status === null) {
    errors.push(
      `invalid frontmatter status: "${parsed.frontmatter.raw["status"]}" ` +
      `(expected one of: ${PROMPT_STATUSES.join(", ")})`,
    );
  }

  if (parsed.frontmatter.raw["review_round"] === undefined) {
    errors.push("missing frontmatter field: review_round");
  }

  else if (parsed.frontmatter.reviewRound === null) {
    errors.push(
      `invalid frontmatter review_round: "${parsed.frontmatter.raw["review_round"]}" (expected a non-negative integer)`,
    );
  }

  // --- Required sections -----------------------------------------------------
  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp("^" + section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "im");

    if (!pattern.test(content)) {
      errors.push(`missing section: ${section}`);
    }
  }

  // At least one checklist item inside Acceptance criteria
  const acMatch = content.match(/## Acceptance criteria\s*([\s\S]*?)(?=\n## |\s*$)/i);

  if (acMatch) {
    const acBlock = acMatch[1];

    if (!/- \[[ x]\]/i.test(acBlock)) {
      errors.push("missing checklist item in ## Acceptance criteria");
    }
  }

  // --- Review log ------------------------------------------------------------
  // Anchored to line start: inline mentions like `## Review log` in prose
  // must not be mistaken for the section heading.
  // The end-anchor is (?![\s\S]) (absolute end of string) — with the m flag,
  // \s*$ would match at the first line end and always capture an empty block.
  const reviewLogMatch = content.match(/^## Review log\s*([\s\S]*?)(?=\n## |(?![\s\S]))/im);

  if (reviewLogMatch) {
    const logBlock = reviewLogMatch[1];

    // A well-formed log has at least one round heading: "### Round N — <verdict>"
    if (!/###\s+Round\s+\d+\s*[—-]/i.test(logBlock)) {
      errors.push(
        "malformed ## Review log: expected at least one '### Round N — <verdict>' entry",
      );
    }
  }

  else if (parsed.frontmatter.status !== null && parsed.frontmatter.status !== "draft") {
    warnings.push(
      `status is "${parsed.frontmatter.status}" but no ## Review log section is present`,
    );
  }

  // --- Output-gate fields (optional) -----------------------------------------
  // output_status: validate only when present.
  if (parsed.frontmatter.raw["output_status"] !== undefined && parsed.frontmatter.outputStatus === null) {
    errors.push(
      `invalid frontmatter output_status: "${parsed.frontmatter.raw["output_status"]}" ` +
      `(expected one of: ${OUTPUT_STATUSES.join(", ")})`,
    );
  }

  // output_round: validate only when present.
  if (parsed.frontmatter.raw["output_round"] !== undefined && parsed.frontmatter.outputRound === null) {
    errors.push(
      `invalid frontmatter output_round: "${parsed.frontmatter.raw["output_round"]}" (expected a non-negative integer)`,
    );
  }

  // verification: when the block is present, build/tests must be valid states.
  // Read the raw frontmatter lines (the parser coerces unknowns to "unknown",
  // so validate against the source text to catch typos like `build: green`).
  const fmForVerify = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (fmForVerify && /^verification\s*:\s*$/m.test(fmForVerify[1])) {
    for (const field of ["build", "tests"] as const) {
      const line = fmForVerify[1].match(new RegExp(`^\\s+${field}\\s*:\\s*(.*?)\\s*$`, "m"));

      if (line) {
        const val = line[1].replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "").trim();

        if (!(VERIFICATION_STATES as readonly string[]).includes(val)) {
          errors.push(
            `invalid verification.${field}: "${val}" (expected one of ${VERIFICATION_STATES.join(", ")})`,
          );
        }
      }
    }
  }

  // ## Output review log — when present, must have at least one round heading.
  const outputLogMatch = content.match(/^## Output review log\s*([\s\S]*?)(?=\n## |(?![\s\S]))/im);

  if (outputLogMatch) {
    if (!/###\s+Round\s+\d+\s*[—-]/i.test(outputLogMatch[1])) {
      errors.push(
        "malformed ## Output review log: expected at least one '### Round N — <verdict>' entry",
      );
    }
  }

  // --- Warnings --------------------------------------------------------------
  const contextMatch = content.match(/## Context\s*([\s\S]*?)(?=\n## |\s*$)/i);

  if (contextMatch && !/RoadBoard task/i.test(contextMatch[1])) {
    warnings.push("no RoadBoard task reference found in ## Context");
  }

  return { errors, warnings };
}

/**
 * Runs lint validation on all .md files in tasks/<dir>/ (default: todo).
 * For each file reports lint errors/warnings, its frontmatter status, and
 * whether it is spawnable (status: approved). Prompts in todo/ that are not
 * approved are flagged as not-spawnable.
 */
export function runLint(dir?: string): LintResult {
  const targetDir = path.basename(dir ?? "todo");
  const folderPath = path.join(TASKS_DIR, targetDir);

  if (!fs.existsSync(folderPath)) {
    return {
      ok: true,
      issues: 0,
      message: `lint: ok (0 issues) — folder tasks/${targetDir} does not exist`,
      files: [],
    };
  }

  const fileNames = fs.readdirSync(folderPath).filter(isPromptFileName).sort();
  let totalErrors = 0;
  const lines: string[] = [];
  const files: FileLintResult[] = [];

  for (const file of fileNames) {
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { errors, warnings } = lintPromptContent(content);
    const parsed = parsePrompt(content);
    const status = parsed.frontmatter.status;
    const spawnable = status === "approved";

    files.push({ file, status, spawnable, errors, warnings });

    if (errors.length > 0) {
      totalErrors += errors.length;
      lines.push(`FAIL ${file}: ${errors.join(", ")}`);
    }

    if (warnings.length > 0) {
      lines.push(`WARN ${file}: ${warnings.join(", ")}`);
    }

    // Only flag not-spawnable in the todo/ folder — run/ and done/ are post-spawn.
    if (targetDir === "todo" && !spawnable) {
      lines.push(`NOT-SPAWNABLE ${file}: status=${status ?? "unknown"} (only 'approved' may be spawned)`);
    }
  }

  const ok = totalErrors === 0;
  const summary = `lint: ${ok ? "ok" : "FAIL"} (${totalErrors} error${totalErrors === 1 ? "" : "s"}, ${fileNames.length} file${fileNames.length === 1 ? "" : "s"} checked)`;
  const message = lines.length > 0 ? `${lines.join("\n")}\n${summary}` : summary;

  return { ok, issues: totalErrors, message, files };
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
    .filter((f) => isPromptFileName(f) && f.toLowerCase().includes(lower))
    .sort();
}

/**
 * Inspects tasks/todo/ and partitions prompts into spawnable (`status: approved`)
 * versus pending (draft / in-review / changes-requested / blocked-review / unknown).
 * Returns empty lists if the folder does not exist.
 */
export function runReady(): ReadyResult {
  const todoDir = path.join(TASKS_DIR, "todo");

  if (!fs.existsSync(todoDir)) {
    return { approved: [], pending: [] };
  }

  const approved: ReadyEntry[] = [];
  const pending: ReadyEntry[] = [];

  const files = fs.readdirSync(todoDir).filter(isPromptFileName).sort();

  for (const file of files) {
    const content = fs.readFileSync(path.join(todoDir, file), "utf-8");
    const status = parsePrompt(content).frontmatter.status;

    if (status === "approved") {
      approved.push({ file, status });
    }

    else {
      pending.push({ file, status });
    }
  }

  return { approved, pending };
}

/** Folders compared for stale detection — the three lifecycle folders. */
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

    const files = fs.readdirSync(folderPath).filter(isPromptFileName);

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
 * Reads a prompt's frontmatter status from disk.
 */
function readPromptStatus(filePath: string): PromptStatus | null {
  const content = fs.readFileSync(filePath, "utf-8");

  return parsePrompt(content).frontmatter.status;
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
 * Saves output to <adapter.outputDir>/<slug>-<adapter>-output.md.
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
  const outputDir = adapterCfg.outputDir && adapterCfg.outputDir.trim() !== ""
    ? adapterCfg.outputDir
    : path.join(options.tasksDir ?? TASKS_DIR, "todo");
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${slug}-${adapterName}-output.md`);

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
    },
    architect: {
      binary: "claude",
      model: "opus",
      flags: ["--dangerously-skip-permissions"],
    },
  },
  verify: {
    build: "pnpm build",
    tests: "pnpm test",
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
// run — spawn a Worker on an APPROVED prompt
// ---------------------------------------------------------------------------

export interface RunResult {
  slug: string;
  promptFile: string;
  adapter: string;
  status: PromptStatus | null;
  dryRun: boolean;
  command: string;
  args: string[];
  outputPath: string | null;
}

export interface RunOptions {
  tasksDir?: string;
  configPath?: string;
  dryRun?: boolean;
  execFn?: (binary: string, args: string[], opts: object) => string;
  logFn?: (msg: string) => void;
}

/**
 * Spawns a Worker adapter on a prompt identified by slug.
 *
 * REFUSES any prompt whose frontmatter status is not `approved` — the review
 * gate. With dryRun the command is previewed and nothing is executed. The
 * adapter must exist in config and be enabled to actually run.
 */
export function runWorker(slug: string, adapterName: string, options: RunOptions = {}): RunResult {
  if (!slug || slug.trim() === "") {
    throw new Error("--slug is required for run command");
  }

  if (!adapterName || adapterName.trim() === "") {
    throw new Error("--adapter is required for run command");
  }

  const tasksDir = options.tasksDir ?? TASKS_DIR;
  const configPath = options.configPath ?? ADAPTERS_CONFIG_PATH;
  const dryRun = options.dryRun ?? false;
  const execFn = options.execFn ?? ((binary, args, opts) =>
    child_process.execFileSync(binary, args, { ...opts, encoding: "utf-8" }) as string);
  const log = options.logFn ?? ((msg: string) => console.log(msg));

  const promptFile = findPromptFile(slug, tasksDir);
  const status = readPromptStatus(promptFile);

  // --- Review gate -----------------------------------------------------------
  if (status !== "approved") {
    throw new Error(
      `Refusing to run: prompt "${path.basename(promptFile)}" has status="${status ?? "unknown"}". ` +
      "Only prompts with frontmatter status: approved may be spawned. " +
      "Complete the Analyst review (## Review log) and set status: approved first.",
    );
  }

  const config = loadAdaptersConfig(configPath);

  if (config === null) {
    throw new Error(
      `No adapter config found at ${configPath}. ` +
      "Run `pnpm agent:workflow config --init` first.",
    );
  }

  const adapterCfg = config.adapters[adapterName];

  if (!adapterCfg) {
    throw new Error(`Adapter "${adapterName}" not found in config. Check ${configPath}.`);
  }

  const command = adapterCfg.binary;
  const args = [...(adapterCfg.flags ?? []), promptFile];

  if (dryRun) {
    log(`[dry-run] would run worker on approved prompt: ${command} ${args.join(" ")}`);

    return { slug, promptFile, adapter: adapterName, status, dryRun: true, command, args, outputPath: null };
  }

  if (!adapterCfg.enabled) {
    throw new Error(
      `Adapter "${adapterName}" is disabled (enabled: false). ` +
      "Set enabled: true in the config to proceed.",
    );
  }

  // Worker output artifacts are NOT lifecycle prompts — default them into
  // .agent/ so they never pollute tasks/run/ counts and sync.
  const outputDir = adapterCfg.outputDir && adapterCfg.outputDir.trim() !== ""
    ? adapterCfg.outputDir
    : path.join(AGENT_DIR, "worker-output");
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${slug}-${adapterName}-output.md`);

  log(`[run] invoking worker adapter "${adapterName}" on approved prompt ${path.basename(promptFile)}`);
  const output = execFn(command, args, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  fs.writeFileSync(outputPath, output, "utf-8");

  return { slug, promptFile, adapter: adapterName, status, dryRun: false, command, args, outputPath };
}


// --- Review loop (Analyst review gate) ---------------------------------------

export interface ReviewOptions {
  analyst?: "codex" | "claude";
  maxRounds?: number;
  tasksDir?: string;
  configPath?: string;
  spawnFn?: (command: string, args: string[]) => number;
  logFn?: (msg: string) => void;
}

export interface ReviewResult {
  slug: string;
  promptFile: string;
  finalStatus: PromptStatus | null;
  rounds: number;
  outcome: "approved" | "blocked-review";
}

/** Build the child-process invocation for a role (codex exec / claude -p), headless. */
export function buildRoleInvocation(
  role: RoleConfig,
  promptText: string,
  repoRoot: string,
): { command: string; args: string[] } {
  const flags = role.flags ?? [];
  const isCodex = path.basename(role.binary).replace(/\.[^.]+$/, "") === "codex";

  if (isCodex) {
    // Drop a stray "exec" from flags — we add the exec scaffold ourselves.
    const extraFlags = flags.filter((f) => f !== "exec");
    const args = [
      "exec",
      "--cd", repoRoot,
      "--sandbox", "workspace-write",
      "--skip-git-repo-check",
      ...extraFlags,
      promptText,
    ];

    return { command: role.binary, args };
  }

  // claude (default) — headless print mode with non-interactive edit permission
  const args = ["-p", promptText];

  if (role.model) {
    args.push("--model", role.model);
  }

  const hasPermFlag = flags.some(
    (f) => f.includes("permission") || f.includes("dangerously-skip-permissions"),
  );

  if (!hasPermFlag) {
    args.push("--permission-mode", "acceptEdits");
  }

  args.push(...flags);

  return { command: role.binary, args };
}

/** Flip the frontmatter `status:` line in place without disturbing the rest. */
export function setPromptStatus(filePath: string, status: PromptStatus): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const updated = content.replace(
    /^(---\r?\n[\s\S]*?\bstatus:[ \t]*)[A-Za-z-]+/m,
    `$1${status}`,
  );
  fs.writeFileSync(filePath, updated, "utf-8");
}

/**
 * Sets a flat top-level frontmatter scalar field in place. If the field already
 * exists its value is rewritten; otherwise the `key: value` line is appended to
 * the end of the frontmatter block (just before the closing `---`).
 * Throws if the file has no frontmatter block.
 */
export function setFrontmatterField(filePath: string, key: string, value: string): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const existing = new RegExp(`^(---\\r?\\n[\\s\\S]*?\\b${key}:[ \\t]*)([^\\r\\n]*)`, "m");

  if (existing.test(content)) {
    fs.writeFileSync(filePath, content.replace(existing, `$1${value}`), "utf-8");

    return;
  }

  // Insert before the closing frontmatter fence.
  const closing = content.match(/^(---\r?\n[\s\S]*?)(\r?\n---\r?\n?)/);

  if (!closing) {
    throw new Error(`Cannot set frontmatter field "${key}": no frontmatter block in ${filePath}`);
  }

  const updated = content.replace(
    /^(---\r?\n[\s\S]*?)(\r?\n---\r?\n?)/,
    `$1\n${key}: ${value}$2`,
  );
  fs.writeFileSync(filePath, updated, "utf-8");
}

/** Set the frontmatter `output_status:` (inserting the field if missing). */
export function setOutputStatus(filePath: string, status: OutputStatus): void {
  setFrontmatterField(filePath, "output_status", status);
}

/** Set the frontmatter `output_round:` (inserting the field if missing). */
export function setOutputRound(filePath: string, round: number): void {
  setFrontmatterField(filePath, "output_round", String(round));
}

/**
 * Writes the nested `verification:` block into the frontmatter. Replaces an
 * existing block or appends a new one just before the closing `---` fence.
 */
export function setVerification(filePath: string, v: Verification): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const block =
    `verification:\n` +
    `  build: ${v.build}\n` +
    `  tests: ${v.tests}\n` +
    `  evidence: ${v.evidence}`;

  // Existing block: `verification:` header + its indented children.
  const existing = /^verification:\r?\n(?:[ \t]+[^\r\n]*\r?\n?)*/m;

  if (existing.test(content)) {
    fs.writeFileSync(filePath, content.replace(existing, block + "\n"), "utf-8");

    return;
  }

  const closing = content.match(/^(---\r?\n[\s\S]*?)(\r?\n---\r?\n?)/);

  if (!closing) {
    throw new Error(`Cannot set verification: no frontmatter block in ${filePath}`);
  }

  const updated = content.replace(
    /^(---\r?\n[\s\S]*?)(\r?\n---\r?\n?)/,
    `$1\n${block}$2`,
  );
  fs.writeFileSync(filePath, updated, "utf-8");
}

/**
 * Finds a prompt file in tasks/<folder>/ matching the slug (case-insensitive).
 * Returns the first match or throws if none found.
 */
function findPromptFileInFolder(slug: string, folder: string, tasksDir?: string): string {
  const dir = path.join(tasksDir ?? TASKS_DIR, folder);
  const files = matchingFiles(dir, slug);

  if (files.length === 0) {
    throw new Error(`No prompt file found in tasks/${folder}/ matching slug: "${slug}"`);
  }

  return path.join(dir, files[0]);
}

function buildArchitectPrompt(relPath: string, status: PromptStatus | null): string {
  const action =
    status === "changes-requested"
      ? "The ## Review log ends with a `changes-requested` round. Revise the prompt IN PLACE to address EVERY requested change. If a request is wrong, resolve it by adjusting the prompt and noting the rationale — do not leave it unaddressed."
      : "This is the first submission. Validate the prompt is complete and coherent; make minimal fixes only if clearly needed.";

  return [
    "You are running in Architect role.",
    `Read the Worker prompt at: ${relPath}`,
    action,
    "Then update the YAML frontmatter: set `status: in-review` and set `review_round` to the next integer (increment it).",
    "Do NOT append to `## Review log` — that is the Analyst's job. Do NOT spawn subagents, do NOT modify source code, do NOT move the file, do NOT commit.",
    `Edit ONLY ${relPath}.`,
  ].join("\n\n");
}

function buildAnalystPrompt(relPath: string): string {
  return [
    "You are running in Analyst role — the review gate.",
    `Read the Worker prompt at: ${relPath}`,
    "Verify it against PLAN.md, docs/, and the actual source files it cites (use semantic navigation; do not trust the prompt's own claims).",
    "Judge: correctness, completeness, unambiguity, scope cleanliness, safety.",
    "Write your verdict by editing ONLY this file: set frontmatter `status` to `approved` or `changes-requested`, and APPEND a new `### Round <n>` section under `## Review log` (never overwrite prior rounds). Use the current `review_round` value as <n>.",
    "Default to `changes-requested` if anything is ambiguous, incomplete, unverifiable, or risky. Approval is earned.",
    "Do NOT modify source code, do NOT move the file, do NOT commit.",
  ].join("\n\n");
}

/**
 * Drive the Architect <-> Analyst review loop until the prompt reaches
 * `status: approved`, or `blocked-review` after maxRounds without convergence.
 * Architect = claude; Analyst = codex by default, or claude when analyst="claude".
 */
export function runReview(slug: string, options: ReviewOptions = {}): ReviewResult {
  if (!slug || slug.trim() === "") {
    throw new Error("--slug is required for review command");
  }

  const tasksDir = options.tasksDir ?? TASKS_DIR;
  const configPath = options.configPath ?? ADAPTERS_CONFIG_PATH;
  const analystKind = options.analyst ?? "codex";
  const maxRounds = options.maxRounds ?? 3;
  const log = options.logFn ?? ((msg: string) => console.log(msg));
  const spawn =
    options.spawnFn ??
    ((command: string, args: string[]) => {
      const r = child_process.spawnSync(command, args, { cwd: ROOT, stdio: "inherit" });

      return r.status ?? 1;
    });

  const config = loadAdaptersConfig(configPath);

  if (config === null || !config.roles) {
    throw new Error(
      `No role config found at ${configPath}. Run \`pnpm agent:workflow config --init\` first.`,
    );
  }

  const architectRole = config.roles.architect;

  if (!architectRole) {
    throw new Error(`No "architect" role in ${configPath}.`);
  }

  const analystRole: RoleConfig =
    analystKind === "claude"
      ? { binary: "claude", model: architectRole.model, flags: architectRole.flags }
      : config.roles.analyst;

  if (!analystRole) {
    throw new Error(`No "analyst" role in ${configPath}. Add one or pass --analyst claude.`);
  }

  const promptFile = findPromptFile(slug, tasksDir);
  const relPath = path.relative(ROOT, promptFile);
  let rounds = 0;

  for (let i = 0; i < maxRounds; i++) {
    const status = readPromptStatus(promptFile);

    if (status === "approved") {
      log(`[review] already approved — nothing to do.`);

      return { slug, promptFile, finalStatus: status, rounds, outcome: "approved" };
    }

    if (status === "blocked-review") {
      log(`[review] status is blocked-review — escalate to developer.`);

      return { slug, promptFile, finalStatus: status, rounds, outcome: "blocked-review" };
    }

    // Architect step: submit (draft) or revise (changes-requested)
    if (status === "draft" || status === "changes-requested" || status === null) {
      const verb = status === "changes-requested" ? "revising" : "submitting";
      log(`[review] round ${i + 1}: Architect (${architectRole.binary}) ${verb}…`);
      const { command, args } = buildRoleInvocation(architectRole, buildArchitectPrompt(relPath, status), ROOT);
      const code = spawn(command, args);

      if (code !== 0) {
        throw new Error(`Architect step failed (exit ${code}).`);
      }

      const afterArch = readPromptStatus(promptFile);

      if (afterArch !== "in-review") {
        throw new Error(
          `Architect did not set status to in-review (got "${afterArch ?? "unknown"}"). Aborting.`,
        );
      }
    }

    // Analyst step: write verdict into the prompt
    log(`[review] round ${i + 1}: Analyst (${analystRole.binary}) reviewing…`);
    const { command, args } = buildRoleInvocation(analystRole, buildAnalystPrompt(relPath), ROOT);
    const code = spawn(command, args);

    if (code !== 0) {
      throw new Error(`Analyst step failed (exit ${code}).`);
    }

    rounds++;
    const verdict = readPromptStatus(promptFile);
    log(`[review] round ${i + 1} verdict: ${verdict ?? "unknown"}`);

    if (verdict === "approved") {
      return { slug, promptFile, finalStatus: verdict, rounds, outcome: "approved" };
    }
  }

  // Loop cap reached without approval
  setPromptStatus(promptFile, "blocked-review");
  log(
    `[review] reached max ${maxRounds} rounds without approval — set status: blocked-review. Escalate to developer.`,
  );

  return { slug, promptFile, finalStatus: "blocked-review", rounds, outcome: "blocked-review" };
}


// ---------------------------------------------------------------------------
// OUTPUT-GATE: review-output — review the Worker's diff + verdict
// ---------------------------------------------------------------------------

/** Extract the `## Scope` and `## Acceptance criteria` sections from a prompt body. */
function extractScopeAndCriteria(content: string): string {
  const grab = (heading: string): string => {
    const re = new RegExp(`(^${heading}[\\s\\S]*?)(?=\\n## |\\s*$)`, "im");
    const m = content.match(re);

    return m ? m[1].trim() : "";
  };

  return [grab("## Scope"), grab("## Acceptance criteria")].filter(Boolean).join("\n\n");
}

/**
 * Compute the relevant git diff: working tree + staged via `git diff HEAD`,
 * PLUS untracked files (invisible to `git diff HEAD`) diffed against
 * /dev/null — a Worker whose change is only new files must still produce a
 * reviewable diff. `git diff --no-index` is side-effect-free (no index writes).
 */
function computeGitDiff(repoRoot: string): string {
  const gitOpts = { cwd: repoRoot, encoding: "utf-8" as const, maxBuffer: 20 * 1024 * 1024 };
  const tracked = child_process.spawnSync("git", ["diff", "HEAD"], gitOpts);
  const untrackedList = child_process.spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    gitOpts,
  );
  const untrackedFiles = (untrackedList.stdout ?? "").split("\n").filter((f) => f.trim() !== "");
  let untrackedDiff = "";

  for (const file of untrackedFiles) {
    // Exits 1 when files differ — expected; we only consume stdout.
    const d = child_process.spawnSync("git", ["diff", "--no-index", "--", "/dev/null", file], gitOpts);
    untrackedDiff += d.stdout ?? "";
  }

  return (tracked.stdout ?? "") + untrackedDiff;
}

export interface ReviewOutputOptions {
  tasksDir?: string;
  configPath?: string;
  maxRounds?: number;
  repoRoot?: string;
  /** Analyst binary to use for the default reviewer: codex (default) or claude. */
  analyst?: "codex" | "claude";
  /**
   * Injectable review function. Receives the diff plus scope/criteria context
   * and returns a verdict (optionally with notes for the Output review log).
   * When omitted, the real Analyst adapter is invoked (codex by default, or
   * claude with --analyst claude). Defaults to `changes-requested` if it
   * throws or returns anything unrecognised.
   */
  reviewFn?: (input: { diff: string; context: string; promptFile: string }) =>
    | "approved"
    | "changes-requested"
    | { verdict: "approved" | "changes-requested"; notes?: string[] };
  diffFn?: (repoRoot: string) => string;
  /**
   * Injectable spawn for the DEFAULT (non-`reviewFn`) path — the process that
   * would normally invoke the real Analyst adapter. Receives (command, args)
   * and returns an exit code; tests use it to simulate the Analyst editing
   * the prompt file in place instead of shelling out.
   */
  spawnFn?: (command: string, args: string[]) => number;
  logFn?: (msg: string) => void;
}


/** Options for the default Analyst-backed review function. */
interface AnalystReviewFnOptions {
  configPath: string;
  analyst: "codex" | "claude";
  repoRoot: string;
  /** Round number the Analyst must transcribe into `### Round <n> — <verdict>`. */
  nextRound: number;
  logFn: (msg: string) => void;
  spawnFn?: (command: string, args: string[]) => number;
}


/** Headless instruction handed to the Analyst for the OUTPUT review gate. */
function buildOutputAnalystPrompt(
  promptRelPath: string,
  diffRelPath: string,
  nextRound: number,
): string {
  return [
    "You are running in Analyst role — the OUTPUT review gate.",
    `A Worker has implemented the prompt at: ${promptRelPath}. The resulting git diff (vs HEAD) is saved at: ${diffRelPath}.`,
    "Read both files. Judge whether the diff satisfies the prompt's `## Scope` and `## Acceptance criteria`: completeness, scope cleanliness (no out-of-scope edits), correctness, safety.",
    `Write your verdict by editing ONLY the prompt file (${promptRelPath}): set frontmatter \`output_status\` to \`approved\` or \`changes-requested\`, and APPEND a new section under \`## Output review log\` (create the heading if absent) with the EXACT heading \`### Round ${nextRound} — <verdict>\` (never overwrite prior rounds), followed by bullet findings.`,
    "Use exactly the round number given above — do not compute or increment it yourself.",
    "Default to changes-requested if anything is incomplete, out of scope, or unverifiable. Approval is earned.",
    "Do NOT modify any other file, do NOT move files, do NOT commit.",
  ].join("\n\n");
}


/**
 * Builds the default review function: invokes the configured Analyst adapter
 * (codex, or claude with the architect's model/flags), handing it the prompt
 * file plus the diff (written to .agent/ to dodge argv size limits), and
 * instructing it to write its verdict directly into the prompt file — mirroring
 * `buildAnalystPrompt`'s file-edit pattern for the prompt-side gate. The caller
 * (`runReviewOutput`) reads the verdict back from disk; this function only
 * drives the spawn and throws on a non-zero exit.
 */
function makeAnalystReviewFn(
  opts: AnalystReviewFnOptions,
): (input: { diff: string; context: string; promptFile: string }) => void {
  const config = loadAdaptersConfig(opts.configPath);

  if (config === null || !config.roles) {
    throw new Error(
      `No role config found at ${opts.configPath}. Run \`pnpm agent:workflow config --init\` first.`,
    );
  }

  const architectRole = config.roles.architect;
  const analystRole: RoleConfig | undefined =
    opts.analyst === "claude"
      ? { binary: "claude", model: architectRole?.model, flags: architectRole?.flags }
      : config.roles.analyst;

  if (!analystRole) {
    throw new Error(`No "analyst" role in ${opts.configPath}. Add one or pass --analyst claude.`);
  }

  const spawn =
    opts.spawnFn ??
    ((command: string, args: string[]) => {
      const r = child_process.spawnSync(command, args, { cwd: opts.repoRoot, stdio: "inherit" });

      return r.status ?? 1;
    });

  return (input) => {
    const diffDir = path.join(opts.repoRoot, ".agent");
    fs.mkdirSync(diffDir, { recursive: true });
    const slugBase = path.basename(input.promptFile).replace(/\.md$/, "");
    const diffPath = path.join(diffDir, `review-output-${slugBase}.diff`);
    fs.writeFileSync(diffPath, input.diff.length > 0 ? input.diff : "(empty diff)\n", "utf-8");

    const promptText = buildOutputAnalystPrompt(
      path.relative(opts.repoRoot, input.promptFile),
      path.relative(opts.repoRoot, diffPath),
      opts.nextRound,
    );
    const { command, args } = buildRoleInvocation(analystRole, promptText, opts.repoRoot);
    opts.logFn(`[review-output] Analyst (${analystRole.binary}) reviewing diff…`);
    const code = spawn(command, args);

    if (code !== 0) {
      throw new Error(`Analyst step failed (exit ${code}).`);
    }
  };
}

export interface ReviewOutputResult {
  slug: string;
  promptFile: string;
  outputStatus: OutputStatus;
  outputRound: number;
  verdict: "approved" | "changes-requested" | "blocked-review";
}

/**
 * Reviews the RESULT of a Worker run for a prompt in run/.
 *
 * Computes the git diff, passes it (plus Scope + Acceptance criteria) to an
 * injectable review function, then writes the verdict: sets `output_status`,
 * increments `output_round`, and appends a `### Round N — <verdict>` section to
 * `## Output review log` (append-only, mirroring `## Review log`).
 *
 * Defaults to `changes-requested` when uncertain. After `maxRounds` (default 3)
 * without approval the verdict is `blocked-review`, mirroring runReview's cap.
 */
export function runReviewOutput(slug: string, options: ReviewOutputOptions = {}): ReviewOutputResult {
  if (!slug || slug.trim() === "") {
    throw new Error("--slug is required for review-output command");
  }

  const tasksDir = options.tasksDir ?? TASKS_DIR;
  const repoRoot = options.repoRoot ?? ROOT;
  const maxRounds = options.maxRounds ?? 3;
  const log = options.logFn ?? ((msg: string) => console.log(msg));
  const diffFn = options.diffFn ?? computeGitDiff;

  const promptFile = findPromptFileInFolder(slug, "run", tasksDir);
  const content = fs.readFileSync(promptFile, "utf-8");
  const parsed = parsePrompt(content);

  // Gate: only review a Worker's declared-complete result. A prompt fresh out
  // of a changes-requested round must have its output_status reset to
  // `pending` (by the Worker, after addressing the feedback) before another
  // review-output pass is allowed.
  if (parsed.frontmatter.outputStatus !== "pending") {
    throw new Error(
      `Refusing review-output: prompt "${path.basename(promptFile)}" has ` +
      `output_status="${parsed.frontmatter.outputStatus ?? parsed.frontmatter.raw["output_status"] ?? "none"}" ` +
      "(expected \"pending\" — the Worker has not declared completion).",
    );
  }

  const prevRound = parsed.frontmatter.outputRound ?? 0;
  const nextRound = prevRound + 1;

  // Round cap → blocked-review (mirrors runReview). Checked BEFORE any Analyst
  // invocation so a capped prompt never triggers a wasted spawn.
  if (prevRound >= maxRounds) {
    setOutputStatus(promptFile, "blocked-review");
    appendOutputReviewRound(promptFile, nextRound, "blocked-review", [
      `Reached max ${maxRounds} output-review rounds without approval — escalate to developer.`,
    ]);
    setOutputRound(promptFile, nextRound);
    log(`[review-output] round ${nextRound}: blocked-review (cap reached).`);

    return { slug, promptFile, outputStatus: "blocked-review", outputRound: nextRound, verdict: "blocked-review" };
  }

  const diff = diffFn(repoRoot);
  const context = extractScopeAndCriteria(content);

  // The injected (test) reviewFn path keeps today's behavior: it returns a
  // verdict directly, and this function writes the frontmatter + log itself.
  // The DEFAULT path spawns the real Analyst, which edits the prompt file
  // in place (frontmatter + `## Output review log` round) — this function
  // then reads the verdict back from disk, mirroring runReview's
  // readPromptStatus pattern. Resolved after the round-cap check so a
  // missing config surfaces as a hard error only when a real review is
  // actually about to run.
  if (options.reviewFn === undefined) {
    const analystFn = makeAnalystReviewFn({
      configPath: options.configPath ?? ADAPTERS_CONFIG_PATH,
      analyst: options.analyst ?? "codex",
      repoRoot,
      nextRound,
      logFn: log,
      spawnFn: options.spawnFn,
    });

    let verdict: "approved" | "changes-requested";

    try {
      analystFn({ diff, context, promptFile });

      const after = parsePrompt(fs.readFileSync(promptFile, "utf-8"));

      if (after.frontmatter.outputStatus === "approved" || after.frontmatter.outputStatus === "changes-requested") {
        verdict = after.frontmatter.outputStatus;
      }

      else {
        verdict = "changes-requested";
        appendOutputReviewRound(promptFile, nextRound, verdict, [
          "Analyst did not write a parsable output_status — conservative changes-requested.",
        ]);
      }
    }

    catch (err) {
      log(`[review-output] reviewer failed (${err instanceof Error ? err.message : String(err)}) — conservative changes-requested.`);
      verdict = "changes-requested";
      appendOutputReviewRound(promptFile, nextRound, verdict, [
        `Analyst step failed: ${err instanceof Error ? err.message : String(err)} — conservative changes-requested.`,
      ]);
    }

    setOutputStatus(promptFile, verdict);
    setOutputRound(promptFile, nextRound);
    log(`[review-output] round ${nextRound} verdict: ${verdict}`);

    return { slug, promptFile, outputStatus: verdict, outputRound: nextRound, verdict };
  }

  let verdict: "approved" | "changes-requested";
  let analystNotes: string[] = [];

  try {
    const v = options.reviewFn({ diff, context, promptFile });

    if (typeof v === "object" && v !== null) {
      verdict = v.verdict === "approved" ? "approved" : "changes-requested";
      analystNotes = v.notes ?? [];
    }

    else {
      verdict = v === "approved" ? "approved" : "changes-requested";
    }
  }

  catch (err) {
    log(`[review-output] reviewer failed (${err instanceof Error ? err.message : String(err)}) — conservative changes-requested.`);
    verdict = "changes-requested";
  }

  const notes =
    analystNotes.length > 0
      ? analystNotes
      : verdict === "approved"
        ? ["Diff satisfies Scope and Acceptance criteria."]
        : ["Diff does not yet satisfy Scope / Acceptance criteria — see requested changes."];

  appendOutputReviewRound(promptFile, nextRound, verdict, notes);
  setOutputStatus(promptFile, verdict);
  setOutputRound(promptFile, nextRound);
  log(`[review-output] round ${nextRound} verdict: ${verdict}`);

  return { slug, promptFile, outputStatus: verdict, outputRound: nextRound, verdict };
}

/** Append a `### Round N — <verdict>` block under `## Output review log` (append-only). */
function appendOutputReviewRound(
  filePath: string,
  round: number,
  verdict: string,
  notes: string[],
): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const entry =
    `### Round ${round} — ${verdict}\n` + notes.map((n) => `- ${n}`).join("\n") + "\n";

  if (/## Output review log/i.test(content)) {
    // Append the round to the end of the file (log section is last by convention).
    const trimmed = content.replace(/\s*$/, "\n");
    fs.writeFileSync(filePath, `${trimmed}\n${entry}`, "utf-8");

    return;
  }

  const trimmed = content.replace(/\s*$/, "\n");
  fs.writeFileSync(filePath, `${trimmed}\n## Output review log\n\n${entry}`, "utf-8");
}

// ---------------------------------------------------------------------------
// OUTPUT-GATE: promote — the SINGLE run→done path, with executed verification
// ---------------------------------------------------------------------------

/** Default verification commands when none are configured. */
const DEFAULT_VERIFY: Required<VerifyConfig> = { build: "pnpm build", tests: "pnpm test" };

export interface PromoteOptions {
  tasksDir?: string;
  configPath?: string;
  repoRoot?: string;
  dryRun?: boolean;
  /**
   * Injectable command runner for build/tests. Returns the exit code.
   * Tests point the configured commands at `true`/`false` and/or inject this.
   */
  runCmdFn?: (command: string, repoRoot: string) => number;
  logFn?: (msg: string) => void;
}

export interface PromoteResult {
  slug: string;
  promptFile: string;
  dryRun: boolean;
  moved: boolean;
  fromPath: string;
  toPath: string;
  verification: Verification;
}

/**
 * Promotes a prompt from run/ to done/ — the ONLY run→done path.
 *
 * Guards, in order (each throws with a clear message on failure):
 *   1. output_status === "approved".
 *   2. Re-runs build and tests (configurable via .agent/workflow-adapters.json
 *      `verify: { build, tests }`; defaults: `pnpm build`, `pnpm test`), and
 *      requires exit 0. Records the outcome in the `verification` block.
 *   3. Evidence rule: if `verification.evidence` is non-empty, the referenced
 *      file MUST exist. If the prompt requires evidence — `requires_evidence:
 *      true` OR a `label: ui` / `labels: […ui…]` UI convention — then evidence
 *      MUST be non-empty AND the file must exist.
 *
 * Only when all guards pass is the file moved run/→done/. `--dry-run` reports
 * what would happen without running commands or moving the file.
 */
export function runPromote(slug: string, options: PromoteOptions = {}): PromoteResult {
  if (!slug || slug.trim() === "") {
    throw new Error("--slug is required for promote command");
  }

  const tasksDir = options.tasksDir ?? TASKS_DIR;
  const repoRoot = options.repoRoot ?? ROOT;
  const configPath = options.configPath ?? ADAPTERS_CONFIG_PATH;
  const dryRun = options.dryRun ?? false;
  const log = options.logFn ?? ((msg: string) => console.log(msg));
  const runCmd =
    options.runCmdFn ??
    ((command: string, cwd: string) => {
      const r = child_process.spawnSync(command, { cwd, shell: true, stdio: "inherit" });

      return r.status ?? 1;
    });

  const promptFile = findPromptFileInFolder(slug, "run", tasksDir);
  const parsed = parsePrompt(fs.readFileSync(promptFile, "utf-8"));

  // --- Guard 1: output approved ---------------------------------------------
  if (parsed.frontmatter.outputStatus !== "approved") {
    throw new Error(
      `Refusing to promote: prompt "${path.basename(promptFile)}" has ` +
      `output_status="${parsed.frontmatter.outputStatus ?? "none"}". ` +
      "Run `review-output` until output_status: approved before promoting.",
    );
  }

  // --- Resolve verify commands ----------------------------------------------
  const config = loadAdaptersConfig(configPath);
  const buildCmd = config?.verify?.build?.trim() || DEFAULT_VERIFY.build;
  const testsCmd = config?.verify?.tests?.trim() || DEFAULT_VERIFY.tests;

  const fromPath = promptFile;
  const toPath = path.join(tasksDir, "done", path.basename(promptFile));

  if (dryRun) {
    log(
      `[dry-run] would verify: build="${buildCmd}", tests="${testsCmd}"; ` +
      `then move ${path.relative(tasksDir, fromPath)} → ${path.relative(tasksDir, toPath)}`,
    );

    return {
      slug,
      promptFile,
      dryRun: true,
      moved: false,
      fromPath,
      toPath,
      verification: parsed.frontmatter.verification ?? { build: "unknown", tests: "unknown", evidence: "" },
    };
  }

  // --- Guard 2: executed build + tests --------------------------------------
  const verification: Verification = {
    build: "unknown",
    tests: "unknown",
    evidence: parsed.frontmatter.verification?.evidence ?? "",
  };

  log(`[promote] verifying build: ${buildCmd}`);
  const buildCode = runCmd(buildCmd, repoRoot);
  verification.build = buildCode === 0 ? "pass" : "fail";

  if (buildCode !== 0) {
    setVerification(promptFile, verification);
    throw new Error(`Refusing to promote: build failed (exit ${buildCode}) — "${buildCmd}".`);
  }

  log(`[promote] verifying tests: ${testsCmd}`);
  const testsCode = runCmd(testsCmd, repoRoot);
  verification.tests = testsCode === 0 ? "pass" : "fail";

  if (testsCode !== 0) {
    setVerification(promptFile, verification);
    throw new Error(`Refusing to promote: tests failed (exit ${testsCode}) — "${testsCmd}".`);
  }

  // --- Guard 3: evidence -----------------------------------------------------
  const raw = parsed.frontmatter.raw;
  const requiresEvidence =
    raw["requires_evidence"] === "true" ||
    /(^|[,\s])ui([,\s]|$)/i.test(raw["label"] ?? "") ||
    /(^|[,\s\[])ui([,\s\]]|$)/i.test(raw["labels"] ?? "");

  const evidence = verification.evidence.trim();

  if (requiresEvidence && evidence === "") {
    setVerification(promptFile, verification);
    throw new Error(
      "Refusing to promote: this prompt requires evidence " +
      "(requires_evidence: true or a UI label) but verification.evidence is empty.",
    );
  }

  if (evidence !== "") {
    const evidencePath = path.isAbsolute(evidence) ? evidence : path.join(repoRoot, evidence);

    if (!fs.existsSync(evidencePath)) {
      setVerification(promptFile, verification);
      throw new Error(
        `Refusing to promote: verification.evidence "${evidence}" does not exist at ${evidencePath}.`,
      );
    }
  }

  // Persist the passing verification, then move run/→done/.
  setVerification(promptFile, verification);
  fs.mkdirSync(path.dirname(toPath), { recursive: true });
  fs.renameSync(fromPath, toPath);
  log(`[promote] moved ${path.basename(fromPath)} → tasks/done/`);

  return { slug, promptFile: toPath, dryRun: false, moved: true, fromPath, toPath, verification };
}

function printStatus(result: StatusResult): void {
  console.log("Task folder counts:");

  for (const { folder, count } of result.counts) {
    console.log(`  ${folder.padEnd(8)} ${count}`);
  }

  const ro = result.runOutput;
  console.log(
    `run/ output_status: pending=${ro.pending}, approved=${ro.approved}, ` +
    `changes-requested=${ro["changes-requested"]}`,
  );

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
  analyst?: "codex" | "claude";
  maxRounds?: number;
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
  let analyst: "codex" | "claude" | undefined;
  let maxRounds: number | undefined;

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

    else if (remaining[i] === "--analyst" && remaining[i + 1]) {
      analyst = remaining[i + 1] === "claude" ? "claude" : "codex";
      i++;
    }

    else if (remaining[i] === "--max-rounds" && remaining[i + 1]) {
      const n = Number.parseInt(remaining[i + 1], 10);
      maxRounds = Number.isFinite(n) && n > 0 ? n : undefined;
      i++;
    }
  }

  return { command, subcommand, slug, dir, adapter, execute, init, show, dryRun, analyst, maxRounds };
}

function main(): void {
  if (process.argv[2] === "--version" || process.argv[2] === "-v") {
    process.stdout.write(`agent-workflow ${readPackageVersion()}\n`);
    return;
  }

  const { command, subcommand, slug, dir, adapter, execute, init, show, dryRun, analyst, maxRounds } = parseArgs(process.argv);

  try {
    if (command === "status") {
      printStatus(getStatus());
    }

    else if (command === "lint") {
      const result = runLint(dir);
      console.log(result.message);

      if (!result.ok) {
        process.exit(1);
      }
    }

    else if (command === "ready") {
      const result = runReady();

      if (result.approved.length === 0) {
        console.log("No spawnable prompts in tasks/todo/ (none with status: approved)");
      }

      else {
        console.log("Spawnable (status: approved) in tasks/todo/:");

        for (const { file } of result.approved) {
          console.log(`  ${file}`);
        }
      }

      if (result.pending.length > 0) {
        console.log("\nPending review in tasks/todo/ (not spawnable):");

        for (const { file, status } of result.pending) {
          console.log(`  ${file} — ${status ?? "unknown"}`);
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

    else if (command === "review") {
      const result = runReview(slug ?? "", { analyst, maxRounds });
      console.log(
        `[review] done — ${result.outcome} (${result.rounds} round(s), final status: ${result.finalStatus ?? "unknown"})`,
      );

      if (result.outcome === "approved") {
        console.log(`  Spawnable: pnpm agent:workflow run --slug ${result.slug} --adapter <name>`);
      }

      else {
        process.exit(2);
      }
    }

    else if (command === "run") {
      const result = runWorker(slug ?? "", adapter ?? "", { dryRun });

      if (result.dryRun) {
        console.log(`[dry-run] approved prompt ${path.basename(result.promptFile)} — would run: ${result.command} ${result.args.join(" ")}`);
      }

      else {
        console.log(`Worker run complete. Output saved: ${result.outputPath}`);
      }
    }

    else if (command === "review-output") {
      const result = runReviewOutput(slug ?? "", { maxRounds, analyst });
      console.log(
        `[review-output] ${result.verdict} — output_status: ${result.outputStatus} ` +
        `(round ${result.outputRound})`,
      );

      if (result.outputStatus === "approved") {
        console.log(`  Promotable: pnpm agent:workflow promote --slug ${result.slug}`);
      }

      else {
        process.exit(2);
      }
    }

    else if (command === "promote") {
      const result = runPromote(slug ?? "", { dryRun });

      if (result.dryRun) {
        console.log(
          `[dry-run] would promote ${path.basename(result.promptFile)} run/→done/ after build+tests pass`,
        );
      }

      else {
        console.log(
          `Promoted ${path.basename(result.toPath)} → tasks/done/ ` +
          `(build=${result.verification.build}, tests=${result.verification.tests})`,
        );
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
        `Usage: pnpm agent:workflow <status|lint|ready|sync|review|review-output|promote|adapters|config|run> [--slug <slug>] [--adapter <name>] [--dir <dir>] [--dry-run] [--analyst <codex|claude>] [--max-rounds <n>]`,
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
