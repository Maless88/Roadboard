import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  adaptersDryRun,
  adaptersList,
  adaptersRender,
  adaptersRun,
  checkTaskListStale,
  configInit,
  configShow,
  countFilesInFolder,
  getStatus,
  lintPromptContent,
  parsePrompt,
  readPackageVersion,
  runLint,
  runReady,
  runReview,
  runSync,
  runWorker,
  buildRoleInvocation,
  setPromptStatus,
  setOutputStatus,
  setOutputRound,
  setVerification,
  runReviewOutput,
  runPromote,
  countRunOutputStatuses,
} from "./agent-workflow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-workflow-test-"));
}

function writeFile(dir: string, name: string, content = "# stub"): string {
  const p = path.join(dir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
  return p;
}

// A fully valid, approved prompt under the review-gate model.
const VALID_PROMPT = `---
status: approved
review_round: 2
---

# feat-test: Test prompt

## Context

RoadBoard task abc123 — phase xyz.

## Scope

**In scope**

- Something

## Acceptance criteria

- [ ] Criterion one
- [ ] Criterion two

## Notes

Relevant files:

- scripts/agent-workflow.ts

## Review log

### Round 1 — changes-requested
- Tighten the acceptance criteria.

### Round 2 — approved
- All concerns resolved.
`;

// ---------------------------------------------------------------------------
// countFilesInFolder
// ---------------------------------------------------------------------------

describe("countFilesInFolder", () => {
  it("returns 0 for a non-existent folder", () => {
    expect(countFilesInFolder("/tmp/does-not-exist-12345")).toBe(0);
  });

  it("counts only .md files", () => {
    const dir = makeTempDir();

    writeFile(dir, "a.md");
    writeFile(dir, "b.md");
    writeFile(dir, "ignore.txt");

    expect(countFilesInFolder(dir)).toBe(2);

    fs.rmSync(dir, { recursive: true });
  });

  it("returns 0 for an empty folder", () => {
    const dir = makeTempDir();

    expect(countFilesInFolder(dir)).toBe(0);

    fs.rmSync(dir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// getStatus
// ---------------------------------------------------------------------------

describe("getStatus", () => {
  it("returns a count entry only for the three lifecycle folders", () => {
    const result = getStatus();

    expect(result.counts).toHaveLength(3);

    const folders = result.counts.map((c) => c.folder);
    expect(folders).toEqual(["todo", "run", "done"]);

    // Removed folders must NOT be tracked anymore.
    expect(folders).not.toContain("intake");
    expect(folders).not.toContain("reports");
    expect(folders).not.toContain("briefs");
    expect(folders).not.toContain("for-analyst");
    expect(folders).not.toContain("proposals");
  });

  it("count is a non-negative integer for every folder", () => {
    const result = getStatus();

    for (const { count } of result.counts) {
      expect(count).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(count)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// parsePrompt
// ---------------------------------------------------------------------------

describe("parsePrompt", () => {
  it("parses status and review_round from frontmatter", () => {
    const parsed = parsePrompt(VALID_PROMPT);

    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.frontmatter.status).toBe("approved");
    expect(parsed.frontmatter.reviewRound).toBe(2);
  });

  it("returns null status when frontmatter is absent", () => {
    const parsed = parsePrompt("# no frontmatter\n\nbody");

    expect(parsed.hasFrontmatter).toBe(false);
    expect(parsed.frontmatter.status).toBeNull();
    expect(parsed.frontmatter.reviewRound).toBeNull();
  });

  it("returns null status for an unknown status value", () => {
    const parsed = parsePrompt("---\nstatus: bogus\nreview_round: 0\n---\n# x");

    expect(parsed.frontmatter.status).toBeNull();
    expect(parsed.frontmatter.raw["status"]).toBe("bogus");
  });

  it("strips inline comments and quotes from values", () => {
    const parsed = parsePrompt('---\nstatus: draft   # initial\nreview_round: "0"\n---\n# x');

    expect(parsed.frontmatter.status).toBe("draft");
    expect(parsed.frontmatter.reviewRound).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// lintPromptContent (pure)
// ---------------------------------------------------------------------------

describe("lintPromptContent", () => {
  it("returns no errors and no warnings for a valid approved prompt", () => {
    const result = lintPromptContent(VALID_PROMPT);

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("reports an error when frontmatter is missing entirely", () => {
    const content = VALID_PROMPT.replace(/^---[\s\S]*?---\n/, "");
    const result = lintPromptContent(content);

    expect(result.errors).toContain("missing YAML frontmatter (--- ... ---)");
    expect(result.errors).toContain("missing frontmatter field: status");
    expect(result.errors).toContain("missing frontmatter field: review_round");
  });

  it("reports an error for an invalid status value", () => {
    const content = VALID_PROMPT.replace("status: approved", "status: shipping");
    const result = lintPromptContent(content);

    expect(result.errors.some((e) => e.includes("invalid frontmatter status"))).toBe(true);
  });

  it("reports an error for a non-numeric review_round", () => {
    const content = VALID_PROMPT.replace("review_round: 2", "review_round: two");
    const result = lintPromptContent(content);

    expect(result.errors.some((e) => e.includes("invalid frontmatter review_round"))).toBe(true);
  });

  it("reports an error when ## Context is missing", () => {
    const content = VALID_PROMPT.replace("## Context", "## Ctx");
    const result = lintPromptContent(content);

    expect(result.errors).toContain("missing section: ## Context");
  });

  it("reports an error when ## Scope is missing", () => {
    const content = VALID_PROMPT.replace("## Scope", "## Scp");
    const result = lintPromptContent(content);

    expect(result.errors).toContain("missing section: ## Scope");
  });

  it("reports an error when ## Acceptance criteria is missing", () => {
    const content = VALID_PROMPT.replace("## Acceptance criteria", "## AC");
    const result = lintPromptContent(content);

    expect(result.errors).toContain("missing section: ## Acceptance criteria");
  });

  it("reports an error when Acceptance criteria has no checklist item", () => {
    const content = VALID_PROMPT.replace("- [ ] Criterion one\n- [ ] Criterion two", "No items here");
    const result = lintPromptContent(content);

    expect(result.errors).toContain("missing checklist item in ## Acceptance criteria");
  });

  it("accepts a completed checklist item (- [x]) in Acceptance criteria", () => {
    const content = VALID_PROMPT.replace("- [ ] Criterion one", "- [x] Criterion one");
    const result = lintPromptContent(content);

    expect(result.errors).not.toContain("missing checklist item in ## Acceptance criteria");
  });

  it("reports an error for a malformed Review log (no round heading)", () => {
    const content = VALID_PROMPT.replace(
      "### Round 1 — changes-requested\n- Tighten the acceptance criteria.\n\n### Round 2 — approved\n- All concerns resolved.",
      "Some freeform text without a round heading.",
    );
    const result = lintPromptContent(content);

    expect(result.errors.some((e) => e.includes("malformed ## Review log"))).toBe(true);
  });

  it("warns when status is past draft but no Review log exists", () => {
    const noLog = VALID_PROMPT
      .replace("status: approved", "status: in-review")
      .replace(/## Review log[\s\S]*$/, "");
    const result = lintPromptContent(noLog);

    expect(result.warnings.some((w) => w.includes("no ## Review log"))).toBe(true);
  });

  it("does not warn about missing Review log when status is draft", () => {
    const draft = VALID_PROMPT
      .replace("status: approved", "status: draft")
      .replace(/## Review log[\s\S]*$/, "");
    const result = lintPromptContent(draft);

    expect(result.warnings.some((w) => w.includes("no ## Review log"))).toBe(false);
  });

  it("emits a warning (not error) when no RoadBoard task reference in Context", () => {
    const content = VALID_PROMPT.replace("RoadBoard task abc123 — phase xyz.", "Some unrelated context.");
    const result = lintPromptContent(content);

    expect(result.warnings.some((w) => w.includes("RoadBoard task"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runLint (filesystem) — pure-function level coverage
// ---------------------------------------------------------------------------

describe("runLint", () => {
  it("returns ok=true when the target folder does not exist", () => {
    const result = runLint("__nonexistent_dir__");

    expect(result.ok).toBe(true);
    expect(result.issues).toBe(0);
    expect(result.files).toHaveLength(0);
  });

  it("accepts an optional --dir argument", () => {
    const result = runLint("todo");

    expect(typeof result.ok).toBe("boolean");
    expect(typeof result.issues).toBe("number");
    expect(typeof result.message).toBe("string");
    expect(Array.isArray(result.files)).toBe(true);
  });

  it("a fully valid approved prompt produces no errors and is spawnable", () => {
    const { errors } = lintPromptContent(VALID_PROMPT);

    expect(errors).toHaveLength(0);
    expect(parsePrompt(VALID_PROMPT).frontmatter.status).toBe("approved");
  });

  it("a bare prompt with no sections and no frontmatter fails lint", () => {
    const { errors } = lintPromptContent("# bad\n\nNo sections here.\n");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain("missing YAML frontmatter (--- ... ---)");
    expect(errors.some((e) => e.includes("## Context"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runReady — approved-gate partitioning
// ---------------------------------------------------------------------------

describe("runReady", () => {
  it("returns approved and pending arrays", () => {
    const result = runReady();

    expect(Array.isArray(result.approved)).toBe(true);
    expect(Array.isArray(result.pending)).toBe(true);
  });

  it("approved entries reference .md filenames without a path prefix", () => {
    const result = runReady();

    for (const { file } of [...result.approved, ...result.pending]) {
      expect(file).toMatch(/\.md$/);
      expect(file).not.toContain("/");
    }
  });

  it("classifies approved vs non-approved correctly (via parsePrompt)", () => {
    const approved = parsePrompt(VALID_PROMPT).frontmatter.status;
    const inReview = parsePrompt(VALID_PROMPT.replace("status: approved", "status: in-review"))
      .frontmatter.status;

    expect(approved).toBe("approved");
    expect(inReview).toBe("in-review");
  });
});

// ---------------------------------------------------------------------------
// checkTaskListStale
// ---------------------------------------------------------------------------

describe("checkTaskListStale", () => {
  let tmpDir: string;
  let tasksDir: string;
  let taskListPath: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    tasksDir = path.join(tmpDir, "tasks");
    taskListPath = path.join(tmpDir, "TASK_LIST.md");
    fs.mkdirSync(path.join(tasksDir, "todo"), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, "run"), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, "done"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("reports missing when TASK_LIST.md does not exist", () => {
    const result = checkTaskListStale({ tasksDir, taskListPath });

    expect(result.exists).toBe(false);
    expect(result.stale).toBe(true);
    expect(result.taskListMtime).toBeNull();
  });

  it("reports up to date when TASK_LIST.md is newer than all task files", () => {
    writeFile(path.join(tasksDir, "todo"), "old-task.md", "# Old task");

    const past = new Date(Date.now() - 5000);
    fs.utimesSync(path.join(tasksDir, "todo", "old-task.md"), past, past);

    writeFile(tmpDir, "TASK_LIST.md", "# TASK_LIST\n");

    const result = checkTaskListStale({ tasksDir, taskListPath });

    expect(result.exists).toBe(true);
    expect(result.stale).toBe(false);
  });

  it("reports stale when a task file is newer than TASK_LIST.md", () => {
    writeFile(tmpDir, "TASK_LIST.md", "# TASK_LIST\n");
    const past = new Date(Date.now() - 5000);
    fs.utimesSync(taskListPath, past, past);

    writeFile(path.join(tasksDir, "todo"), "new-task.md", "# New task");

    const result = checkTaskListStale({ tasksDir, taskListPath });

    expect(result.exists).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.newestTaskMtime).not.toBeNull();
  });

  it("reports up to date when task folders are empty and TASK_LIST.md exists", () => {
    writeFile(tmpDir, "TASK_LIST.md", "# TASK_LIST\n");

    const result = checkTaskListStale({ tasksDir, taskListPath });

    expect(result.exists).toBe(true);
    expect(result.stale).toBe(false);
    expect(result.newestTaskMtime).toBeNull();
  });

  it("checks files in run/ and done/ as well as todo/", () => {
    writeFile(tmpDir, "TASK_LIST.md", "# TASK_LIST\n");
    const past = new Date(Date.now() - 5000);
    fs.utimesSync(taskListPath, past, past);

    writeFile(path.join(tasksDir, "done"), "finished.md", "# Done task");

    const result = checkTaskListStale({ tasksDir, taskListPath });

    expect(result.stale).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runSync
// ---------------------------------------------------------------------------

describe("runSync", () => {
  let tmpDir: string;
  let tasksDir: string;
  let taskListPath: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    tasksDir = path.join(tmpDir, "tasks");
    taskListPath = path.join(tmpDir, "TASK_LIST.md");
    fs.mkdirSync(path.join(tasksDir, "todo"), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, "run"), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, "done"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("creates TASK_LIST.md when it does not exist", () => {
    const result = runSync({ tasksDir, taskListPath });

    expect(fs.existsSync(taskListPath)).toBe(true);
    expect(result.outputPath).toBe(taskListPath);
  });

  it("returns correct counts reflecting the three lifecycle folders", () => {
    writeFile(path.join(tasksDir, "todo"), "task-a.md", "# Task A");
    writeFile(path.join(tasksDir, "todo"), "task-b.md", "# Task B");
    writeFile(path.join(tasksDir, "run"), "task-c.md", "# Task C");

    const result = runSync({ tasksDir, taskListPath });

    expect(result.todo).toBe(2);
    expect(result.run).toBe(1);
    expect(result.done).toBe(0);
  });

  it("does not move or delete any task files", () => {
    writeFile(path.join(tasksDir, "todo"), "keep-me.md", "# Keep");

    runSync({ tasksDir, taskListPath });

    expect(fs.existsSync(path.join(tasksDir, "todo", "keep-me.md"))).toBe(true);
  });

  it("overwrites existing TASK_LIST.md on re-sync", () => {
    writeFile(tmpDir, "TASK_LIST.md", "# OLD CONTENT");
    writeFile(path.join(tasksDir, "todo"), "task-new.md", "# New task");

    runSync({ tasksDir, taskListPath });

    const content = fs.readFileSync(taskListPath, "utf-8");

    expect(content).not.toContain("OLD CONTENT");
    expect(content).toContain("# TASK_LIST");
  });

  it("after sync, checkTaskListStale reports up to date", () => {
    writeFile(path.join(tasksDir, "todo"), "some-task.md", "# Task");

    runSync({ tasksDir, taskListPath });

    const past = new Date(Date.now() - 5000);
    fs.utimesSync(path.join(tasksDir, "todo", "some-task.md"), past, past);

    const stale = checkTaskListStale({ tasksDir, taskListPath });

    expect(stale.stale).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// adaptersList
// ---------------------------------------------------------------------------

describe("adaptersList", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns empty adapters array when no config file exists", () => {
    const result = adaptersList({ configPath: path.join(tmpDir, "nonexistent.json") });

    expect(result.adapters).toHaveLength(0);
  });

  it("returns adapter names and enabled status from config", () => {
    const configPath = path.join(tmpDir, "adapters.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        adapters: {
          codex: { enabled: true, binary: "/usr/local/bin/codex", outputDir: "/tmp" },
          claude: { enabled: false, binary: "/usr/local/bin/claude", outputDir: "/tmp" },
        },
      }),
      "utf-8",
    );

    const result = adaptersList({ configPath });

    expect(result.adapters).toHaveLength(2);

    const codex = result.adapters.find((a) => a.name === "codex");
    expect(codex?.enabled).toBe(true);

    const claude = result.adapters.find((a) => a.name === "claude");
    expect(claude?.enabled).toBe(false);
  });

  it("returns empty adapters when config has no adapters key", () => {
    const configPath = path.join(tmpDir, "adapters.json");
    fs.writeFileSync(configPath, JSON.stringify({ adapters: {} }), "utf-8");

    const result = adaptersList({ configPath });

    expect(result.adapters).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// adaptersRender
// ---------------------------------------------------------------------------

describe("adaptersRender", () => {
  let tmpDir: string;
  let tasksDir: string;
  let todoDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    tasksDir = path.join(tmpDir, "tasks");
    todoDir = path.join(tasksDir, "todo");
    fs.mkdirSync(todoDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws when slug is empty", () => {
    expect(() => adaptersRender("", { tasksDir })).toThrow("--slug is required");
  });

  it("throws when no file matches slug", () => {
    expect(() => adaptersRender("no-match-xyz", { tasksDir })).toThrow(
      'No prompt file found in tasks/todo/ matching slug: "no-match-xyz"',
    );
  });

  it("returns content of the matching prompt file", () => {
    const content = "# feat-smoke: Smoke test prompt\n\nHello world\n";
    writeFile(todoDir, "feat-smoke.md", content);

    const result = adaptersRender("smoke", { tasksDir });

    expect(result.slug).toBe("smoke");
    expect(result.content).toBe(content);
    expect(result.filePath).toContain("feat-smoke.md");
  });
});

// ---------------------------------------------------------------------------
// adaptersDryRun
// ---------------------------------------------------------------------------

describe("adaptersDryRun", () => {
  let tmpDir: string;
  let tasksDir: string;
  let todoDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    tasksDir = path.join(tmpDir, "tasks");
    todoDir = path.join(tasksDir, "todo");
    fs.mkdirSync(todoDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws when slug is empty", () => {
    expect(() => adaptersDryRun("", "codex", { tasksDir })).toThrow("--slug is required");
  });

  it("throws when adapter is empty", () => {
    writeFile(todoDir, "feat-foo.md", "# foo");
    expect(() => adaptersDryRun("foo", "", { tasksDir })).toThrow("--adapter is required");
  });

  it("returns placeholder command when no config exists", () => {
    writeFile(todoDir, "feat-dry.md", "# dry");

    const result = adaptersDryRun("dry", "codex", {
      configPath: path.join(tmpDir, "nonexistent.json"),
      tasksDir,
    });

    expect(result.command).toBe("<binary>");
    expect(result.args).toContain(path.join(todoDir, "feat-dry.md"));
  });

  it("returns configured binary path when config exists", () => {
    const configPath = path.join(tmpDir, "adapters.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        adapters: {
          codex: { enabled: true, binary: "/usr/local/bin/codex", outputDir: "/tmp" },
        },
      }),
      "utf-8",
    );
    writeFile(todoDir, "feat-cmd.md", "# cmd");

    const result = adaptersDryRun("cmd", "codex", { configPath, tasksDir });

    expect(result.command).toBe("/usr/local/bin/codex");
    expect(result.adapter).toBe("codex");
  });

  it("does not execute the binary (no side effects)", () => {
    writeFile(todoDir, "feat-noexec.md", "# noexec");

    const configPath = path.join(tmpDir, "adapters.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        adapters: {
          fake: { enabled: true, binary: "/nonexistent/binary", outputDir: "/tmp" },
        },
      }),
      "utf-8",
    );

    expect(() => adaptersDryRun("noexec", "fake", { configPath, tasksDir })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// adaptersRun
// ---------------------------------------------------------------------------

describe("adaptersRun", () => {
  let tmpDir: string;
  let tasksDir: string;
  let todoDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    tasksDir = path.join(tmpDir, "tasks");
    todoDir = path.join(tasksDir, "todo");
    fs.mkdirSync(todoDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws with safety gate message when --execute is not passed", () => {
    writeFile(todoDir, "feat-gate.md", "# gate");

    expect(() => adaptersRun("gate", "codex", false, { tasksDir })).toThrow("Safety gate");
  });

  it("throws when no config file exists even with --execute", () => {
    writeFile(todoDir, "feat-nocfg.md", "# nocfg");

    expect(() =>
      adaptersRun("nocfg", "codex", true, {
        configPath: path.join(tmpDir, "nonexistent.json"),
        tasksDir,
      }),
    ).toThrow("No adapter config found");
  });

  it("throws when adapter is disabled (enabled: false) even with --execute", () => {
    const configPath = path.join(tmpDir, "adapters.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        adapters: {
          codex: { enabled: false, binary: "/usr/local/bin/codex", outputDir: "/tmp" },
        },
      }),
      "utf-8",
    );
    writeFile(todoDir, "feat-disabled.md", "# disabled");

    expect(() => adaptersRun("disabled", "codex", true, { configPath, tasksDir })).toThrow(
      "disabled (enabled: false)",
    );
  });

  it("throws when adapter name not found in config", () => {
    const configPath = path.join(tmpDir, "adapters.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ adapters: { other: { enabled: true, binary: "/bin/other", outputDir: "/tmp" } } }),
      "utf-8",
    );
    writeFile(todoDir, "feat-unknown.md", "# unknown");

    expect(() => adaptersRun("unknown", "codex", true, { configPath, tasksDir })).toThrow(
      'Adapter "codex" not found in config',
    );
  });

  it("invokes binary and saves output when enabled and --execute passed", () => {
    const configPath = path.join(tmpDir, "adapters.json");
    const promptFile = path.join(todoDir, "feat-echo.md");
    writeFile(todoDir, "feat-echo.md", "# echo prompt\n");

    fs.writeFileSync(
      configPath,
      JSON.stringify({
        adapters: {
          echo: { enabled: true, binary: "/bin/echo", outputDir: tmpDir },
        },
      }),
      "utf-8",
    );

    const result = adaptersRun("echo", "echo", true, { configPath, tasksDir });

    expect(result.outputPath).toContain("echo-echo-output.md");
    expect(fs.existsSync(result.outputPath)).toBe(true);

    const output = fs.readFileSync(result.outputPath, "utf-8");
    expect(output).toContain(promptFile);
  });
});

// ---------------------------------------------------------------------------
// runWorker — the approved-gate spawn
// ---------------------------------------------------------------------------

describe("runWorker", () => {
  let tmpDir: string;
  let tasksDir: string;
  let todoDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    tasksDir = path.join(tmpDir, "tasks");
    todoDir = path.join(tasksDir, "todo");
    fs.mkdirSync(todoDir, { recursive: true });
    configPath = path.join(tmpDir, "adapters.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        adapters: {
          worker: { enabled: true, binary: "/bin/echo", outputDir: tmpDir },
        },
      }),
      "utf-8",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws when slug is empty", () => {
    expect(() => runWorker("", "worker", { tasksDir, configPath })).toThrow("--slug is required");
  });

  it("throws when adapter is empty", () => {
    writeFile(todoDir, "feat-x.md", "---\nstatus: approved\nreview_round: 1\n---\n# x");
    expect(() => runWorker("x", "", { tasksDir, configPath })).toThrow("--adapter is required");
  });

  it("REFUSES a prompt that is not approved (draft)", () => {
    writeFile(todoDir, "feat-draft.md", "---\nstatus: draft\nreview_round: 0\n---\n# draft prompt\n");

    expect(() => runWorker("draft", "worker", { tasksDir, configPath })).toThrow(
      /status="draft".*Only prompts with frontmatter status: approved/s,
    );
  });

  it("REFUSES a prompt in changes-requested", () => {
    writeFile(
      todoDir,
      "feat-cr.md",
      "---\nstatus: changes-requested\nreview_round: 1\n---\n# cr prompt\n",
    );

    expect(() => runWorker("cr", "worker", { tasksDir, configPath })).toThrow(/Refusing to run/);
  });

  it("REFUSES a prompt with no frontmatter status", () => {
    writeFile(todoDir, "feat-nofm.md", "# no frontmatter\n");

    expect(() => runWorker("nofm", "worker", { tasksDir, configPath })).toThrow(/status="unknown"/);
  });

  it("dry-run previews the command for an approved prompt without executing", () => {
    writeFile(
      todoDir,
      "feat-ok.md",
      "---\nstatus: approved\nreview_round: 2\n---\n# approved prompt\n",
    );

    let called = false;
    const result = runWorker("ok", "worker", {
      tasksDir,
      configPath,
      dryRun: true,
      execFn: () => {
        called = true;
        return "";
      },
      logFn: () => undefined,
    });

    expect(called).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.status).toBe("approved");
    expect(result.command).toBe("/bin/echo");
    expect(result.args[result.args.length - 1]).toContain("feat-ok.md");
    expect(result.outputPath).toBeNull();
  });

  it("executes the adapter on an approved prompt and saves output", () => {
    writeFile(
      todoDir,
      "feat-go.md",
      "---\nstatus: approved\nreview_round: 1\n---\n# go prompt\n",
    );

    const result = runWorker("go", "worker", {
      tasksDir,
      configPath,
      execFn: (binary, args) => `${binary} ${args.join(" ")}`,
      logFn: () => undefined,
    });

    expect(result.dryRun).toBe(false);
    expect(result.outputPath).not.toBeNull();
    expect(fs.existsSync(result.outputPath as string)).toBe(true);

    const output = fs.readFileSync(result.outputPath as string, "utf-8");
    expect(output).toContain("feat-go.md");
  });

  it("moves the approved prompt todo/ → run/ as part of spawning", () => {
    writeFile(
      todoDir,
      "feat-move.md",
      "---\nstatus: approved\nreview_round: 1\n---\n# move prompt\n",
    );

    const result = runWorker("move", "worker", {
      tasksDir,
      configPath,
      execFn: () => "ok",
      logFn: () => undefined,
    });

    expect(fs.existsSync(path.join(todoDir, "feat-move.md"))).toBe(false);
    expect(fs.existsSync(path.join(tasksDir, "run", "feat-move.md"))).toBe(true);
    expect(result.promptFile).toContain(path.join("run", "feat-move.md"));
  });

  it("runs an approved prompt already in run/ (retry) without moving", () => {
    const runDir = path.join(tasksDir, "run");
    fs.mkdirSync(runDir, { recursive: true });
    writeFile(
      runDir,
      "feat-retry.md",
      "---\nstatus: approved\nreview_round: 1\n---\n# retry prompt\n",
    );

    const result = runWorker("retry", "worker", {
      tasksDir,
      configPath,
      execFn: () => "ok",
      logFn: () => undefined,
    });

    expect(result.dryRun).toBe(false);
    expect(fs.existsSync(path.join(runDir, "feat-retry.md"))).toBe(true);
    expect(result.promptFile).toContain(path.join("run", "feat-retry.md"));
  });

  it("dry-run does not move the file todo/ → run/", () => {
    writeFile(
      todoDir,
      "feat-dry.md",
      "---\nstatus: approved\nreview_round: 1\n---\n# dry prompt\n",
    );

    runWorker("dry", "worker", {
      tasksDir,
      configPath,
      dryRun: true,
      execFn: () => "",
      logFn: () => undefined,
    });

    expect(fs.existsSync(path.join(todoDir, "feat-dry.md"))).toBe(true);
    expect(fs.existsSync(path.join(tasksDir, "run", "feat-dry.md"))).toBe(false);
  });

  it("throws when the prompt is in neither todo/ nor run/", () => {
    expect(() => runWorker("ghost", "worker", { tasksDir, configPath })).toThrow(
      /No prompt file found in tasks\/todo\/ or tasks\/run\/ matching slug: "ghost"/,
    );
  });

  it("throws when the adapter is disabled, even for an approved prompt", () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        adapters: { worker: { enabled: false, binary: "/bin/echo", outputDir: tmpDir } },
      }),
      "utf-8",
    );
    writeFile(
      todoDir,
      "feat-dis.md",
      "---\nstatus: approved\nreview_round: 1\n---\n# x\n",
    );

    expect(() => runWorker("dis", "worker", { tasksDir, configPath })).toThrow(
      /disabled \(enabled: false\)/,
    );
  });

  it("throws when adapter not found in config for an approved prompt", () => {
    writeFile(
      todoDir,
      "feat-miss.md",
      "---\nstatus: approved\nreview_round: 1\n---\n# x\n",
    );

    expect(() => runWorker("miss", "ghost", { tasksDir, configPath })).toThrow(
      /Adapter "ghost" not found/,
    );
  });

  it("REFUSES to run when tasks/run/ already contains another prompt (single-task-in-run)", () => {
    writeFile(
      todoDir,
      "feat-second.md",
      "---\nstatus: approved\nreview_round: 1\n---\n# second\n",
    );
    const runDir = path.join(tasksDir, "run");
    writeFile(runDir, "feat-first.md", "---\nstatus: approved\nreview_round: 1\n---\n# first\n");

    expect(() => runWorker("second", "worker", { tasksDir, configPath })).toThrow(
      /Refusing to run.*feat-first\.md.*single-task-in-run/s,
    );
  });

  it("--force bypasses the single-task-in-run guard on run", () => {
    writeFile(
      todoDir,
      "feat-second.md",
      "---\nstatus: approved\nreview_round: 1\n---\n# second\n",
    );
    const runDir = path.join(tasksDir, "run");
    writeFile(runDir, "feat-first.md", "---\nstatus: approved\nreview_round: 1\n---\n# first\n");

    const result = runWorker("second", "worker", {
      tasksDir,
      configPath,
      force: true,
      execFn: () => "ok",
      logFn: () => undefined,
    });

    expect(result.dryRun).toBe(false);
    expect(fs.existsSync(path.join(runDir, "feat-second.md"))).toBe(true);
  });

  it("does not count worker output artifacts (*-output.md) toward the single-task-in-run guard", () => {
    writeFile(
      todoDir,
      "feat-only.md",
      "---\nstatus: approved\nreview_round: 1\n---\n# only\n",
    );
    const runDir = path.join(tasksDir, "run");
    writeFile(runDir, "feat-stale-output.md", "some worker output artifact");

    const result = runWorker("only", "worker", {
      tasksDir,
      configPath,
      execFn: () => "ok",
      logFn: () => undefined,
    });

    expect(result.dryRun).toBe(false);
  });

  it("does not self-count the retried prompt already in run/ toward the single-task-in-run guard", () => {
    const runDir = path.join(tasksDir, "run");
    writeFile(runDir, "feat-retry2.md", "---\nstatus: approved\nreview_round: 1\n---\n# retry\n");

    const result = runWorker("retry2", "worker", {
      tasksDir,
      configPath,
      execFn: () => "ok",
      logFn: () => undefined,
    });

    expect(result.dryRun).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// configInit
// ---------------------------------------------------------------------------

describe("configInit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("creates workflow-adapters.json when it does not exist", () => {
    const agentDir = path.join(tmpDir, ".agent");
    const configPath = path.join(agentDir, "workflow-adapters.json");

    const result = configInit({ configPath, agentDir });

    expect(result.created).toBe(true);
    expect(result.filePath).toBe(configPath);
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("written file is valid JSON with adapters and roles keys", () => {
    const agentDir = path.join(tmpDir, ".agent");
    const configPath = path.join(agentDir, "workflow-adapters.json");

    configInit({ configPath, agentDir });

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    expect(parsed).toHaveProperty("adapters");
    expect(parsed).toHaveProperty("roles");
  });

  it("starter config includes roles.analyst and roles.architect", () => {
    const agentDir = path.join(tmpDir, ".agent");
    const configPath = path.join(agentDir, "workflow-adapters.json");

    configInit({ configPath, agentDir });

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    expect(parsed.roles).toHaveProperty("analyst");
    expect(parsed.roles).toHaveProperty("architect");
    expect(parsed.roles.analyst.binary).toBe("codex");
    expect(parsed.roles.architect.binary).toBe("claude");
    expect(parsed.roles.architect.flags).toContain("--dangerously-skip-permissions");
  });

  it("throws an error when the file already exists (does not overwrite)", () => {
    const agentDir = path.join(tmpDir, ".agent");
    const configPath = path.join(agentDir, "workflow-adapters.json");

    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ adapters: {}, roles: {} }), "utf-8");

    expect(() => configInit({ configPath, agentDir })).toThrow("already exists");

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.roles).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// configShow
// ---------------------------------------------------------------------------

describe("configShow", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws when config file does not exist", () => {
    const configPath = path.join(tmpDir, "nonexistent.json");

    expect(() => configShow({ configPath })).toThrow("No config file found");
  });

  it("returns parsed config and filePath when file exists", () => {
    const configPath = path.join(tmpDir, "adapters.json");
    const data = {
      adapters: {},
      roles: {
        analyst: { binary: "codex", model: "chatgpt-4.5", flags: [], systemPromptPath: "docs/templates/analyst-system-prompt.md" },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(data), "utf-8");

    const result = configShow({ configPath });

    expect(result.filePath).toBe(configPath);
    expect(result.config.roles?.analyst?.binary).toBe("codex");
  });

  it("parses roles with optional fields correctly", () => {
    const configPath = path.join(tmpDir, "adapters.json");
    const data = {
      adapters: {},
      roles: {
        architect: {
          binary: "claude",
          model: "opus",
          flags: ["--dangerously-skip-permissions"],
          systemPromptPath: "docs/templates/architect-system-prompt.md",
        },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(data), "utf-8");

    const result = configShow({ configPath });

    expect(result.config.roles?.architect?.model).toBe("opus");
    expect(result.config.roles?.architect?.flags).toContain("--dangerously-skip-permissions");
  });
});

// ---------------------------------------------------------------------------
// readPackageVersion
// ---------------------------------------------------------------------------

describe("readPackageVersion", () => {
  it("returns the version from the root package.json", () => {
    const root = path.resolve(__dirname, "..");
    const expected = (JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")) as { version: string }).version;
    expect(readPackageVersion()).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Review loop (Analyst review gate)
// ---------------------------------------------------------------------------

describe("buildRoleInvocation", () => {
  it("codex → exec with workspace-write sandbox and prompt last", () => {
    const { command, args } = buildRoleInvocation({ binary: "codex", flags: [] }, "PROMPT", "/repo");
    expect(command).toBe("codex");
    expect(args).toEqual([
      "exec", "--cd", "/repo", "--sandbox", "workspace-write", "--skip-git-repo-check", "PROMPT",
    ]);
  });

  it("claude → -p with --permission-mode acceptEdits when no permission flag", () => {
    const { command, args } = buildRoleInvocation({ binary: "claude", model: "opus", flags: [] }, "P", "/repo");
    expect(command).toBe("claude");
    expect(args).toEqual(["-p", "P", "--model", "opus", "--permission-mode", "acceptEdits"]);
  });

  it("claude → omits --permission-mode when a permission flag is already present", () => {
    const { args } = buildRoleInvocation(
      { binary: "claude", flags: ["--dangerously-skip-permissions"] }, "P", "/repo",
    );
    expect(args).toContain("--dangerously-skip-permissions");
    expect(args).not.toContain("--permission-mode");
  });
});

describe("setPromptStatus", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("flips only the frontmatter status line, leaving the body untouched", () => {
    const f = path.join(tmpDir, "p.md");
    fs.writeFileSync(f, "---\nstatus: draft\nreview_round: 0\n---\n# body mentions status: keepme\n");
    setPromptStatus(f, "approved");
    const out = fs.readFileSync(f, "utf-8");
    expect(out).toContain("status: approved");
    expect(out).toContain("# body mentions status: keepme");
    expect(out).not.toMatch(/status: draft/);
  });
});

describe("runReview", () => {
  let tmpDir: string;
  let tasksDir: string;
  let todoDir: string;
  let configPath: string;

  function writeConfig(): void {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        adapters: {},
        roles: {
          architect: { binary: "claude", model: "opus", flags: ["--dangerously-skip-permissions"] },
          analyst: { binary: "codex", flags: [] },
        },
      }),
      "utf-8",
    );
  }

  // Appends a "### Round N — verdict" entry under "## Review log" (creating
  // the heading if absent), mirroring what a real Analyst writes in place.
  function appendReviewLogRound(file: string, round: number, verdict: string): void {
    const content = fs.readFileSync(file, "utf-8");
    const entry = `### Round ${round} — ${verdict}\n- simulated verdict\n`;
    const updated = /## Review log/i.test(content)
      ? `${content.replace(/\s*$/, "\n")}\n${entry}`
      : `${content.replace(/\s*$/, "\n")}\n## Review log\n\n${entry}`;

    fs.writeFileSync(file, updated, "utf-8");
  }

  // Simulates the two agents by mutating the prompt's frontmatter status:
  // an Architect call sets in-review; an Analyst call applies the next scripted verdict
  // and appends the matching "## Review log" round (required by the integrity guard).
  function makeSpawn(file: string, verdicts: string[]): (cmd: string, args: string[]) => number {
    let v = 0;

    return (_cmd: string, args: string[]) => {
      const text = args.join(" ");

      if (text.includes("Architect role")) {
        setPromptStatus(file, "in-review");
      }

      else if (text.includes("Analyst role")) {
        const verdict = (verdicts[v++] ?? "changes-requested") as never;
        const round = parsePrompt(fs.readFileSync(file, "utf-8")).frontmatter.reviewRound ?? 0;
        setPromptStatus(file, verdict);
        appendReviewLogRound(file, round, verdict);
      }

      return 0;
    };
  }

  beforeEach(() => {
    tmpDir = makeTempDir();
    tasksDir = path.join(tmpDir, "tasks");
    todoDir = path.join(tasksDir, "todo");
    fs.mkdirSync(todoDir, { recursive: true });
    configPath = path.join(tmpDir, "adapters.json");
    writeConfig();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws when slug is empty", () => {
    expect(() => runReview("", { tasksDir, configPath })).toThrow("--slug is required");
  });

  it("draft → architect submits → analyst approves: outcome approved in 1 round", () => {
    const file = writeFile(todoDir, "feat-a.md", "---\nstatus: draft\nreview_round: 0\n---\n# a\n");
    const result = runReview("a", {
      tasksDir, configPath, spawnFn: makeSpawn(file, ["approved"]), logFn: () => undefined,
    });
    expect(result.outcome).toBe("approved");
    expect(result.finalStatus).toBe("approved");
    expect(result.rounds).toBe(1);
  });

  it("changes-requested then approved: outcome approved in 2 rounds", () => {
    const file = writeFile(todoDir, "feat-b.md", "---\nstatus: draft\nreview_round: 0\n---\n# b\n");
    const result = runReview("b", {
      tasksDir, configPath, spawnFn: makeSpawn(file, ["changes-requested", "approved"]), logFn: () => undefined,
    });
    expect(result.outcome).toBe("approved");
    expect(result.rounds).toBe(2);
  });

  it("never converges → blocked-review after maxRounds", () => {
    const file = writeFile(todoDir, "feat-c.md", "---\nstatus: draft\nreview_round: 0\n---\n# c\n");
    const result = runReview("c", {
      tasksDir, configPath, maxRounds: 3,
      spawnFn: makeSpawn(file, ["changes-requested", "changes-requested", "changes-requested"]),
      logFn: () => undefined,
    });
    expect(result.outcome).toBe("blocked-review");
    expect(result.rounds).toBe(3);
    expect(readPackageVersion).toBeDefined();
    expect(fs.readFileSync(file, "utf-8")).toContain("status: blocked-review");
  });

  it("already approved → returns immediately without spawning", () => {
    const file = writeFile(todoDir, "feat-d.md", "---\nstatus: approved\nreview_round: 2\n---\n# d\n");
    let called = false;
    const result = runReview("d", {
      tasksDir, configPath, spawnFn: () => { called = true; return 0; }, logFn: () => undefined,
    });
    expect(called).toBe(false);
    expect(result.outcome).toBe("approved");
    expect(result.rounds).toBe(0);
    expect(file).toBeDefined();
  });

  it("aborts if the Architect step does not set status to in-review", () => {
    const file = writeFile(todoDir, "feat-e.md", "---\nstatus: draft\nreview_round: 0\n---\n# e\n");
    // spawn that never mutates the file → architect leaves it at draft
    expect(() =>
      runReview("e", { tasksDir, configPath, spawnFn: () => 0, logFn: () => undefined }),
    ).toThrow(/did not set status to in-review/);
    expect(file).toBeDefined();
  });

  it("uses claude as Analyst when analyst='claude' (no codex role needed)", () => {
    const file = writeFile(todoDir, "feat-f.md", "---\nstatus: draft\nreview_round: 0\n---\n# f\n");
    const seen: string[] = [];
    const spawnFn = (cmd: string, args: string[]) => {
      seen.push(cmd);
      const text = args.join(" ");

      if (text.includes("Architect role")) {
        setPromptStatus(file, "in-review");
      }

      else if (text.includes("Analyst role")) {
        setPromptStatus(file, "approved");
        appendReviewLogRound(file, 0, "approved");
      }

      return 0;
    };
    const result = runReview("f", { tasksDir, configPath, analyst: "claude", spawnFn, logFn: () => undefined });
    expect(result.outcome).toBe("approved");
    // both architect and analyst invoked the claude binary
    expect(seen.every((c) => c === "claude")).toBe(true);
  });

  describe("integrity guards", () => {
    it("happy path: no-op snapshotFn never trips the working-tree guard", () => {
      const file = writeFile(todoDir, "feat-g.md", "---\nstatus: draft\nreview_round: 0\n---\n# g\n");
      const result = runReview("g", {
        tasksDir,
        configPath,
        spawnFn: makeSpawn(file, ["approved"]),
        snapshotFn: () => "constant",
        logFn: () => undefined,
      });

      expect(result.outcome).toBe("approved");
    });

    it("throws when the Analyst mutates the working tree beyond the reviewed prompt", () => {
      const file = writeFile(todoDir, "feat-h.md", "---\nstatus: draft\nreview_round: 0\n---\n# h\n");
      let call = 0;
      const result = runReview;

      expect(() =>
        result("h", {
          tasksDir,
          configPath,
          spawnFn: makeSpawn(file, ["approved"]),
          snapshotFn: () => (call++ === 0 ? "before" : "after: scripts/foo.ts changed"),
          logFn: () => undefined,
        }),
      ).toThrow(/Analyst modified tracked files outside the reviewed prompt/);
    });

    it("throws when the Analyst verdict has no matching Review log round", () => {
      const file = writeFile(todoDir, "feat-i.md", "---\nstatus: draft\nreview_round: 0\n---\n# i\n");
      const spawnFn = (_cmd: string, args: string[]) => {
        const text = args.join(" ");

        if (text.includes("Architect role")) {
          setPromptStatus(file, "in-review");
        }

        else if (text.includes("Analyst role")) {
          // Verdict written WITHOUT appending a "## Review log" round.
          setPromptStatus(file, "approved");
        }

        return 0;
      };

      expect(() =>
        runReview("i", {
          tasksDir, configPath, spawnFn, snapshotFn: () => "constant", logFn: () => undefined,
        }),
      ).toThrow(/verdict written without a matching "### Round 0" entry/);
    });
  });
});

// ---------------------------------------------------------------------------
// OUTPUT-GATE: frontmatter setters round-trip
// ---------------------------------------------------------------------------

describe("output-gate frontmatter setters", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("setOutputStatus inserts the field when absent, then rewrites it", () => {
    const f = path.join(tmpDir, "p.md");
    fs.writeFileSync(f, "---\nstatus: approved\nreview_round: 1\n---\n# body\n");

    setOutputStatus(f, "pending");
    let parsed = parsePrompt(fs.readFileSync(f, "utf-8"));
    expect(parsed.frontmatter.outputStatus).toBe("pending");
    expect(parsed.frontmatter.status).toBe("approved"); // untouched
    expect(fs.readFileSync(f, "utf-8")).toContain("# body");

    setOutputStatus(f, "approved");
    parsed = parsePrompt(fs.readFileSync(f, "utf-8"));
    expect(parsed.frontmatter.outputStatus).toBe("approved");
  });

  it("setOutputRound round-trips an integer", () => {
    const f = path.join(tmpDir, "p.md");
    fs.writeFileSync(f, "---\nstatus: approved\nreview_round: 1\noutput_round: 0\n---\n# x\n");

    setOutputRound(f, 2);
    expect(parsePrompt(fs.readFileSync(f, "utf-8")).frontmatter.outputRound).toBe(2);
  });

  it("setVerification writes a well-formed nested block that parses back", () => {
    const f = path.join(tmpDir, "p.md");
    fs.writeFileSync(f, "---\nstatus: approved\nreview_round: 1\n---\n# x\n");

    setVerification(f, { build: "pass", tests: "pass", evidence: "docs/shot.png" });
    const parsed = parsePrompt(fs.readFileSync(f, "utf-8"));

    expect(parsed.frontmatter.verification).toEqual({
      build: "pass",
      tests: "pass",
      evidence: "docs/shot.png",
    });
  });

  it("setVerification replaces an existing block rather than duplicating it", () => {
    const f = path.join(tmpDir, "p.md");
    fs.writeFileSync(
      f,
      "---\nstatus: approved\nreview_round: 1\nverification:\n  build: unknown\n  tests: unknown\n  evidence: \n---\n# x\n",
    );

    setVerification(f, { build: "pass", tests: "fail", evidence: "" });
    const content = fs.readFileSync(f, "utf-8");

    expect(content.match(/verification:/g)?.length).toBe(1);
    const parsed = parsePrompt(content);
    expect(parsed.frontmatter.verification?.build).toBe("pass");
    expect(parsed.frontmatter.verification?.tests).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// OUTPUT-GATE: lint of the new fields
// ---------------------------------------------------------------------------

describe("lintPromptContent — output-gate fields", () => {
  const BASE = `---
status: approved
review_round: 1
output_status: pending
output_round: 1
verification:
  build: pass
  tests: pass
  evidence: ""
---

# feat-x: x

## Context

RoadBoard task abc — phase.

## Scope

- Something

## Acceptance criteria

- [x] Done

## Review log

### Round 1 — approved
- ok

## Output review log

### Round 1 — approved
- diff ok
`;

  it("accepts valid output-gate fields with no errors", () => {
    const result = lintPromptContent(BASE);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects an invalid output_status value", () => {
    const bad = BASE.replace("output_status: pending", "output_status: shipping");
    const result = lintPromptContent(bad);
    expect(result.errors.some((e) => e.includes("invalid frontmatter output_status"))).toBe(true);
  });

  it("rejects a non-numeric output_round", () => {
    const bad = BASE.replace("output_round: 1", "output_round: two");
    const result = lintPromptContent(bad);
    expect(result.errors.some((e) => e.includes("invalid frontmatter output_round"))).toBe(true);
  });

  it("rejects an invalid verification.build state", () => {
    const bad = BASE.replace("build: pass", "build: green");
    const result = lintPromptContent(bad);
    expect(result.errors.some((e) => e.includes("invalid verification.build"))).toBe(true);
  });

  it("rejects a malformed ## Output review log", () => {
    const bad = BASE.replace(
      "### Round 1 — approved\n- diff ok",
      "freeform text with no round heading",
    );
    const result = lintPromptContent(bad);
    expect(result.errors.some((e) => e.includes("malformed ## Output review log"))).toBe(true);
  });

  it("does not require output-gate fields (absent is valid)", () => {
    expect(lintPromptContent(VALID_PROMPT).errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// OUTPUT-GATE: countRunOutputStatuses
// ---------------------------------------------------------------------------

describe("countRunOutputStatuses", () => {
  let tmpDir: string;
  let tasksDir: string;
  let runDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    tasksDir = path.join(tmpDir, "tasks");
    runDir = path.join(tasksDir, "run");
    fs.mkdirSync(runDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("tallies pending/approved/changes-requested in run/", () => {
    writeFile(runDir, "a.md", "---\nstatus: approved\nreview_round: 1\noutput_status: pending\n---\n# a");
    writeFile(runDir, "b.md", "---\nstatus: approved\nreview_round: 1\noutput_status: approved\n---\n# b");
    writeFile(runDir, "c.md", "---\nstatus: approved\nreview_round: 1\noutput_status: changes-requested\n---\n# c");
    writeFile(runDir, "d.md", "---\nstatus: approved\nreview_round: 1\n---\n# d (no output_status)");

    const counts = countRunOutputStatuses(tasksDir);
    expect(counts.pending).toBe(1);
    expect(counts.approved).toBe(1);
    expect(counts["changes-requested"]).toBe(1);
  });

  it("returns zeros when run/ is missing", () => {
    const counts = countRunOutputStatuses(path.join(tmpDir, "nope"));
    expect(counts).toEqual({ pending: 0, approved: 0, "changes-requested": 0 });
  });
});

// ---------------------------------------------------------------------------
// OUTPUT-GATE: runReviewOutput
// ---------------------------------------------------------------------------

describe("runReviewOutput", () => {
  let tmpDir: string;
  let tasksDir: string;
  let runDir: string;

  const RUN_PROMPT = `---
status: approved
review_round: 2
output_status: pending
output_round: 0
---

# feat-y: y

## Scope

- Implement Y

## Acceptance criteria

- [x] Y works
`;

  beforeEach(() => {
    tmpDir = makeTempDir();
    tasksDir = path.join(tmpDir, "tasks");
    runDir = path.join(tasksDir, "run");
    fs.mkdirSync(runDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws when slug is empty", () => {
    expect(() => runReviewOutput("", { tasksDir })).toThrow("--slug is required");
  });

  it("throws when no matching prompt in run/", () => {
    expect(() => runReviewOutput("ghost", { tasksDir })).toThrow(
      'No prompt file found in tasks/run/ matching slug: "ghost"',
    );
  });

  it("REFUSES review-output when run/ contains more than one prompt (single-task-in-run)", () => {
    writeFile(runDir, "feat-y.md", RUN_PROMPT);
    writeFile(runDir, "feat-other.md", "---\nstatus: approved\nreview_round: 1\n---\n# other\n");

    expect(() =>
      runReviewOutput("y", { tasksDir, diffFn: () => "d", reviewFn: () => "approved", logFn: () => undefined }),
    ).toThrow(/Refusing review-output.*feat-other\.md.*single-task-in-run/s);
  });

  it("--force bypasses the single-task-in-run guard on review-output", () => {
    const file = writeFile(runDir, "feat-y.md", RUN_PROMPT);
    writeFile(runDir, "feat-other.md", "---\nstatus: approved\nreview_round: 1\n---\n# other\n");

    const result = runReviewOutput("y", {
      tasksDir,
      force: true,
      diffFn: () => "d",
      reviewFn: () => "approved",
      logFn: () => undefined,
    });

    expect(result.verdict).toBe("approved");
    expect(parsePrompt(fs.readFileSync(file, "utf-8")).frontmatter.outputStatus).toBe("approved");
  });

  it("does not count worker output artifacts (*-output.md) toward the single-task-in-run guard", () => {
    writeFile(runDir, "feat-y.md", RUN_PROMPT);
    writeFile(runDir, "feat-stale-output.md", "some worker output artifact");

    const result = runReviewOutput("y", {
      tasksDir,
      diffFn: () => "d",
      reviewFn: () => "approved",
      logFn: () => undefined,
    });

    expect(result.verdict).toBe("approved");
  });

  it("writes approved verdict, increments round, appends Output review log", () => {
    const file = writeFile(runDir, "feat-y.md", RUN_PROMPT);
    const result = runReviewOutput("y", {
      tasksDir,
      diffFn: () => "diff --git a/x b/x",
      reviewFn: () => "approved",
      logFn: () => undefined,
    });

    expect(result.verdict).toBe("approved");
    expect(result.outputStatus).toBe("approved");
    expect(result.outputRound).toBe(1);

    const parsed = parsePrompt(fs.readFileSync(file, "utf-8"));
    expect(parsed.frontmatter.outputStatus).toBe("approved");
    expect(parsed.frontmatter.outputRound).toBe(1);
    expect(fs.readFileSync(file, "utf-8")).toMatch(/## Output review log[\s\S]*### Round 1 — approved/);
  });

  it("passes diff + Scope/Acceptance context to the review function", () => {
    writeFile(runDir, "feat-y.md", RUN_PROMPT);
    let seen: { diff: string; context: string } | null = null;

    runReviewOutput("y", {
      tasksDir,
      diffFn: () => "MY-DIFF",
      reviewFn: (input) => {
        seen = input;
        return "approved";
      },
      logFn: () => undefined,
    });

    expect(seen!.diff).toBe("MY-DIFF");
    expect(seen!.context).toContain("## Scope");
    expect(seen!.context).toContain("## Acceptance criteria");
  });

  it("writes changes-requested verdict", () => {
    const file = writeFile(runDir, "feat-y.md", RUN_PROMPT);
    const result = runReviewOutput("y", {
      tasksDir,
      diffFn: () => "d",
      reviewFn: () => "changes-requested",
      logFn: () => undefined,
    });

    expect(result.verdict).toBe("changes-requested");
    expect(parsePrompt(fs.readFileSync(file, "utf-8")).frontmatter.outputStatus).toBe("changes-requested");
  });

  it("defaults to changes-requested when the review function throws", () => {
    writeFile(runDir, "feat-y.md", RUN_PROMPT);
    const result = runReviewOutput("y", {
      tasksDir,
      diffFn: () => "d",
      reviewFn: () => {
        throw new Error("boom");
      },
      logFn: () => undefined,
    });

    expect(result.verdict).toBe("changes-requested");
  });

  it("caps at maxRounds → blocked-review", () => {
    // Prompt already at output_round: 3 with maxRounds 3 → next call is blocked.
    const file = writeFile(
      runDir,
      "feat-cap.md",
      RUN_PROMPT.replace("output_round: 0", "output_round: 3"),
    );

    const result = runReviewOutput("cap", {
      tasksDir,
      maxRounds: 3,
      diffFn: () => "d",
      reviewFn: () => "changes-requested",
      logFn: () => undefined,
    });

    expect(result.verdict).toBe("blocked-review");
    expect(result.outputStatus).toBe("blocked-review");
    expect(parsePrompt(fs.readFileSync(file, "utf-8")).frontmatter.outputStatus).toBe("blocked-review");
  });

  it("REFUSES when output_status is not pending", () => {
    writeFile(runDir, "feat-y.md", RUN_PROMPT.replace("output_status: pending", "output_status: approved"));

    expect(() =>
      runReviewOutput("y", { tasksDir, diffFn: () => "d", reviewFn: () => "approved", logFn: () => undefined }),
    ).toThrow(/output_status="approved"/);
  });

  describe("default (file-based) Analyst path", () => {
    let configPath: string;

    function writeConfig(): void {
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          adapters: {},
          roles: {
            architect: { binary: "claude", model: "opus", flags: ["--dangerously-skip-permissions"] },
            analyst: { binary: "codex", flags: [] },
          },
        }),
        "utf-8",
      );
    }

    beforeEach(() => {
      configPath = path.join(tmpDir, "adapters.json");
      writeConfig();
    });

    it("reads the verdict back from the file the Analyst edited (approved)", () => {
      const file = writeFile(runDir, "feat-y.md", RUN_PROMPT);
      const result = runReviewOutput("y", {
        tasksDir,
        configPath,
        diffFn: () => "diff --git a/x b/x",
        spawnFn: () => {
          setOutputStatus(file, "approved");
          fs.appendFileSync(file, "\n## Output review log\n\n### Round 1 — approved\n- looks good\n");

          return 0;
        },
        logFn: () => undefined,
      });

      expect(result.verdict).toBe("approved");
      expect(result.outputStatus).toBe("approved");
      expect(result.outputRound).toBe(1);
      const parsed = parsePrompt(fs.readFileSync(file, "utf-8"));
      expect(parsed.frontmatter.outputStatus).toBe("approved");
      expect(parsed.frontmatter.outputRound).toBe(1);
    });

    it("reads the verdict back from the file the Analyst edited (changes-requested)", () => {
      const file = writeFile(runDir, "feat-y.md", RUN_PROMPT);
      const result = runReviewOutput("y", {
        tasksDir,
        configPath,
        diffFn: () => "d",
        spawnFn: () => {
          setOutputStatus(file, "changes-requested");
          fs.appendFileSync(file, "\n## Output review log\n\n### Round 1 — changes-requested\n- missing tests\n");

          return 0;
        },
        logFn: () => undefined,
      });

      expect(result.verdict).toBe("changes-requested");
      expect(parsePrompt(fs.readFileSync(file, "utf-8")).frontmatter.outputStatus).toBe("changes-requested");
    });

    it("falls back to changes-requested when the Analyst writes nothing parsable", () => {
      const file = writeFile(runDir, "feat-y.md", RUN_PROMPT);
      const result = runReviewOutput("y", {
        tasksDir,
        configPath,
        diffFn: () => "d",
        spawnFn: () => 0, // Analyst "runs" but never touches output_status
        logFn: () => undefined,
      });

      expect(result.verdict).toBe("changes-requested");
      const out = fs.readFileSync(file, "utf-8");
      expect(parsePrompt(out).frontmatter.outputStatus).toBe("changes-requested");
      expect(out).toMatch(/### Round 1 — changes-requested/);
      expect(out).toContain("did not write a parsable output_status");
    });

    it("round-number invariant: first review yields Round 1, second yields Round 2", () => {
      const file = writeFile(runDir, "feat-y.md", RUN_PROMPT);
      let seenRound = 0;

      const spawnFn = (_cmd: string, args: string[]) => {
        const promptText = args.join(" ");
        const match = promptText.match(/Round (\d+)/);
        seenRound = match ? Number.parseInt(match[1], 10) : 0;
        setOutputStatus(file, "changes-requested");
        fs.appendFileSync(file, `\n## Output review log\n\n### Round ${seenRound} — changes-requested\n- more work needed\n`);

        return 0;
      };

      const first = runReviewOutput("y", { tasksDir, configPath, diffFn: () => "d", spawnFn, logFn: () => undefined });
      expect(seenRound).toBe(1);
      expect(first.outputRound).toBe(1);
      expect(parsePrompt(fs.readFileSync(file, "utf-8")).frontmatter.outputRound).toBe(1);

      // Worker addresses feedback and resets to pending for a second pass.
      setOutputStatus(file, "pending");

      const second = runReviewOutput("y", { tasksDir, configPath, diffFn: () => "d", spawnFn, logFn: () => undefined });
      expect(seenRound).toBe(2);
      expect(second.outputRound).toBe(2);
      expect(parsePrompt(fs.readFileSync(file, "utf-8")).frontmatter.outputRound).toBe(2);
    });

    describe("integrity guards", () => {
      it("happy path: no-op snapshotFn never trips the working-tree guard", () => {
        const file = writeFile(runDir, "feat-y.md", RUN_PROMPT);
        const result = runReviewOutput("y", {
          tasksDir,
          configPath,
          diffFn: () => "d",
          snapshotFn: () => "constant",
          spawnFn: () => {
            setOutputStatus(file, "approved");
            fs.appendFileSync(file, "\n## Output review log\n\n### Round 1 — approved\n- looks good\n");

            return 0;
          },
          logFn: () => undefined,
        });

        expect(result.verdict).toBe("approved");
      });

      it("falls back to changes-requested when the Analyst mutates the working tree beyond the reviewed prompt", () => {
        const file = writeFile(runDir, "feat-y.md", RUN_PROMPT);
        let call = 0;
        const result = runReviewOutput("y", {
          tasksDir,
          configPath,
          diffFn: () => "d",
          snapshotFn: () => (call++ === 0 ? "before" : "after: scripts/foo.ts changed"),
          spawnFn: () => {
            setOutputStatus(file, "approved");
            fs.appendFileSync(file, "\n## Output review log\n\n### Round 1 — approved\n- looks good\n");

            return 0;
          },
          logFn: () => undefined,
        });

        expect(result.verdict).toBe("changes-requested");
        expect(fs.readFileSync(file, "utf-8")).toContain("Analyst modified tracked files outside the reviewed prompt");
      });

      it("falls back to changes-requested when the verdict has no matching Output review log round", () => {
        const file = writeFile(runDir, "feat-y.md", RUN_PROMPT);
        const result = runReviewOutput("y", {
          tasksDir,
          configPath,
          diffFn: () => "d",
          snapshotFn: () => "constant",
          spawnFn: () => {
            // Verdict written WITHOUT appending an "## Output review log" round.
            setOutputStatus(file, "approved");

            return 0;
          },
          logFn: () => undefined,
        });

        expect(result.verdict).toBe("changes-requested");
        expect(fs.readFileSync(file, "utf-8")).toContain('verdict written without a matching "### Round 1" entry');
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Integrity guard: real-git dirty-tree detection (snapshotWorkingTree)
// ---------------------------------------------------------------------------

describe("runReviewOutput — real-git dirty-tree detection", () => {
  let repoRoot: string;
  let tasksDir: string;
  let runDir: string;
  let configPath: string;

  const RUN_PROMPT = `---
status: approved
review_round: 2
output_status: pending
output_round: 0
---

# feat-z: z

## Scope

- Implement Z

## Acceptance criteria

- [x] Z works
`;

  function git(args: string[]): void {
    child_process.execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8" });
  }

  beforeEach(() => {
    repoRoot = makeTempDir();
    git(["init", "-q"]);
    git(["config", "user.email", "test@test.com"]);
    git(["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(repoRoot, "foo.ts"), "export const a = 1;\n");
    // Mirrors the real project: .agent/ (the default Analyst diff-file scratch
    // dir) is gitignored, so its writes never surface in `git status`.
    fs.writeFileSync(path.join(repoRoot, ".gitignore"), ".agent/\n");
    tasksDir = path.join(repoRoot, "tasks");
    runDir = path.join(tasksDir, "run");
    fs.mkdirSync(runDir, { recursive: true });
    // Track tasks/run/ itself so a later new prompt file shows as its own
    // "?? tasks/run/<file>" porcelain line rather than a collapsed untracked
    // "?? tasks/" directory entry.
    fs.writeFileSync(path.join(runDir, ".gitkeep"), "");
    configPath = path.join(repoRoot, "adapters.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        adapters: {},
        roles: {
          architect: { binary: "claude", model: "opus", flags: [] },
          analyst: { binary: "codex", flags: [] },
        },
      }),
      "utf-8",
    );
    git(["add", "-A"]);
    git(["commit", "-q", "-m", "init"]);
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("detects a newly-modified tracked file (positive)", () => {
    const file = writeFile(runDir, "feat-z.md", RUN_PROMPT);
    const result = runReviewOutput("z", {
      tasksDir,
      configPath,
      repoRoot,
      diffFn: () => "d",
      spawnFn: () => {
        // Analyst mutates a tracked file that was clean before this step.
        fs.writeFileSync(path.join(repoRoot, "foo.ts"), "export const a = 2;\n");
        setOutputStatus(file, "approved");
        fs.appendFileSync(file, "\n## Output review log\n\n### Round 1 — approved\n- ok\n");

        return 0;
      },
      logFn: () => undefined,
    });

    expect(result.verdict).toBe("changes-requested");
    expect(fs.readFileSync(file, "utf-8")).toContain("foo.ts");
  });

  it("detects a content change inside an already-dirty tracked file (positive)", () => {
    // foo.ts is ALREADY dirty before the Analyst step — porcelain shows "M foo.ts"
    // both before and after, so only the git-diff content comparison catches this.
    fs.writeFileSync(path.join(repoRoot, "foo.ts"), "export const a = 2;\n");
    const file = writeFile(runDir, "feat-z.md", RUN_PROMPT);
    const result = runReviewOutput("z", {
      tasksDir,
      configPath,
      repoRoot,
      diffFn: () => "d",
      spawnFn: () => {
        fs.writeFileSync(path.join(repoRoot, "foo.ts"), "export const a = 3;\n");
        setOutputStatus(file, "approved");
        fs.appendFileSync(file, "\n## Output review log\n\n### Round 1 — approved\n- ok\n");

        return 0;
      },
      logFn: () => undefined,
    });

    expect(result.verdict).toBe("changes-requested");
    expect(fs.readFileSync(file, "utf-8")).toContain("foo.ts");
  });

  it("ignores a change confined to the prompt file under review (negative)", () => {
    const file = writeFile(runDir, "feat-z.md", RUN_PROMPT);
    const result = runReviewOutput("z", {
      tasksDir,
      configPath,
      repoRoot,
      diffFn: () => "d",
      spawnFn: () => {
        // Only the reviewed prompt file changes — expected and exempted.
        setOutputStatus(file, "approved");
        fs.appendFileSync(file, "\n## Output review log\n\n### Round 1 — approved\n- ok\n");

        return 0;
      },
      logFn: () => undefined,
    });

    expect(result.verdict).toBe("approved");
  });
});

// ---------------------------------------------------------------------------
// OUTPUT-GATE: runPromote (the single run→done path)
// ---------------------------------------------------------------------------

describe("runPromote", () => {
  let tmpDir: string;
  let tasksDir: string;
  let runDir: string;
  let doneDir: string;
  let configPath: string;
  let repoRoot: string;

  const APPROVED = `---
status: approved
review_round: 2
output_status: approved
output_round: 1
verification:
  build: unknown
  tests: unknown
  evidence: ""
---

# feat-z: z

## Scope

- Z

## Acceptance criteria

- [x] Z done
`;

  function writeConfig(build: string, tests: string): void {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ adapters: {}, verify: { build, tests } }),
      "utf-8",
    );
  }

  beforeEach(() => {
    tmpDir = makeTempDir();
    repoRoot = tmpDir;
    tasksDir = path.join(tmpDir, "tasks");
    runDir = path.join(tasksDir, "run");
    doneDir = path.join(tasksDir, "done");
    fs.mkdirSync(runDir, { recursive: true });
    fs.mkdirSync(doneDir, { recursive: true });
    configPath = path.join(tmpDir, "adapters.json");
    writeConfig("true", "true");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws when slug is empty", () => {
    expect(() => runPromote("", { tasksDir, configPath, repoRoot })).toThrow("--slug is required");
  });

  it("REFUSES when output_status is not approved", () => {
    writeFile(runDir, "feat-z.md", APPROVED.replace("output_status: approved", "output_status: pending"));

    expect(() => runPromote("z", { tasksDir, configPath, repoRoot, runCmdFn: () => 0, logFn: () => undefined }))
      .toThrow(/output_status="pending"/);
  });

  it("REFUSES and does not move when build fails", () => {
    writeConfig("BUILDCMD", "TESTCMD");
    const file = writeFile(runDir, "feat-z.md", APPROVED);

    expect(() =>
      runPromote("z", {
        tasksDir, configPath, repoRoot, logFn: () => undefined,
        runCmdFn: (cmd) => (cmd === "BUILDCMD" ? 1 : 0),
      }),
    ).toThrow(/build failed/);

    expect(fs.existsSync(file)).toBe(true);
    expect(parsePrompt(fs.readFileSync(file, "utf-8")).frontmatter.verification?.build).toBe("fail");
  });

  it("REFUSES and does not move when tests fail", () => {
    writeConfig("BUILDCMD", "TESTCMD");
    const file = writeFile(runDir, "feat-z.md", APPROVED);

    expect(() =>
      runPromote("z", {
        tasksDir, configPath, repoRoot, logFn: () => undefined,
        runCmdFn: (cmd) => (cmd === "TESTCMD" ? 1 : 0),
      }),
    ).toThrow(/tests failed/);

    expect(fs.existsSync(file)).toBe(true);
  });

  it("REFUSES when evidence is required (requires_evidence) but empty", () => {
    writeFile(
      runDir,
      "feat-z.md",
      APPROVED.replace("output_round: 1", "output_round: 1\nrequires_evidence: true"),
    );

    expect(() =>
      runPromote("z", { tasksDir, configPath, repoRoot, runCmdFn: () => 0, logFn: () => undefined }),
    ).toThrow(/requires evidence/);
  });

  it("REFUSES when verification.evidence points to a missing file", () => {
    writeFile(
      runDir,
      "feat-z.md",
      APPROVED.replace('evidence: ""', "evidence: docs/nope.png"),
    );

    expect(() =>
      runPromote("z", { tasksDir, configPath, repoRoot, runCmdFn: () => 0, logFn: () => undefined }),
    ).toThrow(/does not exist/);
  });

  it("SUCCEEDS and moves run/→done/ in the happy path", () => {
    const file = writeFile(runDir, "feat-z.md", APPROVED);
    const calls: string[] = [];

    const result = runPromote("z", {
      tasksDir, configPath, repoRoot, logFn: () => undefined,
      runCmdFn: (cmd) => {
        calls.push(cmd);
        return 0;
      },
    });

    expect(result.moved).toBe(true);
    expect(result.verification.build).toBe("pass");
    expect(result.verification.tests).toBe("pass");
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(path.join(doneDir, "feat-z.md"))).toBe(true);
    expect(calls).toEqual(["true", "true"]);
  });

  it("SUCCEEDS with a UI label when evidence file exists", () => {
    fs.mkdirSync(path.join(repoRoot, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "docs", "shot.png"), "img");
    writeFile(
      runDir,
      "feat-z.md",
      APPROVED
        .replace("output_round: 1", "output_round: 1\nlabel: ui")
        .replace('evidence: ""', "evidence: docs/shot.png"),
    );

    const result = runPromote("z", {
      tasksDir, configPath, repoRoot, runCmdFn: () => 0, logFn: () => undefined,
    });

    expect(result.moved).toBe(true);
    expect(fs.existsSync(path.join(doneDir, "feat-z.md"))).toBe(true);
  });

  it("--dry-run reports without running commands or moving the file", () => {
    const file = writeFile(runDir, "feat-z.md", APPROVED);
    let called = false;

    const result = runPromote("z", {
      tasksDir, configPath, repoRoot, dryRun: true, logFn: () => undefined,
      runCmdFn: () => {
        called = true;
        return 0;
      },
    });

    expect(result.dryRun).toBe(true);
    expect(result.moved).toBe(false);
    expect(called).toBe(false);
    expect(fs.existsSync(file)).toBe(true);
  });

  it("uses default verify commands when config has no verify block", () => {
    fs.writeFileSync(configPath, JSON.stringify({ adapters: {} }), "utf-8");
    writeFile(runDir, "feat-z.md", APPROVED);
    const calls: string[] = [];

    runPromote("z", {
      tasksDir, configPath, repoRoot, logFn: () => undefined,
      runCmdFn: (cmd) => {
        calls.push(cmd);
        return 0;
      },
    });

    expect(calls).toEqual(["pnpm build", "pnpm test"]);
  });
});
