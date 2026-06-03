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

  // Simulates the two agents by mutating the prompt's frontmatter status:
  // an Architect call sets in-review; an Analyst call applies the next scripted verdict.
  function makeSpawn(file: string, verdicts: string[]): (cmd: string, args: string[]) => number {
    let v = 0;

    return (_cmd: string, args: string[]) => {
      const text = args.join(" ");

      if (text.includes("Architect role")) {
        setPromptStatus(file, "in-review");
      }

      else if (text.includes("Analyst role")) {
        setPromptStatus(file, (verdicts[v++] ?? "changes-requested") as never);
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
      }

      return 0;
    };
    const result = runReview("f", { tasksDir, configPath, analyst: "claude", spawnFn, logFn: () => undefined });
    expect(result.outcome).toBe("approved");
    // both architect and analyst invoked the claude binary
    expect(seen.every((c) => c === "claude")).toBe(true);
  });
});
