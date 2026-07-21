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
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateTaskList } from "./tasks-list";

const ROOT = path.resolve(__dirname, "..");
const TASKS_DIR = path.join(ROOT, "tasks");
const AGENT_DIR = path.join(ROOT, ".agent");

export function readPackageVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")) as { version: string };
  return pkg.version;
}
const TASK_LIST_PATH = path.join(ROOT, "TASK_LIST.md");
const WORKFLOW_TELEMETRY_DIR = path.join(AGENT_DIR, "workflow-telemetry");

const ROLE_DEFAULT_MCP: Record<WorkflowRoleName, string[]> = {
  architect: [],
  analyst: ["serena", "roadboard"],
  outputAnalyst: [],
  worker: ["serena"],
};

const warnedLegacyConfigs = new Set<string>();

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
  model?: string;
  role?: "analyst" | "architect";
  systemPromptPath?: string;
  flags?: string[];
  mcpServers?: string[];
  inheritGlobalMcp?: boolean;
}

export interface RoleConfig {
  binary: string;
  model?: string;
  flags?: string[];
  systemPromptPath?: string;
  mcpServers?: string[];
  inheritGlobalMcp?: boolean;
}

export interface VerifyConfig {
  build?: string;
  tests?: string;
}

/** Optional timeout overrides for agent/adapter invocations (see DEFAULT_AGENT_TIMEOUT_MS). */
export interface TimeoutsConfig {
  agentMs?: number;
}

export interface McpRegistryEntryConfig {
  placeholder?: boolean;
  command?: string;
  args?: string[];
  url?: string;
  bearerTokenEnvVar?: string;
  codex?: string[];
  claude?: Record<string, unknown>;
}

export type McpRegistryConfig = Record<string, McpRegistryEntryConfig>;

export interface AdaptersConfig {
  adapters: Record<string, AdapterConfig>;
  roles?: Record<string, RoleConfig>;
  mcpRegistry?: McpRegistryConfig;
  verify?: VerifyConfig;
  timeouts?: TimeoutsConfig;
}

type WorkflowRoleName = "architect" | "analyst" | "outputAnalyst" | "worker";

interface McpServerDefinition {
  codex?: string[];
  claude?: Record<string, unknown>;
}

interface ProcessTelemetryInput {
  role: string;
  binary: string;
  model?: string;
  mcpServers: string[];
  promptBytes: number;
  contextPackBytes: number;
  diffBytes?: number;
  transcriptPath?: string;
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

const ADAPTERS_CONFIG_PATH = path.join(AGENT_DIR, "workflow-adapters.json");
const REVIEW_TRANSCRIPTS_DIR = path.join(AGENT_DIR, "review-transcripts");

/** Fallback agent/adapter spawn timeout — 15 minutes — used when `timeouts.agentMs` is absent. */
const DEFAULT_AGENT_TIMEOUT_MS = 15 * 60 * 1000;

/** Resolves the configured agent/adapter timeout, falling back to DEFAULT_AGENT_TIMEOUT_MS. */
function resolveAgentTimeoutMs(config: AdaptersConfig | null): number {
  return config?.timeouts?.agentMs ?? DEFAULT_AGENT_TIMEOUT_MS;
}

/** True when `err` is a Node child_process timeout error (spawnSync/execFileSync `ETIMEDOUT`). */
function isTimeoutError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "ETIMEDOUT";
}

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

  return normalizeAdaptersConfig(JSON.parse(raw) as AdaptersConfig, p);
}


function codexConfigArg(key: string, value: string | string[]): string[] {
  return ["-c", `${key}=${JSON.stringify(value)}`];
}


function commandMcpDefinition(name: string, command: string, args: string[] = []): McpServerDefinition {
  return {
    codex: [
      ...codexConfigArg(`mcp_servers.${name}.command`, command),
      ...codexConfigArg(`mcp_servers.${name}.args`, args),
    ],
    claude: { command, args },
  };
}


function urlMcpDefinition(name: string, url: string, bearerTokenEnvVar: string): McpServerDefinition {
  return {
    codex: [
      ...codexConfigArg(`mcp_servers.${name}.url`, url),
      ...codexConfigArg(`mcp_servers.${name}.bearer_token_env_var`, bearerTokenEnvVar),
    ],
  };
}


function isPlaceholderRegistryEntry(entry: McpRegistryEntryConfig | undefined): boolean {
  if (!entry) {
    return false;
  }

  return entry.placeholder === true ||
    entry.command === "<resolved from SERENA_BIN or PATH>" ||
    entry.url === "https://replace-with-roadboard-mcp-url.example/mcp" ||
    entry.url === "https://replace-with-github-mcp-url.example/mcp" ||
    entry.bearerTokenEnvVar === "ROADBOARD_MCP_TOKEN_ENV_VAR_NAME" ||
    entry.bearerTokenEnvVar === "GITHUB_MCP_TOKEN_ENV_VAR_NAME";
}


function findExecutableOnPath(binary: string): string | null {
  const pathEnv = process.env.PATH ?? "";

  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) {
      continue;
    }

    const candidate = path.join(dir, binary);

    try {
      fs.accessSync(candidate, fs.constants.X_OK);

      return candidate;
    }

    catch {
      // Keep scanning PATH.
    }
  }

  return null;
}


function definitionFromConfigEntry(name: string, entry: McpRegistryEntryConfig): McpServerDefinition {
  if (entry.codex || entry.claude) {
    return {
      codex: entry.codex,
      claude: entry.claude,
    };
  }

  if (entry.command) {
    return commandMcpDefinition(name, entry.command, entry.args ?? []);
  }

  if (entry.url && entry.bearerTokenEnvVar) {
    return urlMcpDefinition(name, entry.url, entry.bearerTokenEnvVar);
  }

  throw new Error(
    `MCP server "${name}" has an incomplete mcpRegistry entry. ` +
    "Provide either codex/claude, command, or url + bearerTokenEnvVar.",
  );
}


function resolveSerenaDefinition(entry: McpRegistryEntryConfig | undefined): McpServerDefinition {
  if (entry && !isPlaceholderRegistryEntry(entry)) {
    return definitionFromConfigEntry("serena", entry);
  }

  const command = process.env.SERENA_BIN ?? findExecutableOnPath("serena");

  if (!command) {
    throw new Error(
      'MCP server "serena" requires SERENA_BIN or a "serena" executable on PATH.',
    );
  }

  return commandMcpDefinition("serena", command, ["start-mcp-server", "--context", "codex", "--project-from-cwd"]);
}


function resolveEnvUrlDefinition(
  name: string,
  entry: McpRegistryEntryConfig | undefined,
  urlEnvName: string,
  tokenEnvNameEnvName: string,
): McpServerDefinition {
  if (entry && !isPlaceholderRegistryEntry(entry)) {
    return definitionFromConfigEntry(name, entry);
  }

  const url = process.env[urlEnvName];
  const bearerTokenEnvVar = process.env[tokenEnvNameEnvName];

  if (!url || !bearerTokenEnvVar) {
    throw new Error(
      `MCP server "${name}" requires mcpRegistry.${name}.url + bearerTokenEnvVar ` +
      `or environment variables ${urlEnvName} and ${tokenEnvNameEnvName}.`,
    );
  }

  return urlMcpDefinition(name, url, bearerTokenEnvVar);
}


function resolveMcpServerDefinition(name: string, registry?: McpRegistryConfig): McpServerDefinition {
  const entry = registry?.[name];

  if (entry && !["serena", "roadboard", "github", "chrome-devtools", "context7"].includes(name)) {
    return definitionFromConfigEntry(name, entry);
  }

  if (name === "serena") {
    return resolveSerenaDefinition(entry);
  }

  if (name === "roadboard") {
    return resolveEnvUrlDefinition(
      "roadboard",
      entry,
      "ROADBOARD_MCP_URL",
      "ROADBOARD_MCP_TOKEN_ENV_VAR",
    );
  }

  if (name === "github") {
    return resolveEnvUrlDefinition(
      "github",
      entry,
      "GITHUB_MCP_URL",
      "GITHUB_MCP_TOKEN_ENV_VAR",
    );
  }

  if (name === "chrome-devtools") {
    return entry
      ? definitionFromConfigEntry(name, entry)
      : commandMcpDefinition(name, "npx", ["-y", "chrome-devtools-mcp@latest"]);
  }

  if (name === "context7") {
    return entry
      ? definitionFromConfigEntry(name, entry)
      : commandMcpDefinition(name, "npx", ["-y", "@upstash/context7-mcp"]);
  }

  throw new Error(`Unknown MCP server "${name}". Add it to mcpRegistry before using it.`);
}


function validateMcpServers(names: string[], owner: string, binary?: string, registry?: McpRegistryConfig): void {
  for (const name of names) {
    const definition = resolveMcpServerDefinition(name, registry);

    if (binary) {
      const kind = binaryKind(binary);

      if (kind === "codex" && !definition.codex) {
        throw new Error(`MCP server "${name}" cannot be configured for Codex in ${owner}.`);
      }

      if (kind === "claude" && !definition.claude) {
        throw new Error(
          `MCP server "${name}" cannot be safely configured for Claude in ${owner} without embedding credentials.`,
        );
      }
    }
  }
}


function roleWithDefaults(
  role: RoleConfig | undefined,
  roleName: WorkflowRoleName | null,
  configPath: string,
  registry?: McpRegistryConfig,
): RoleConfig | undefined {
  if (!role) {
    return undefined;
  }

  const legacy = role.mcpServers === undefined && role.inheritGlobalMcp !== true;
  const defaultMcp = roleName ? ROLE_DEFAULT_MCP[roleName] : [];
  const next = {
    ...role,
    mcpServers: role.mcpServers ?? defaultMcp,
    inheritGlobalMcp: role.inheritGlobalMcp ?? false,
  };

  validateMcpServers(next.mcpServers, `roles.${roleName ?? "custom"}`, next.binary, registry);

  if (legacy) {
    warnLegacyMcpDefaults(configPath);
  }

  return next;
}


function adapterWithDefaults(
  adapter: AdapterConfig,
  adapterName: string,
  configPath: string,
  registry?: McpRegistryConfig,
): AdapterConfig {
  const legacy = adapter.mcpServers === undefined && adapter.inheritGlobalMcp !== true;
  const kind = binaryKind(adapter.binary);
  const defaultMcp = kind === "claude" || kind === "codex" ? ROLE_DEFAULT_MCP.worker : [];
  const next = {
    ...adapter,
    mcpServers: adapter.mcpServers ?? defaultMcp,
    inheritGlobalMcp: adapter.inheritGlobalMcp ?? false,
  };

  validateMcpServers(next.mcpServers, `adapters.${adapterName}`, next.binary, registry);

  if (legacy) {
    warnLegacyMcpDefaults(configPath);
  }

  return next;
}


function workflowRoleName(name: string): WorkflowRoleName | null {
  if (name === "architect" || name === "analyst" || name === "outputAnalyst" || name === "worker") {
    return name;
  }

  return null;
}


function normalizeAdaptersConfig(config: AdaptersConfig, configPath: string): AdaptersConfig {
  const registry = config.mcpRegistry;
  const roles = config.roles
    ? Object.fromEntries(
      Object.entries(config.roles).map(([name, role]) => [
        name,
        roleWithDefaults(
          role,
          workflowRoleName(name),
          configPath,
          registry,
        ),
      ]),
    ) as Record<string, RoleConfig>
    : undefined;

  if (roles?.analyst && !roles.outputAnalyst) {
    roles.outputAnalyst = {
      ...roles.analyst,
      mcpServers: ROLE_DEFAULT_MCP.outputAnalyst,
      inheritGlobalMcp: false,
    };
  }

  if (roles?.architect && !roles.worker) {
    roles.worker = {
      binary: "claude",
      model: "sonnet",
      flags: [],
      mcpServers: ROLE_DEFAULT_MCP.worker,
      inheritGlobalMcp: false,
    };
  }

  const adapters = Object.fromEntries(
    Object.entries(config.adapters ?? {}).map(([name, adapter]) => [
      name,
      adapterWithDefaults(adapter, name, configPath, registry),
    ]),
  );

  return {
    ...config,
    adapters,
    roles,
  };
}


function warnLegacyMcpDefaults(configPath: string): void {
  const key = path.resolve(configPath);

  if (warnedLegacyConfigs.has(key)) {
    return;
  }

  warnedLegacyConfigs.add(key);
  console.warn(
    `[agent-workflow] ${configPath} has no explicit mcpServers/inheritGlobalMcp fields; ` +
    "using lightweight role defaults. Set inheritGlobalMcp:true only for compatibility/debug.",
  );
}


function binaryKind(binary: string): "codex" | "claude" | "other" {
  const base = path.basename(binary).replace(/\.[^.]+$/, "");

  if (base === "codex") return "codex";
  if (base === "claude" || binary.endsWith("claude-worker.sh")) return "claude";

  return "other";
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
  const args = buildAdapterInvocationArgs(
    adapterCfg,
    filePath,
    path.resolve(options.tasksDir ?? TASKS_DIR, ".."),
    config.mcpRegistry,
  );

  return {
    slug,
    adapter: adapterName,
    command: adapterCfg.binary,
    args,
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
  options: {
    configPath?: string;
    tasksDir?: string;
    execFn?: (binary: string, args: string[], opts: object) => string;
  } = {},
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
  const timeoutMs = resolveAgentTimeoutMs(config);
  const args = buildAdapterInvocationArgs(
    adapterCfg,
    filePath,
    path.resolve(options.tasksDir ?? TASKS_DIR, ".."),
    config.mcpRegistry,
  );
  const execFn = options.execFn ?? ((binary, args, opts) =>
    child_process.execFileSync(binary, args, opts) as string);

  const output = invokeExecFileStep({
    role: "adapter-run",
    command: adapterCfg.binary,
    args,
    timeoutMs,
    execFn,
    opts: {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
    },
    timeoutMessage: `Adapter "${adapterName}" step timed out after ${timeoutMs}ms.`,
    telemetry: {
      role: "adapter-run",
      binary: adapterCfg.binary,
      model: adapterCfg.model,
      mcpServers: adapterCfg.inheritGlobalMcp ? ["<global>"] : adapterCfg.mcpServers ?? [],
      promptBytes: fileByteSize(filePath),
      contextPackBytes: 0,
      transcriptPath: outputPath,
    },
  });

  fs.writeFileSync(outputPath, output, "utf-8");

  return { slug, adapter: adapterName, outputPath };
}


const STARTER_CONFIG: AdaptersConfig = {
  adapters: {},
  mcpRegistry: {
    serena: {
      placeholder: true,
      command: "<resolved from SERENA_BIN or PATH>",
      args: ["start-mcp-server", "--context", "codex", "--project-from-cwd"],
    },
    roadboard: {
      placeholder: true,
      url: "https://replace-with-roadboard-mcp-url.example/mcp",
      bearerTokenEnvVar: "ROADBOARD_MCP_TOKEN_ENV_VAR_NAME",
    },
    github: {
      placeholder: true,
      url: "https://replace-with-github-mcp-url.example/mcp",
      bearerTokenEnvVar: "GITHUB_MCP_TOKEN_ENV_VAR_NAME",
    },
  },
  roles: {
    analyst: {
      binary: "codex",
      model: "chatgpt-4.5",
      flags: [],
      mcpServers: ["serena", "roadboard"],
      inheritGlobalMcp: false,
    },
    outputAnalyst: {
      binary: "codex",
      model: "chatgpt-4.5",
      flags: [],
      mcpServers: [],
      inheritGlobalMcp: false,
    },
    architect: {
      binary: "claude",
      model: "opus",
      flags: ["--dangerously-skip-permissions"],
      mcpServers: [],
      inheritGlobalMcp: false,
    },
    worker: {
      binary: "claude",
      model: "sonnet",
      flags: ["--dangerously-skip-permissions"],
      mcpServers: ["serena"],
      inheritGlobalMcp: false,
    },
  },
  verify: {
    build: "pnpm build",
    tests: "pnpm test",
  },
  timeouts: {
    agentMs: DEFAULT_AGENT_TIMEOUT_MS,
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
  const config = normalizeAdaptersConfig(JSON.parse(raw) as AdaptersConfig, filePath);

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
  /** Bypass the single-task-in-run guard. */
  force?: boolean;
}

/**
 * Refuses when tasks/run/ already holds a prompt other than `excludeBasename`
 * (single-task-in-run constraint). Worker output artifacts (`-output.md`) are
 * exempt via `isPromptFileName`. Bypassed entirely when `force` is set.
 */
function assertSingleTaskInRun(
  tasksDir: string,
  excludeBasename: string | null,
  force: boolean | undefined,
  action: "run" | "review-output",
): void {
  if (force) {
    return;
  }

  const runDir = path.join(tasksDir, "run");

  if (!fs.existsSync(runDir)) {
    return;
  }

  const others = fs
    .readdirSync(runDir)
    .filter(isPromptFileName)
    .filter((f) => f !== excludeBasename);

  if (others.length === 0) {
    return;
  }

  const list = others.join(", ");

  if (action === "run") {
    throw new Error(
      `Refusing to run: tasks/run/ already contains ${others.length} prompt(s) in progress (${list}). ` +
      "Only one task may be in run/ at a time (single-task-in-run constraint) — pass --force to bypass.",
    );
  }

  throw new Error(
    `Refusing review-output: tasks/run/ contains ${others.length} other prompt(s) besides the one being reviewed (${list}). ` +
    "review-output expects one active Worker snapshot at a time; legacy runs without snapshots fall back to a whole-repo diff, " +
    "so concurrent prompts can still contaminate the review " +
    "(single-task-in-run constraint) — pass --force to bypass.",
  );
}

/**
 * Spawns a Worker adapter on a prompt identified by slug.
 *
 * REFUSES any prompt whose frontmatter status is not `approved` — the review
 * gate. REFUSES when another prompt already sits in tasks/run/ (single-task-
 * in-run constraint, bypassable with `force`). With dryRun the command is
 * previewed and nothing is executed. The adapter must exist in config and be
 * enabled to actually run.
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

  // Resolve the prompt: normally in todo/ (the Architect drafted and approved it
  // there); fall back to run/ for a retry whose file a prior run already moved.
  let promptFile: string;
  let inTodo = false;

  try {
    promptFile = findPromptFile(slug, tasksDir);
    inTodo = true;
  }

  catch {
    try {
      promptFile = findPromptFileInFolder(slug, "run", tasksDir);
    }

    catch {
      throw new Error(
        `No prompt file found in tasks/todo/ or tasks/run/ matching slug: "${slug}"`,
      );
    }
  }

  const status = readPromptStatus(promptFile);

  // --- Review gate -----------------------------------------------------------
  if (status !== "approved") {
    throw new Error(
      `Refusing to run: prompt "${path.basename(promptFile)}" has status="${status ?? "unknown"}". ` +
      "Only prompts with frontmatter status: approved may be spawned. " +
      "Complete the Analyst review (## Review log) and set status: approved first.",
    );
  }

  // --- Single-task-in-run guard ----------------------------------------------
  assertSingleTaskInRun(tasksDir, inTodo ? null : path.basename(promptFile), options.force, "run");

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

  if (dryRun) {
    // Report the move without performing it; args reflect the post-move run/ path.
    const wouldPath = inTodo
      ? path.join(tasksDir, "run", path.basename(promptFile))
      : promptFile;
    const args = buildAdapterInvocationArgs(adapterCfg, wouldPath, path.resolve(tasksDir, ".."), config.mcpRegistry);
    log(
      `[dry-run] would ${inTodo ? "move todo/→run/ then " : ""}run worker on approved prompt: ` +
      `${command} ${args.join(" ")}`,
    );

    return { slug, promptFile, adapter: adapterName, status, dryRun: true, command, args, outputPath: null };
  }

  if (!adapterCfg.enabled) {
    throw new Error(
      `Adapter "${adapterName}" is disabled (enabled: false). ` +
      "Set enabled: true in the config to proceed.",
    );
  }

  // Spawn = move the approved prompt todo/ → run/, then invoke the Worker on the
  // run/ path. The file lives in run/ for the whole execution (single source of
  // truth for "a Worker is on this"). A retry already in run/ (inTodo=false)
  // skips the move.
  if (inTodo) {
    const dest = path.join(tasksDir, "run", path.basename(promptFile));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(promptFile, dest);
    promptFile = dest;
    log(`[run] moved ${path.basename(dest)} todo/ → run/`);
  }

  const repoRoot = path.resolve(tasksDir, "..");
  const args = buildAdapterInvocationArgs(adapterCfg, promptFile, repoRoot, config.mcpRegistry);

  // Worker output artifacts are NOT lifecycle prompts — default them into
  // .agent/ so they never pollute tasks/run/ counts and sync.
  const outputDir = adapterCfg.outputDir && adapterCfg.outputDir.trim() !== ""
    ? adapterCfg.outputDir
    : path.join(AGENT_DIR, "worker-output");
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${slug}-${adapterName}-output.md`);

  log(`[run] invoking worker adapter "${adapterName}" on approved prompt ${path.basename(promptFile)}`);

  const timeoutMs = resolveAgentTimeoutMs(config);
  const existingSnapshot = inTodo ? null : resolveExistingSnapshotPath(repoRoot, slug);
  const workerSnapshot = existingSnapshot ?? captureWorkerSnapshot(repoRoot, slug);
  const output = invokeExecFileStep({
    role: "worker",
    command,
    args,
    timeoutMs,
    execFn,
    opts: { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, timeout: timeoutMs },
    timeoutMessage: `Worker step timed out after ${timeoutMs}ms.`,
    telemetry: {
      role: "worker",
      binary: command,
      model: adapterCfg.model,
      mcpServers: adapterCfg.inheritGlobalMcp ? ["<global>"] : adapterCfg.mcpServers ?? [],
      promptBytes: fileByteSize(promptFile),
      contextPackBytes: 0,
      transcriptPath: outputPath,
    },
  });

  fs.writeFileSync(outputPath, output, "utf-8");
  writeWorkerSnapshotPointer(repoRoot, slug, workerSnapshot);

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
  /**
   * Injectable working-tree snapshot for the integrity guard. Defaults to
   * `snapshotWorkingTree`. Tests inject a function returning a constant
   * string (no-op) or a value that changes between calls (simulated
   * out-of-scope Analyst edit).
   */
  snapshotFn?: (repoRoot: string) => string;
  /** Directory for Architect/Analyst transcript logs. Defaults to .agent/review-transcripts. */
  transcriptsDir?: string;
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
  registry?: McpRegistryConfig,
): { command: string; args: string[] } {
  const flags = role.flags ?? [];
  const kind = binaryKind(role.binary);
  const isolationArgs = buildMcpIsolationArgs(role, repoRoot, "role", registry);

  if (kind === "codex") {
    return { command: role.binary, args: buildCodexExecArgs(repoRoot, isolationArgs, role.model, flags, promptText) };
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

  args.push(...isolationArgs);
  args.push(...flags);

  return { command: role.binary, args };
}


function buildCodexExecArgs(
  repoRoot: string,
  isolationArgs: string[],
  model: string | undefined,
  flags: string[],
  promptOrFile: string,
): string[] {
  return [
    "exec",
    "--cd", repoRoot,
    "--sandbox", "workspace-write",
    "--skip-git-repo-check",
    ...isolationArgs,
    ...(model ? ["--model", model] : []),
    ...flags.filter((flag) => flag !== "exec"),
    promptOrFile,
  ];
}


function buildMcpIsolationArgs(
  cfg: Pick<RoleConfig, "binary" | "mcpServers" | "inheritGlobalMcp">,
  repoRoot: string,
  owner: string,
  registry?: McpRegistryConfig,
): string[] {
  if (cfg.inheritGlobalMcp === true) {
    return [];
  }

  const servers = cfg.mcpServers ?? [];
  validateMcpServers(servers, owner, cfg.binary, registry);
  const kind = binaryKind(cfg.binary);

  if (kind === "codex") {
    return ["--ignore-user-config", ...servers.flatMap((name) => resolveMcpServerDefinition(name, registry).codex ?? [])];
  }

  if (kind === "claude") {
    const configPath = writeClaudeMcpConfig(repoRoot, servers, registry);
    return ["--mcp-config", configPath, "--strict-mcp-config"];
  }

  if (servers.length > 0) {
    throw new Error(
      `Cannot guarantee MCP isolation for ${owner}: binary "${cfg.binary}" is neither Codex nor Claude.`,
    );
  }

  return [];
}


function writeClaudeMcpConfig(repoRoot: string, serverNames: string[], registry?: McpRegistryConfig): string {
  const baseRoot = fs.existsSync(repoRoot) ? repoRoot : ROOT;
  const mcpDir = path.join(baseRoot, ".agent", "workflow-mcp");
  fs.mkdirSync(mcpDir, { recursive: true });
  const stableName = serverNames.length > 0 ? serverNames.join("-") : "none";
  const filePath = path.join(mcpDir, `claude-${stableName}.json`);
  const mcpServers = Object.fromEntries(
    serverNames.map((name) => [name, resolveMcpServerDefinition(name, registry).claude]),
  );

  writePrivateFile(filePath, JSON.stringify({ mcpServers }, null, 2) + "\n");

  if (!filePath.startsWith(baseRoot)) {
    throw new Error(`Refusing to write Claude MCP config outside repo: ${filePath}`);
  }

  return filePath;
}


function buildAdapterInvocationArgs(
  adapterCfg: AdapterConfig,
  promptFile: string,
  repoRoot: string,
  registry?: McpRegistryConfig,
): string[] {
  const isolationArgs = buildMcpIsolationArgs(adapterCfg, repoRoot, `adapter ${adapterCfg.binary}`, registry);
  const flags = adapterCfg.flags ?? [];

  if (binaryKind(adapterCfg.binary) === "codex") {
    return buildCodexExecArgs(repoRoot, isolationArgs, adapterCfg.model, flags, promptFile);
  }

  return [...flags, ...isolationArgs, promptFile];
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
    "Approve as soon as the prompt is executable and correct; perfection is not the bar.",
    "Request changes ONLY for material defects: wrong, missing, or contradictory decisions; scope errors; or factual errors verified against the codebase.",
    "Do NOT block on cosmetic issues: wording, phrasing, formatting, markdown checkbox state, section ordering, or stylistic preferences.",
    "If a concern was raised in a previous review pass and the current prompt addresses it, do not re-open it.",
    "Re-evaluate the prompt AS IT STANDS RIGHT NOW, from scratch. Do not assume a finding from a previous `## Review log` round still applies — verify each potential issue against the CURRENT prompt text before reporting it, and do not pattern-match against prior rounds.",
    "Do NOT modify source code, do NOT move the file, do NOT commit.",
  ].join("\n\n");
}

/**
 * Content-sensitive working-tree snapshot: `git status --porcelain` (catches
 * new/deleted/renamed paths) combined with `git diff HEAD` (carries the full
 * content of every tracked-file modification, so a mutation inside a file
 * that was ALREADY dirty before the Analyst ran is still detected even though
 * its porcelain line does not change).
 */
export function snapshotWorkingTree(repoRoot: string): string {
  const opts = { cwd: repoRoot, encoding: "utf-8" as const, maxBuffer: 20 * 1024 * 1024 };
  const status = child_process.spawnSync("git", ["status", "--porcelain"], opts);
  const diff = child_process.spawnSync("git", ["diff", "HEAD"], opts);

  return `${status.stdout ?? ""}\n===DIFF===\n${diff.stdout ?? ""}`;
}

/** Extracts the path from a `git status --porcelain` line (handles renames). */
function porcelainPath(line: string): string {
  const rest = line.slice(3).trim();
  const arrow = rest.indexOf(" -> ");

  return arrow >= 0 ? rest.slice(arrow + 4).trim() : rest;
}

/** Splits a `git diff` payload into per-file blocks keyed by the "b/" path. */
function extractDiffBlocksByPath(diffText: string): Map<string, string> {
  const blocks = diffText.split(/(?=^diff --git )/m).filter((b) => b.trim() !== "");
  const map = new Map<string, string>();

  for (const block of blocks) {
    const m = block.match(/^diff --git a\/(.+?) b\/(.+?)\r?\n/);
    map.set(m ? m[2] : block.slice(0, 40), block);
  }

  return map;
}

/**
 * Compares two `snapshotWorkingTree` outputs, ignoring changes confined to
 * the prompt file under review, and returns the offending paths (empty when
 * the tree is otherwise unchanged).
 */
function diffWorkingTreeSnapshots(before: string, after: string, promptRelPath: string): string[] {
  const normalizedPrompt = promptRelPath.replace(/\\/g, "/");
  const [statusBefore = "", diffBefore = ""] = before.split("\n===DIFF===\n");
  const [statusAfter = "", diffAfter = ""] = after.split("\n===DIFF===\n");

  const parseLines = (text: string): Set<string> =>
    new Set(
      text.split("\n").filter((l) => l.trim() !== "" && porcelainPath(l) !== normalizedPrompt),
    );

  const offending = new Set<string>();
  const beforeLines = parseLines(statusBefore);
  const afterLines = parseLines(statusAfter);

  for (const line of beforeLines) {
    if (!afterLines.has(line)) offending.add(porcelainPath(line));
  }

  for (const line of afterLines) {
    if (!beforeLines.has(line)) offending.add(porcelainPath(line));
  }

  const diffBlocksBefore = extractDiffBlocksByPath(diffBefore);
  const diffBlocksAfter = extractDiffBlocksByPath(diffAfter);
  diffBlocksBefore.delete(normalizedPrompt);
  diffBlocksAfter.delete(normalizedPrompt);

  for (const key of new Set([...diffBlocksBefore.keys(), ...diffBlocksAfter.keys()])) {
    if (diffBlocksBefore.get(key) !== diffBlocksAfter.get(key)) offending.add(key);
  }

  return [...offending];
}

/**
 * Throws if the working tree changed between two snapshots outside the
 * reviewed prompt file — an Analyst is only ever allowed to edit that file.
 */
function assertWorkingTreeUnchanged(
  before: string,
  after: string,
  promptRelPath: string,
  stepLabel: string,
): void {
  const offending = diffWorkingTreeSnapshots(before, after, promptRelPath);

  if (offending.length > 0) {
    throw new Error(
      `${stepLabel}: Analyst modified tracked files outside the reviewed prompt: ${offending.join(", ")}.`,
    );
  }
}

/**
 * Throws if `sectionHeading` (e.g. "## Review log") does not contain a
 * `### Round <round>` entry — guards against a verdict written without the
 * matching append-only log round.
 */
function assertLogRoundPresent(
  filePath: string,
  sectionHeading: string,
  round: number,
  stepLabel: string,
): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const escapedHeading = sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionMatch = content.match(
    new RegExp(`^${escapedHeading}\\s*([\\s\\S]*?)(?=\\n## |(?![\\s\\S]))`, "im"),
  );
  const body = sectionMatch ? sectionMatch[1] : "";
  const roundRe = new RegExp(`###\\s+Round\\s+${round}\\s*[—-]`, "i");

  if (!roundRe.test(body)) {
    throw new Error(
      `${stepLabel}: verdict written without a matching "### Round ${round}" entry in "${sectionHeading}" — rejecting.`,
    );
  }
}

/**
 * Invokes one Architect/Analyst step. With `spawnFn` (tests), delegates
 * directly and translates a thrown `ETIMEDOUT` error into a clear message
 * naming the role and configured timeout. Without `spawnFn` (production),
 * runs the real `spawnSync` with `timeout: timeoutMs`, captures stdout+stderr
 * (teed to `logFn` and, when `transcriptPath` is given, persisted to disk),
 * and throws the same clear timeout message on `ETIMEDOUT`.
 */
export function invokeAgentStep(params: {
  role: string;
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  spawnFn?: (command: string, args: string[]) => number;
  logFn: (msg: string) => void;
  transcriptPath?: string;
  telemetry?: ProcessTelemetryInput;
}): number {
  const { role, command, args, cwd, timeoutMs, spawnFn, logFn, transcriptPath, telemetry } = params;
  const startedAt = Date.now();

  if (spawnFn) {
    try {
      const code = spawnFn(command, args);
      if (telemetry) writeProcessTelemetry(telemetry, Date.now() - startedAt, code);
      return code;
    }

    catch (err) {
      if (telemetry) writeProcessTelemetry(
        telemetry,
        Date.now() - startedAt,
        isTimeoutError(err) ? 124 : 1,
        isTimeoutError(err) ? "timeout" : "non-zero",
      );
      if (isTimeoutError(err)) {
        throw new Error(`${role} step timed out after ${timeoutMs}ms.`);
      }

      throw err;
    }
  }

  logFn(`[${role.toLowerCase()}] step starting…`);

  const result = child_process.spawnSync(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutMs,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error && isTimeoutError(result.error)) {
    if (telemetry) writeProcessTelemetry(telemetry, Date.now() - startedAt, 124, "timeout");
    throw new Error(`${role} step timed out after ${timeoutMs}ms.`);
  }

  const transcript = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (transcriptPath) {
    fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });
    fs.writeFileSync(transcriptPath, transcript, "utf-8");
  }

  logFn(`[${role.toLowerCase()}] step finished (exit ${result.status ?? "null"}).`);
  if (telemetry) {
    const exitCode = result.status ?? 1;
    writeProcessTelemetry(
      telemetry,
      Date.now() - startedAt,
      exitCode,
      exitCode === 0 ? undefined : "non-zero",
    );
  }

  return result.status ?? 1;
}


function invokeExecFileStep(params: {
  role: string;
  command: string;
  args: string[];
  opts: object;
  timeoutMs: number;
  timeoutMessage: string;
  execFn: (binary: string, args: string[], opts: object) => string;
  telemetry: ProcessTelemetryInput;
}): string {
  const startedAt = Date.now();

  try {
    const output = params.execFn(params.command, params.args, params.opts);
    writeProcessTelemetry(params.telemetry, Date.now() - startedAt, 0);

    return output;
  }

  catch (err) {
    const exitCode = isTimeoutError(err) ? 124 : extractExitCode(err);
    writeProcessTelemetry(params.telemetry, Date.now() - startedAt, exitCode, isTimeoutError(err) ? "timeout" : "non-zero");

    if (isTimeoutError(err)) {
      throw new Error(params.timeoutMessage);
    }

    throw err;
  }
}


function extractExitCode(err: unknown): number {
  if (err !== null && typeof err === "object") {
    const status = (err as { status?: unknown }).status;
    const code = (err as { code?: unknown }).code;

    if (typeof status === "number") return status;
    if (typeof code === "number") return code;
  }

  return 1;
}


function writeProcessTelemetry(
  input: ProcessTelemetryInput,
  durationMs: number,
  exitCode: number,
  failureKind?: "timeout" | "non-zero",
): void {
  fs.mkdirSync(WORKFLOW_TELEMETRY_DIR, { recursive: true, mode: 0o700 });
  const entry = {
    timestamp: new Date().toISOString(),
    role: input.role,
    binary: input.binary,
    model: input.model ?? null,
    authorizedMcpServers: input.mcpServers,
    promptBytes: input.promptBytes,
    contextPackBytes: input.contextPackBytes,
    diffBytes: input.diffBytes ?? 0,
    durationMs,
    exitCode,
    failureKind: failureKind ?? null,
    tokenUsage: "unavailable",
    transcriptPath: input.transcriptPath ?? null,
  };
  const filePath = path.join(WORKFLOW_TELEMETRY_DIR, "processes.jsonl");
  const fd = fs.openSync(filePath, "a", 0o600);

  try {
    fs.writeSync(fd, JSON.stringify(entry) + "\n", undefined, "utf-8");
  }

  finally {
    fs.closeSync(fd);
  }
}


function byteSize(text: string): number {
  return Buffer.byteLength(text, "utf-8");
}


function fileByteSize(filePath: string): number {
  return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
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

  const config = loadAdaptersConfig(configPath);

  if (config === null || !config.roles) {
    throw new Error(
      `No role config found at ${configPath}. Run \`pnpm agent:workflow config --init\` first.`,
    );
  }

  const timeoutMs = resolveAgentTimeoutMs(config);
  const transcriptsDir = options.transcriptsDir ?? REVIEW_TRANSCRIPTS_DIR;

  const architectRole = config.roles.architect;

  if (!architectRole) {
    throw new Error(`No "architect" role in ${configPath}.`);
  }

  if (analystKind === "claude") {
    throw new Error(
      "--analyst claude is not supported for prompt-review because the required RoadBoard MCP " +
      "cannot be configured for Claude without copying credentials. Use the Codex analyst profile.",
    );
  }

  const analystRole: RoleConfig =
    config.roles.analyst;

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
      const architectPrompt = buildArchitectPrompt(relPath, status);
      const architectTranscript = path.join(transcriptsDir, `${slug}-review-round${i + 1}-architect.log`);
      const { command, args } = buildRoleInvocation(architectRole, architectPrompt, ROOT, config.mcpRegistry);
      const code = invokeAgentStep({
        role: "Architect",
        command,
        args,
        cwd: ROOT,
        timeoutMs,
        spawnFn: options.spawnFn,
        logFn: log,
        transcriptPath: architectTranscript,
        telemetry: {
          role: "architect-review",
          binary: architectRole.binary,
          model: architectRole.model,
          mcpServers: architectRole.inheritGlobalMcp ? ["<global>"] : architectRole.mcpServers ?? [],
          promptBytes: byteSize(architectPrompt),
          contextPackBytes: 0,
          transcriptPath: architectTranscript,
        },
      });

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
    const expectedRound = parsePrompt(fs.readFileSync(promptFile, "utf-8")).frontmatter.reviewRound ?? 0;
    log(`[review] round ${i + 1}: Analyst (${analystRole.binary}) reviewing…`);
    const analystPrompt = buildAnalystPrompt(relPath);
    const analystTranscript = path.join(transcriptsDir, `${slug}-review-round${i + 1}-analyst.log`);
    const { command, args } = buildRoleInvocation(analystRole, analystPrompt, ROOT, config.mcpRegistry);
    const snapshotFn = options.snapshotFn ?? snapshotWorkingTree;
    const treeBefore = snapshotFn(ROOT);
    const code = invokeAgentStep({
      role: "Analyst",
      command,
      args,
      cwd: ROOT,
      timeoutMs,
      spawnFn: options.spawnFn,
      logFn: log,
      transcriptPath: analystTranscript,
      telemetry: {
        role: "analyst-prompt",
        binary: analystRole.binary,
        model: analystRole.model,
        mcpServers: analystRole.inheritGlobalMcp ? ["<global>"] : analystRole.mcpServers ?? [],
        promptBytes: byteSize(analystPrompt),
        contextPackBytes: 0,
        transcriptPath: analystTranscript,
      },
    });
    const treeAfter = snapshotFn(ROOT);

    if (code !== 0) {
      throw new Error(`Analyst step failed (exit ${code}).`);
    }

    assertWorkingTreeUnchanged(treeBefore, treeAfter, relPath, "[review]");

    rounds++;
    const verdict = readPromptStatus(promptFile);
    log(`[review] round ${i + 1} verdict: ${verdict ?? "unknown"}`);

    assertLogRoundPresent(promptFile, "## Review log", expectedRound, "[review]");

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


interface WorkerSnapshot {
  version: 1;
  slug: string;
  createdAt: string;
  repoRoot: string;
  files: Record<string, SnapshotEntry>;
}

type SnapshotEntry =
  | { state: "missing" }
  | { state: "content"; content: string }
  | { state: "redacted"; exists: boolean; hash: string | null; reason: string };

type GitHeadOperation = "ls-tree" | "show";

interface GitHeadResult {
  status: number | null;
  stdout: Buffer;
}

type GitHeadReader = (
  operation: GitHeadOperation,
  args: string[],
  repoRoot: string,
  relPath: string,
) => GitHeadResult;


function captureWorkerSnapshot(repoRoot: string, slug: string): string {
  const snapshotDir = path.join(repoRoot, ".agent", "worker-snapshots");
  fs.mkdirSync(snapshotDir, { recursive: true, mode: 0o700 });
  const files: Record<string, SnapshotEntry> = {};

  for (const relPath of listDirtyPaths(repoRoot)) {
    files[relPath] = snapshotWorktreePath(repoRoot, relPath);
  }

  const snapshot: WorkerSnapshot = {
    version: 1,
    slug,
    createdAt: new Date().toISOString(),
    repoRoot,
    files,
  };
  const filePath = path.join(snapshotDir, `${slug}.json`);
  writePrivateFile(filePath, JSON.stringify(snapshot, null, 2) + "\n");

  return filePath;
}


function resolveExistingSnapshotPath(repoRoot: string, slug: string): string | null {
  const snapshotDir = path.join(repoRoot, ".agent", "worker-snapshots");
  const pointerPath = path.join(snapshotDir, `${slug}.latest`);

  if (!fs.existsSync(pointerPath)) {
    return null;
  }

  const snapshotRel = fs.readFileSync(pointerPath, "utf-8").trim();
  const snapshotPath = path.resolve(repoRoot, snapshotRel);

  if (!isContainedPath(snapshotDir, snapshotPath) || !fs.existsSync(snapshotPath)) {
    return null;
  }

  return snapshotPath;
}


function writeWorkerSnapshotPointer(repoRoot: string, slug: string, snapshotPath: string): void {
  const snapshotDir = path.join(repoRoot, ".agent", "worker-snapshots");
  fs.mkdirSync(snapshotDir, { recursive: true, mode: 0o700 });
  const pointerPath = path.join(snapshotDir, `${slug}.latest`);
  writePrivateFile(pointerPath, path.relative(repoRoot, snapshotPath) + "\n");
}


function computeWorkerDiff(repoRoot: string, slug: string, gitHeadReader: GitHeadReader = readGitHeadEntry): string | null {
  const snapshotDir = path.join(repoRoot, ".agent", "worker-snapshots");
  const pointerPath = path.join(snapshotDir, `${slug}.latest`);

  if (!fs.existsSync(pointerPath)) {
    return null;
  }

  const snapshotRel = fs.readFileSync(pointerPath, "utf-8").trim();
  const snapshotPath = path.resolve(repoRoot, snapshotRel);

  if (!isContainedPath(snapshotDir, snapshotPath) || !fs.existsSync(snapshotPath)) {
    throw new Error(`Worker snapshot for "${slug}" is missing or outside .agent/.`);
  }

  const realSnapshotDir = fs.realpathSync(snapshotDir);
  const realSnapshotPath = fs.realpathSync(snapshotPath);

  if (!isContainedPath(realSnapshotDir, realSnapshotPath)) {
    throw new Error(`Worker snapshot for "${slug}" is missing or outside .agent/.`);
  }

  const snapshot = JSON.parse(fs.readFileSync(realSnapshotPath, "utf-8")) as WorkerSnapshot;
  const beforePaths = new Set(Object.keys(snapshot.files));
  const afterPaths = new Set(listDirtyPaths(repoRoot));
  let diff = "";

  for (const relPath of [...new Set([...beforePaths, ...afterPaths])].sort()) {
    const before = beforePaths.has(relPath)
      ? snapshot.files[relPath]
      : snapshotHeadPath(repoRoot, relPath, gitHeadReader);
    const after = snapshotWorktreePath(repoRoot, relPath);

    if (!snapshotEntriesEqual(before, after)) {
      diff += diffSnapshotEntries(repoRoot, relPath, before, after);
    }
  }

  return diff;
}


function isContainedPath(parentDir: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(parentDir), path.resolve(candidatePath));

  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}


function listDirtyPaths(repoRoot: string): string[] {
  const opts = { cwd: repoRoot, encoding: "utf-8" as const, maxBuffer: 20 * 1024 * 1024 };
  const status = child_process.spawnSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    opts,
  );
  const records = (status.stdout ?? "").split("\0").filter((record) => record !== "");
  const paths = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const code = record.slice(0, 2);
    const relPath = record.slice(3);

    if (relPath && !relPath.startsWith(".agent/")) {
      paths.add(relPath);
    }

    if ((code.includes("R") || code.includes("C")) && records[i + 1]) {
      const sourcePath = records[i + 1];
      i++;

      if (sourcePath && !sourcePath.startsWith(".agent/")) {
        paths.add(sourcePath);
      }
    }
  }

  return [...paths].sort();
}


function snapshotWorktreePath(repoRoot: string, relPath: string): SnapshotEntry {
  if (!isSafeRepoRelativePath(relPath)) {
    return { state: "redacted", exists: false, hash: null, reason: "unsafe-path" };
  }

  const filePath = path.join(repoRoot, relPath);

  if (!path.resolve(filePath).startsWith(path.resolve(repoRoot) + path.sep)) {
    return { state: "redacted", exists: false, hash: null, reason: "outside-repository" };
  }

  if (!fs.existsSync(filePath)) {
    return { state: "missing" };
  }

  const stat = fs.lstatSync(filePath);

  if (stat.isSymbolicLink()) {
    const target = fs.readlinkSync(filePath);
    return { state: "redacted", exists: true, hash: hashBuffer(Buffer.from(target)), reason: "symlink" };
  }

  if (!stat.isFile()) {
    return { state: "redacted", exists: true, hash: null, reason: "non-regular-file" };
  }

  const buffer = fs.readFileSync(filePath);

  if (isSensitivePath(relPath)) {
    return { state: "redacted", exists: true, hash: hashBuffer(buffer), reason: "sensitive-path" };
  }

  if (isBinaryBuffer(buffer)) {
    return { state: "redacted", exists: true, hash: hashBuffer(buffer), reason: "binary-file" };
  }

  return { state: "content", content: buffer.toString("utf-8") };
}


function readGitHeadEntry(operation: GitHeadOperation, args: string[], repoRoot: string): GitHeadResult {
  const result = child_process.spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 20 * 1024 * 1024,
  });

  return {
    status: result.status,
    stdout: Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? ""),
  };
}


function assertGitHeadSuccess(operation: GitHeadOperation, relPath: string, status: number | null): void {
  if (status !== 0) {
    throw new Error(`Worker snapshot git ${operation} failed for path "${relPath}".`);
  }
}


function snapshotHeadPath(
  repoRoot: string,
  relPath: string,
  gitHeadReader: GitHeadReader = readGitHeadEntry,
): SnapshotEntry {
  if (!isSafeRepoRelativePath(relPath)) {
    return { state: "redacted", exists: false, hash: null, reason: "unsafe-path" };
  }

  const tree = gitHeadReader("ls-tree", ["ls-tree", "-z", "HEAD", "--", relPath], repoRoot, relPath);
  assertGitHeadSuccess("ls-tree", relPath, tree.status);
  const treeOut = tree.stdout.toString("utf-8").replace(/\0$/, "");

  if (treeOut === "") {
    return { state: "missing" };
  }

  const match = treeOut.match(/^(\d{6})\s+\S+\s+[0-9a-f]+\t/);

  if (!match) {
    return { state: "redacted", exists: true, hash: null, reason: "unreadable-git-entry" };
  }

  if (match[1] === "120000") {
    return { state: "redacted", exists: true, hash: null, reason: "symlink" };
  }

  const result = gitHeadReader("show", ["show", `HEAD:${relPath}`], repoRoot, relPath);
  assertGitHeadSuccess("show", relPath, result.status);
  const buffer = result.stdout;

  if (isSensitivePath(relPath)) {
    return { state: "redacted", exists: true, hash: hashBuffer(buffer), reason: "sensitive-path" };
  }

  if (isBinaryBuffer(buffer)) {
    return { state: "redacted", exists: true, hash: hashBuffer(buffer), reason: "binary-file" };
  }

  return { state: "content", content: buffer.toString("utf-8") };
}


function snapshotEntriesEqual(before: SnapshotEntry, after: SnapshotEntry): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}


function diffSnapshotEntries(
  repoRoot: string,
  relPath: string,
  before: SnapshotEntry,
  after: SnapshotEntry,
): string {
  if (
    (before.state === "content" || before.state === "missing") &&
    (after.state === "content" || after.state === "missing")
  ) {
    return diffFileContents(
      repoRoot,
      relPath,
      before.state === "missing" ? null : before.content,
      after.state === "missing" ? null : after.content,
    );
  }

  return redactedDiff(relPath, before, after);
}


function diffFileContents(repoRoot: string, relPath: string, before: string | null, after: string | null): string {
  const baseTempDir = path.join(repoRoot, ".agent", "worker-snapshots");
  fs.mkdirSync(baseTempDir, { recursive: true, mode: 0o700 });
  const tempDir = fs.mkdtempSync(path.join(baseTempDir, "diff-temp-"));
  fs.chmodSync(tempDir, 0o700);
  const safe = relPath.replace(/[^a-zA-Z0-9_.-]+/g, "_");
  const beforePath = before === null ? "/dev/null" : path.join(tempDir, `${safe}.before`);
  const afterPath = after === null ? "/dev/null" : path.join(tempDir, `${safe}.after`);

  try {
    if (before !== null) writePrivateFile(beforePath, before);
    if (after !== null) writePrivateFile(afterPath, after);

    const result = child_process.spawnSync(
      "git",
      ["diff", "--no-index", "--no-ext-diff", "--", beforePath, afterPath],
      { cwd: repoRoot, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 },
    );
    const raw = result.stdout ?? "";

    return raw
      .replaceAll(beforePath, before === null ? "/dev/null" : `a/${relPath}`)
      .replaceAll(afterPath, after === null ? "/dev/null" : `b/${relPath}`);
  }

  finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}


function redactedDiff(relPath: string, before: SnapshotEntry, after: SnapshotEntry): string {
  const beforeLabel = before.state === "missing"
    ? "missing"
    : before.state === "content"
      ? "text content"
      : `redacted ${before.reason}`;
  const afterLabel = after.state === "missing"
    ? "missing"
    : after.state === "content"
      ? "text content"
      : `redacted ${after.reason}`;

  return [
    `diff --git a/${relPath} b/${relPath}`,
    `--- a/${relPath}`,
    `+++ b/${relPath}`,
    "@@",
    `- [${beforeLabel}]`,
    `+ [${afterLabel}]`,
    "",
  ].join("\n");
}


function writePrivateFile(filePath: string, content: string): void {
  const fd = fs.openSync(filePath, "w", 0o600);

  try {
    fs.writeFileSync(fd, content, "utf-8");
  }

  finally {
    fs.closeSync(fd);
  }
}


function isSafeRepoRelativePath(relPath: string): boolean {
  return relPath !== "" && !path.isAbsolute(relPath) && !relPath.split(/[\\/]/).includes("..");
}


function isSensitivePath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/").toLowerCase();
  const segments = normalized.split("/");
  const base = path.basename(normalized);

  return (
    base.startsWith(".env") ||
    base.includes("credential") ||
    base.includes("secret") ||
    base.includes("token") ||
    base === "id_rsa" ||
    base === "id_dsa" ||
    base === "id_ecdsa" ||
    base === "id_ed25519" ||
    /\.(pem|key|p12|pfx|crt|cer)$/.test(base) ||
    segments.includes("credentials") ||
    segments.includes("secrets")
  );
}


function isBinaryBuffer(buffer: Buffer): boolean {
  if (buffer.includes(0)) {
    return true;
  }

  if (buffer.length === 0) {
    return false;
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  const text = sample.toString("utf-8");

  if (text.includes("\uFFFD")) {
    return true;
  }

  let suspicious = 0;

  for (const byte of sample) {
    const isAllowedControl = byte === 7 || byte === 8 || byte === 9 || byte === 10 || byte === 12 || byte === 13 || byte === 27;

    if ((byte < 32 && !isAllowedControl) || byte === 127) {
      suspicious++;
    }
  }

  return suspicious / sample.length > 0.3;
}


function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
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
  gitHeadReader?: GitHeadReader;
  /**
   * Injectable spawn for the DEFAULT (non-`reviewFn`) path — the process that
   * would normally invoke the real Analyst adapter. Receives (command, args)
   * and returns an exit code; tests use it to simulate the Analyst editing
   * the prompt file in place instead of shelling out.
   */
  spawnFn?: (command: string, args: string[]) => number;
  logFn?: (msg: string) => void;
  /** Bypass the single-task-in-run guard. */
  force?: boolean;
  /**
   * Injectable working-tree snapshot for the integrity guard. Defaults to
   * `snapshotWorkingTree`. Only applies to the default (non-`reviewFn`) path.
   */
  snapshotFn?: (repoRoot: string) => string;
  /** Directory for the Analyst transcript log. Defaults to .agent/review-transcripts. */
  transcriptsDir?: string;
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
  transcriptsDir?: string;
}


/** Headless instruction handed to the Analyst for the OUTPUT review gate. */
function buildOutputAnalystPrompt(
  promptRelPath: string,
  diffRelPath: string,
  nextRound: number,
): string {
  return [
    "You are running in Analyst role — the OUTPUT review gate.",
    `A Worker has implemented the prompt at: ${promptRelPath}. The resulting diff is saved at: ${diffRelPath}.`,
    "Normally this diff is computed against the pre-Worker snapshot captured by the workflow. If no snapshot exists, the workflow falls back to the historical whole-repo diff vs HEAD. Judge only the diff content provided in that file.",
    "Read both files. Judge whether the provided diff satisfies the prompt's `## Scope` and `## Acceptance criteria`: completeness, scope cleanliness (no out-of-scope edits), correctness, safety.",
    "Judge STATICALLY, from the diff and prompt only. Do NOT run build, tests, linters, or any command — `promote` re-executes build and tests as the real gate before this prompt can reach done/, so a criterion like \"tests green\" is verified there, not here. If the diff adds or updates the required tests and the code is correct, treat that criterion as satisfied; do NOT mark it unverifiable merely because you did not execute it.",
    `Write your verdict by editing ONLY the prompt file (${promptRelPath}): set frontmatter \`output_status\` to \`approved\` or \`changes-requested\`, and APPEND a new section under \`## Output review log\` (create the heading if absent) with the EXACT heading \`### Round ${nextRound} — <verdict>\` (never overwrite prior rounds), followed by bullet findings.`,
    "Use exactly the round number given above — do not compute or increment it yourself.",
    "Default to changes-requested if the diff is incomplete, out of scope, or logically inconsistent with the prompt — but NOT merely because a build or test command could not be executed in this environment. Approval is earned.",
    "Re-evaluate the CURRENT diff from scratch. Do not assume a finding from a previous `## Output review log` round still applies — verify each potential issue against the diff and prompt provided to you now before reporting it, and do not pattern-match against prior rounds.",
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
      : config.roles.outputAnalyst ?? config.roles.analyst;

  if (!analystRole) {
    throw new Error(`No "outputAnalyst" or "analyst" role in ${opts.configPath}. Add one or pass --analyst claude.`);
  }

  const timeoutMs = resolveAgentTimeoutMs(config);

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
    const { command, args } = buildRoleInvocation(analystRole, promptText, opts.repoRoot, config.mcpRegistry);
    opts.logFn(`[review-output] Analyst (${analystRole.binary}) reviewing diff…`);
    const transcriptPath = path.join(
      opts.transcriptsDir ?? REVIEW_TRANSCRIPTS_DIR,
      `${slugBase}-review-output-round${opts.nextRound}-analyst.log`,
    );
    const code = invokeAgentStep({
      role: "Analyst",
      command,
      args,
      cwd: opts.repoRoot,
      timeoutMs,
      spawnFn: opts.spawnFn,
      logFn: opts.logFn,
      transcriptPath,
      telemetry: {
        role: "analyst-output",
        binary: analystRole.binary,
        model: analystRole.model,
        mcpServers: analystRole.inheritGlobalMcp ? ["<global>"] : analystRole.mcpServers ?? [],
        promptBytes: byteSize(promptText),
        contextPackBytes: byteSize(promptText) + fileByteSize(diffPath) + fileByteSize(input.promptFile),
        diffBytes: fileByteSize(diffPath),
        transcriptPath,
      },
    });

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

  const promptFile = findPromptFileInFolder(slug, "run", tasksDir);

  // --- Single-task-in-run guard ----------------------------------------------
  assertSingleTaskInRun(tasksDir, path.basename(promptFile), options.force, "review-output");

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
    ], log);
    setOutputRound(promptFile, nextRound);
    log(`[review-output] round ${nextRound}: blocked-review (cap reached).`);

    return { slug, promptFile, outputStatus: "blocked-review", outputRound: nextRound, verdict: "blocked-review" };
  }

  const diff = options.diffFn
    ? options.diffFn(repoRoot)
    : computeWorkerDiff(repoRoot, slug, options.gitHeadReader) ?? computeGitDiff(repoRoot);
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
      transcriptsDir: options.transcriptsDir,
    });

    let verdict: "approved" | "changes-requested";
    const snapshotFn = options.snapshotFn ?? snapshotWorkingTree;

    try {
      const treeBefore = snapshotFn(repoRoot);
      analystFn({ diff, context, promptFile });
      const treeAfter = snapshotFn(repoRoot);

      assertWorkingTreeUnchanged(treeBefore, treeAfter, path.relative(repoRoot, promptFile), "[review-output]");

      const after = parsePrompt(fs.readFileSync(promptFile, "utf-8"));

      if (after.frontmatter.outputStatus === "approved" || after.frontmatter.outputStatus === "changes-requested") {
        assertLogRoundPresent(promptFile, "## Output review log", nextRound, "[review-output]");
        verdict = after.frontmatter.outputStatus;
      }

      else {
        verdict = "changes-requested";
        appendOutputReviewRound(promptFile, nextRound, verdict, [
          "Analyst did not write a parsable output_status — conservative changes-requested.",
        ], log);
      }
    }

    catch (err) {
      log(`[review-output] reviewer failed (${err instanceof Error ? err.message : String(err)}) — conservative changes-requested.`);
      verdict = "changes-requested";
      appendOutputReviewRound(promptFile, nextRound, verdict, [
        `Analyst step failed: ${err instanceof Error ? err.message : String(err)} — conservative changes-requested.`,
      ], log);
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

  appendOutputReviewRound(promptFile, nextRound, verdict, notes, log);
  setOutputStatus(promptFile, verdict);
  setOutputRound(promptFile, nextRound);
  log(`[review-output] round ${nextRound} verdict: ${verdict}`);

  return { slug, promptFile, outputStatus: verdict, outputRound: nextRound, verdict };
}

/** Max number of notes persisted per Output review log round — extras are dropped with a warning. */
const MAX_OUTPUT_NOTES = 10;

/**
 * Append a `### Round N — <verdict>` block under `## Output review log`
 * (append-only). Truncates `notes` to MAX_OUTPUT_NOTES, logging how many
 * were dropped rather than silently discarding them.
 */
function appendOutputReviewRound(
  filePath: string,
  round: number,
  verdict: string,
  notes: string[],
  logFn: (msg: string) => void = (msg) => console.log(msg),
): void {
  let effectiveNotes = notes;

  if (notes.length > MAX_OUTPUT_NOTES) {
    const dropped = notes.length - MAX_OUTPUT_NOTES;
    effectiveNotes = notes.slice(0, MAX_OUTPUT_NOTES);
    logFn(
      `[review-output] round ${round}: truncated ${dropped} note(s) beyond the ${MAX_OUTPUT_NOTES}-note cap.`,
    );
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const entry =
    `### Round ${round} — ${verdict}\n` + effectiveNotes.map((n) => `- ${n}`).join("\n") + "\n";

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
  force?: boolean;
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
  let force = false;

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

    else if (remaining[i] === "--force") {
      force = true;
    }
  }

  return { command, subcommand, slug, dir, adapter, execute, init, show, dryRun, analyst, maxRounds, force };
}

function main(): void {
  if (process.argv[2] === "--version" || process.argv[2] === "-v") {
    process.stdout.write(`agent-workflow ${readPackageVersion()}\n`);
    return;
  }

  const { command, subcommand, slug, dir, adapter, execute, init, show, dryRun, analyst, maxRounds, force } = parseArgs(process.argv);

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
      const result = runWorker(slug ?? "", adapter ?? "", { dryRun, force });

      if (result.dryRun) {
        console.log(`[dry-run] approved prompt ${path.basename(result.promptFile)} — would run: ${result.command} ${result.args.join(" ")}`);
      }

      else {
        console.log(`Worker run complete. Output saved: ${result.outputPath}`);
      }
    }

    else if (command === "review-output") {
      const result = runReviewOutput(slug ?? "", { maxRounds, analyst, force });
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
        `Usage: pnpm agent:workflow <status|lint|ready|sync|review|review-output|promote|adapters|config|run> [--slug <slug>] [--adapter <name>] [--dir <dir>] [--dry-run] [--analyst <codex|claude>] [--max-rounds <n>] [--force]`,
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
