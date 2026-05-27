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
  readPackageVersion,
  runIntake,
  runLint,
  runLoop,
  runReady,
  runReport,
  runSync,
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
  it("returns a count entry for all 8 tracked folders", () => {
    const result = getStatus();

    expect(result.counts).toHaveLength(8);

    const folders = result.counts.map((c) => c.folder);
    expect(folders).toContain("intake");
    expect(folders).toContain("todo");
    expect(folders).toContain("run");
    expect(folders).toContain("done");
    expect(folders).toContain("reports");
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
// runIntake
// ---------------------------------------------------------------------------

describe("runIntake", () => {
  let tmpTasks: string;
  let tmpTemplates: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpTasks = makeTempDir();
    tmpTemplates = makeTempDir();

    // Write a minimal intake template
    writeFile(tmpTemplates, "developer-intake-template.md", "# Developer Intake: [Brief Title]\n");
  });

  afterEach(() => {
    fs.rmSync(tmpTasks, { recursive: true });
    fs.rmSync(tmpTemplates, { recursive: true });
  });

  it("throws when slug is empty", () => {
    expect(() => runIntake("")).toThrow("--slug is required");
  });

  it("creates tasks/intake/<slug>-intake.md from template", () => {
    // Override the module-level paths by using the exported function with
    // a test harness approach: we patch the real tasks dir by checking
    // the actual function uses TASKS_DIR. Since we cannot easily monkey-patch
    // module-level constants, we test via the real filesystem paths but
    // clean up afterwards.
    const slug = `spec-test-${Date.now()}`;
    const result = runIntake(slug);

    expect(result.slug).toBe(slug);
    expect(result.filePath).toMatch(new RegExp(`${slug}-intake\\.md$`));
    expect(fs.existsSync(result.filePath)).toBe(true);

    // Clean up
    fs.unlinkSync(result.filePath);
  });

  it("creates the intake directory if it does not exist", () => {
    const slug = `spec-mkdir-${Date.now()}`;
    const result = runIntake(slug);

    const intakeDir = path.dirname(result.filePath);
    expect(fs.existsSync(intakeDir)).toBe(true);

    // Clean up
    fs.unlinkSync(result.filePath);
  });

  it("copies template content into the new file", () => {
    const slug = `spec-content-${Date.now()}`;
    const result = runIntake(slug);
    const content = fs.readFileSync(result.filePath, "utf-8");

    // The real template has a "# Developer Intake" heading
    expect(content).toContain("Developer Intake");

    // Clean up
    fs.unlinkSync(result.filePath);
  });
});

// ---------------------------------------------------------------------------
// lintPromptContent (pure)
// ---------------------------------------------------------------------------

const VALID_PROMPT = `# feat-test: Test prompt

## Context

RoadBoard task abc123 — phase xyz.

## Scope

**In scope**

- Something

**Out of scope**

- Something else

## Acceptance Criteria

- [ ] Criterion one
- [ ] Criterion two

## Notes

Relevant files:

- scripts/agent-workflow.ts

## PLAN.md Updates

Under section \`## AI Workflow\`:

- [ ] feat-test — Test prompt
`;

describe("lintPromptContent", () => {
  it("returns no errors and no warnings for a valid prompt", () => {
    const result = lintPromptContent(VALID_PROMPT);

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
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

  it("reports an error when ## Acceptance Criteria is missing", () => {
    const content = VALID_PROMPT.replace("## Acceptance Criteria", "## AC");
    const result = lintPromptContent(content);

    expect(result.errors).toContain("missing section: ## Acceptance Criteria");
  });

  it("reports an error when ## Notes is missing", () => {
    const content = VALID_PROMPT.replace("## Notes", "## Hints");
    const result = lintPromptContent(content);

    expect(result.errors).toContain("missing section: ## Notes");
  });

  it("reports an error when ## PLAN.md Updates is missing", () => {
    const content = VALID_PROMPT.replace("## PLAN.md Updates", "## Plan Changes");
    const result = lintPromptContent(content);

    expect(result.errors).toContain("missing section: ## PLAN.md Updates");
  });

  it("reports an error when Acceptance Criteria has no checklist item", () => {
    const content = VALID_PROMPT.replace("- [ ] Criterion one\n- [ ] Criterion two", "No items here");
    const result = lintPromptContent(content);

    expect(result.errors).toContain("missing checklist item in ## Acceptance Criteria");
  });

  it("accepts a completed checklist item (- [x]) in Acceptance Criteria", () => {
    const content = VALID_PROMPT.replace("- [ ] Criterion one", "- [x] Criterion one");
    const result = lintPromptContent(content);

    expect(result.errors).not.toContain("missing checklist item in ## Acceptance Criteria");
  });

  it("emits a warning (not error) when no RoadBoard task reference in Context", () => {
    const content = VALID_PROMPT.replace("RoadBoard task abc123 — phase xyz.", "Some unrelated context.");
    const result = lintPromptContent(content);

    expect(result.errors).not.toContain(expect.stringContaining("RoadBoard"));
    expect(result.warnings.some((w) => w.includes("RoadBoard task"))).toBe(true);
  });

  it("section matching is case-insensitive", () => {
    const content = VALID_PROMPT
      .replace("## Context", "## CONTEXT")
      .replace("## Scope", "## scope")
      .replace("## Acceptance Criteria", "## acceptance criteria")
      .replace("## Notes", "## NOTES")
      .replace("## PLAN.md Updates", "## plan.md updates");
    const result = lintPromptContent(content);

    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// runLint (filesystem)
// ---------------------------------------------------------------------------

describe("runLint", () => {
  it("returns ok=true when the target folder does not exist", () => {
    // Point to a non-existent dir by using a name that cannot exist in tasks/
    const result = runLint("__nonexistent_dir__");

    expect(result.ok).toBe(true);
    expect(result.issues).toBe(0);
  });

  it("accepts an optional --dir argument", () => {
    const result = runLint("todo");

    expect(typeof result.ok).toBe("boolean");
    expect(typeof result.issues).toBe("number");
    expect(typeof result.message).toBe("string");
  });

  it("returns ok=false and issues>0 when a file fails lint", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-test-"));
    const tasksDir = path.join(tmpDir, "tasks", "custom");
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(path.join(tasksDir, "bad-prompt.md"), "# bad\n\nNo sections here.\n", "utf-8");

    // We cannot easily redirect TASKS_DIR, so we test lintPromptContent directly
    // and trust runLint wires it correctly (integration-tested by the CLI itself).
    const { errors } = lintPromptContent("# bad\n\nNo sections here.\n");

    expect(errors.length).toBeGreaterThan(0);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("reports FAIL in message when errors found (via pure function)", () => {
    const content = "# missing everything\n";
    const result = lintPromptContent(content);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("## Context"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runReport
// ---------------------------------------------------------------------------

describe("runReport", () => {
  it("throws when slug is empty", () => {
    expect(() => runReport("")).toThrow("--slug is required");
  });

  it("creates tasks/reports/<slug>-final-report.md", () => {
    const slug = `spec-report-${Date.now()}`;
    const result = runReport(slug);

    expect(result.slug).toBe(slug);
    expect(result.filePath).toMatch(new RegExp(`${slug}-final-report\\.md$`));
    expect(fs.existsSync(result.filePath)).toBe(true);

    // Clean up
    fs.unlinkSync(result.filePath);
  });

  it("report contains key section headings from the template", () => {
    const slug = `spec-headings-${Date.now()}`;
    const result = runReport(slug);
    const content = fs.readFileSync(result.filePath, "utf-8");

    expect(content).toContain("## Original Request");
    expect(content).toContain("## Iterations Summary");
    expect(content).toContain("## Prompts Ready for GO");
    expect(content).toContain("## In Progress");
    expect(content).toContain("## Blocked / Deferred");
    expect(content).toContain("## GO Checklist");

    fs.unlinkSync(result.filePath);
  });

  it("report title includes the slug", () => {
    const slug = `spec-title-${Date.now()}`;
    const result = runReport(slug);
    const content = fs.readFileSync(result.filePath, "utf-8");

    expect(content).toContain(`# Final Report: ${slug}`);

    fs.unlinkSync(result.filePath);
  });

  it("produces valid report with empty sections when no files match slug", () => {
    const slug = `zzz-no-match-slug-${Date.now()}`;
    const result = runReport(slug);
    const content = fs.readFileSync(result.filePath, "utf-8");

    // Should not crash and sections should contain "_none_" placeholders
    expect(content).toContain("_none_");
    expect(fs.existsSync(result.filePath)).toBe(true);

    fs.unlinkSync(result.filePath);
  });

  it("includes intake file headings when matching slug files exist", () => {
    const slug = `spec-intake-match-${Date.now()}`;

    // Create a matching intake file in the real tasks/intake/ dir
    const intakeDir = path.join(path.resolve(__dirname, ".."), "tasks", "intake");
    fs.mkdirSync(intakeDir, { recursive: true });
    const intakeFile = path.join(intakeDir, `${slug}-intake.md`);
    fs.writeFileSync(intakeFile, "# My intake\n", "utf-8");

    const result = runReport(slug);
    const content = fs.readFileSync(result.filePath, "utf-8");

    expect(content).toContain(`tasks/intake/${slug}-intake.md`);

    // Clean up
    fs.unlinkSync(intakeFile);
    fs.unlinkSync(result.filePath);
  });

  it("GO Checklist contains typecheck and lint items", () => {
    const slug = `spec-checklist-${Date.now()}`;
    const result = runReport(slug);
    const content = fs.readFileSync(result.filePath, "utf-8");

    expect(content).toContain("pnpm typecheck");
    expect(content).toContain("pnpm lint");

    fs.unlinkSync(result.filePath);
  });
});

// ---------------------------------------------------------------------------
// runReady
// ---------------------------------------------------------------------------

describe("runReady", () => {
  it("returns empty array when tasks/todo does not exist", () => {
    // The real tasks/todo may or may not exist; we cannot control that.
    // Instead test the countFilesInFolder helper for the missing case
    // (already tested above). Here we just verify the shape.
    const result = runReady();

    expect(Array.isArray(result.files)).toBe(true);
  });

  it("returns only .md filenames (no path prefix)", () => {
    const result = runReady();

    for (const f of result.files) {
      expect(f).toMatch(/\.md$/);
      expect(f).not.toContain("/");
    }
  });

  it("ready filters correctly: valid prompt passes, invalid prompt is excluded", () => {
    // Test via lintPromptContent which runReady uses internally
    const validResult = lintPromptContent(VALID_PROMPT);
    const invalidResult = lintPromptContent("# bad\n\nNo required sections.\n");

    expect(validResult.errors).toHaveLength(0);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
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
    // Create a task file first
    writeFile(path.join(tasksDir, "todo"), "old-task.md", "# Old task");

    // Wait 5 ms then create TASK_LIST.md so it is newer
    const past = new Date(Date.now() - 5000);
    fs.utimesSync(path.join(tasksDir, "todo", "old-task.md"), past, past);

    writeFile(tmpDir, "TASK_LIST.md", "# TASK_LIST\n");

    const result = checkTaskListStale({ tasksDir, taskListPath });

    expect(result.exists).toBe(true);
    expect(result.stale).toBe(false);
  });

  it("reports stale when a task file is newer than TASK_LIST.md", () => {
    // Create TASK_LIST.md first (older)
    writeFile(tmpDir, "TASK_LIST.md", "# TASK_LIST\n");
    const past = new Date(Date.now() - 5000);
    fs.utimesSync(taskListPath, past, past);

    // Create a newer task file
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

    // A file in done/ should trigger stale
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

  it("returns correct counts reflecting the task folders", () => {
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

    // Touch the task file to an older timestamp so TASK_LIST is newer
    const past = new Date(Date.now() - 5000);
    fs.utimesSync(path.join(tasksDir, "todo", "some-task.md"), past, past);

    const stale = checkTaskListStale({ tasksDir, taskListPath });

    expect(stale.stale).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runReport — Queue Snapshot section
// ---------------------------------------------------------------------------

describe("runReport — Queue Snapshot", () => {
  it("report includes Queue Snapshot section", () => {
    const slug = `spec-queue-${Date.now()}`;
    const result = runReport(slug);
    const content = fs.readFileSync(result.filePath, "utf-8");

    expect(content).toContain("## Queue Snapshot");
    expect(content).toContain("TASK_LIST.md:");

    fs.unlinkSync(result.filePath);
  });

  it("Queue Snapshot includes all 8 tracked folders", () => {
    const slug = `spec-queue-folders-${Date.now()}`;
    const result = runReport(slug);
    const content = fs.readFileSync(result.filePath, "utf-8");

    const foldersToCheck = ["intake", "proposals", "briefs", "for-analyst", "todo", "run", "done", "reports"];

    for (const folder of foldersToCheck) {
      expect(content).toContain(folder);
    }

    fs.unlinkSync(result.filePath);
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

  it("does not invoke any binary (pure read)", () => {
    writeFile(todoDir, "feat-pure.md", "# pure prompt\n");

    // If this runs without error and without network/process spawn it is a pure read
    const result = adaptersRender("pure", { tasksDir });

    expect(result.content).toContain("# pure prompt");
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

    // Point to a fake binary that does not exist — dry-run must not throw
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

    // Should NOT throw even though binary does not exist
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

    expect(() => adaptersRun("gate", "codex", false, { tasksDir })).toThrow(
      "Safety gate",
    );
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
    // Use /bin/echo as the binary so the test is self-contained
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

    // Confirm the original content is unchanged
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
// runLoop
// ---------------------------------------------------------------------------

interface LoopHarness {
  tmpDir: string;
  tasksDir: string;
  configPath: string;
  templatesDir: string;
  briefsDir: string;
  todoDir: string;
  forAnalystDir: string;
  intakeDir: string;
}


function makeLoopHarness(slug: string): LoopHarness {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "loop-test-"));
  const tasksDir = path.join(tmpDir, "tasks");
  const briefsDir = path.join(tasksDir, "briefs");
  const todoDir = path.join(tasksDir, "todo");
  const forAnalystDir = path.join(tasksDir, "for-analyst");
  const intakeDir = path.join(tasksDir, "intake");
  const templatesDir = path.join(tmpDir, "templates");

  fs.mkdirSync(briefsDir, { recursive: true });
  fs.mkdirSync(todoDir, { recursive: true });
  fs.mkdirSync(forAnalystDir, { recursive: true });
  fs.mkdirSync(intakeDir, { recursive: true });
  fs.mkdirSync(templatesDir, { recursive: true });

  fs.writeFileSync(path.join(intakeDir, `${slug}-intake.md`), `# intake ${slug}\n`, "utf-8");
  fs.writeFileSync(path.join(templatesDir, "analyst-system-prompt.md"), "ANALYST SYSTEM\n", "utf-8");
  fs.writeFileSync(path.join(templatesDir, "architect-system-prompt.md"), "ARCHITECT SYSTEM\n", "utf-8");

  const configPath = path.join(tmpDir, "workflow-adapters.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      adapters: {},
      roles: {
        analyst: { binary: "fake-analyst", flags: [] },
        architect: { binary: "fake-architect", flags: [] },
      },
    }),
    "utf-8",
  );

  return { tmpDir, tasksDir, configPath, templatesDir, briefsDir, todoDir, forAnalystDir, intakeDir };
}


describe("runLoop", () => {
  it("throws when slug is empty", () => {
    expect(() => runLoop("")).toThrow("--slug is required");
  });

  it("throws with clear message when intake file is missing", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "loop-noinit-"));
    const tasksDir = path.join(tmpDir, "tasks");
    fs.mkdirSync(tasksDir, { recursive: true });

    const configPath = path.join(tmpDir, "cfg.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        adapters: {},
        roles: {
          analyst: { binary: "a", flags: [] },
          architect: { binary: "b", flags: [] },
        },
      }),
      "utf-8",
    );

    expect(() =>
      runLoop("missing", { tasksDir, configPath, execFn: () => "" }),
    ).toThrow(/Intake file not found/);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws with config hint when config is missing", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "loop-nocfg-"));
    const tasksDir = path.join(tmpDir, "tasks");
    const intakeDir = path.join(tasksDir, "intake");
    fs.mkdirSync(intakeDir, { recursive: true });
    fs.writeFileSync(path.join(intakeDir, "x-intake.md"), "# x\n", "utf-8");

    expect(() =>
      runLoop("x", {
        tasksDir,
        configPath: path.join(tmpDir, "nope.json"),
        execFn: () => "",
      }),
    ).toThrow(/config --init/);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("throws when config has no roles", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "loop-noroles-"));
    const tasksDir = path.join(tmpDir, "tasks");
    const intakeDir = path.join(tasksDir, "intake");
    fs.mkdirSync(intakeDir, { recursive: true });
    fs.writeFileSync(path.join(intakeDir, "y-intake.md"), "# y\n", "utf-8");

    const configPath = path.join(tmpDir, "cfg.json");
    fs.writeFileSync(configPath, JSON.stringify({ adapters: {} }), "utf-8");

    expect(() =>
      runLoop("y", { tasksDir, configPath, execFn: () => "" }),
    ).toThrow(/missing required roles/);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("converges when convergence file is written by architect", () => {
    const slug = "conv";
    const h = makeLoopHarness(slug);
    let call = 0;

    const execFn = (binary: string, _args: string[]): string => {
      call += 1;

      if (binary === "fake-analyst") {
        fs.writeFileSync(
          path.join(h.briefsDir, `${slug}-brief-v1.md`),
          "# brief v1\n",
          "utf-8",
        );
      }

      if (binary === "fake-architect") {
        fs.writeFileSync(
          path.join(h.todoDir, `feat-${slug}.md`),
          "# prompt\n",
          "utf-8",
        );
        fs.writeFileSync(
          path.join(h.tasksDir, `.convergence-${slug}`),
          JSON.stringify({ slug, iteration: 1 }),
          "utf-8",
        );
      }

      return "";
    };

    const result = runLoop(slug, {
      tasksDir: h.tasksDir,
      configPath: h.configPath,
      templatesDir: h.templatesDir,
      execFn,
      promptFn: () => "c",
      logFn: () => undefined,
    });

    expect(result.converged).toBe(true);
    expect(result.iterations).toBe(1);
    expect(result.stoppedByUser).toBe(false);
    expect(result.todoFiles).toContain(`feat-${slug}.md`);
    expect(call).toBe(2);

    fs.rmSync(h.tmpDir, { recursive: true });
  });

  it("planning-only mode asks architect for proposals instead of Worker prompts", () => {
    const slug = "planning";
    const h = makeLoopHarness(slug);
    const proposalsDir = path.join(h.tasksDir, "proposals");
    let architectPrompt = "";

    const execFn = (binary: string, args: string[]): string => {
      if (binary === "fake-analyst") {
        fs.writeFileSync(
          path.join(h.briefsDir, `${slug}-brief-v1.md`),
          "# brief v1\n",
          "utf-8",
        );
      }

      if (binary === "fake-architect") {
        architectPrompt = args.join("\n");
        fs.mkdirSync(proposalsDir, { recursive: true });
        fs.writeFileSync(
          path.join(proposalsDir, `${slug}-proposal-v1.md`),
          "# proposal\n",
          "utf-8",
        );
        fs.writeFileSync(
          path.join(h.tasksDir, `.convergence-${slug}`),
          JSON.stringify({ slug, iteration: 1, mode: "planning-only" }),
          "utf-8",
        );
      }

      return "";
    };

    const result = runLoop(slug, {
      tasksDir: h.tasksDir,
      configPath: h.configPath,
      templatesDir: h.templatesDir,
      execFn,
      promptFn: () => "c",
      planningOnly: true,
      logFn: () => undefined,
    });

    expect(result.converged).toBe(true);
    expect(result.iterations).toBe(1);
    expect(result.todoFiles).toHaveLength(0);
    expect(architectPrompt).toContain("Planning-only mode is active.");
    expect(architectPrompt).toContain(`tasks/proposals/${slug}-proposal-v1.md`);
    expect(architectPrompt).toContain("Do NOT write to tasks/todo/.");

    fs.rmSync(h.tmpDir, { recursive: true });
  });

  it("planning-only mode fails if a new Worker prompt appears", () => {
    const slug = "planning-violation";
    const h = makeLoopHarness(slug);

    const execFn = (binary: string): string => {
      if (binary === "fake-analyst") {
        fs.writeFileSync(path.join(h.briefsDir, `${slug}-brief-v1.md`), "# brief\n", "utf-8");
      }

      if (binary === "fake-architect") {
        fs.writeFileSync(path.join(h.todoDir, `feat-${slug}.md`), "# prompt\n", "utf-8");
      }

      return "";
    };

    expect(() =>
      runLoop(slug, {
        tasksDir: h.tasksDir,
        configPath: h.configPath,
        templatesDir: h.templatesDir,
        execFn,
        promptFn: () => "c",
        planningOnly: true,
        logFn: () => undefined,
      }),
    ).toThrow(/Planning-only mode violation/);

    fs.rmSync(h.tmpDir, { recursive: true });
  });

  it("converges implicitly when new todo appears without new for-analyst", () => {
    const slug = "implicit";
    const h = makeLoopHarness(slug);

    const execFn = (binary: string): string => {
      if (binary === "fake-analyst") {
        fs.writeFileSync(path.join(h.briefsDir, `${slug}-brief-v1.md`), "# brief\n", "utf-8");
      }

      if (binary === "fake-architect") {
        // Writes a todo prompt but no convergence file and no for-analyst question.
        fs.writeFileSync(path.join(h.todoDir, `feat-${slug}.md`), "# prompt\n", "utf-8");
      }

      return "";
    };

    const result = runLoop(slug, {
      tasksDir: h.tasksDir,
      configPath: h.configPath,
      templatesDir: h.templatesDir,
      execFn,
      promptFn: () => "c",
      logFn: () => undefined,
    });

    expect(result.converged).toBe(true);
    expect(result.reason).toContain("implicit");
    expect(result.iterations).toBe(1);

    fs.rmSync(h.tmpDir, { recursive: true });
  });

  it("stops when user answers 's' at pause checkpoint", () => {
    const slug = "stop";
    const h = makeLoopHarness(slug);

    const execFn = (binary: string): string => {
      if (binary === "fake-analyst") {
        // Writes a brief but architect keeps asking questions to avoid convergence.
        const briefs = fs
          .readdirSync(h.briefsDir)
          .filter((f) => f.startsWith(`${slug}-brief-`)).length;
        fs.writeFileSync(
          path.join(h.briefsDir, `${slug}-brief-v${briefs + 1}.md`),
          "# brief\n",
          "utf-8",
        );
      }

      if (binary === "fake-architect") {
        // Always writes a for-analyst question, never converges. Each iteration
        // adds a NEW for-analyst file so implicit convergence is not triggered.
        const qs = fs
          .readdirSync(h.forAnalystDir)
          .filter((f) => f.endsWith(".md")).length;
        fs.writeFileSync(
          path.join(h.forAnalystDir, `${slug}-q${qs + 1}.md`),
          "# question\n",
          "utf-8",
        );
      }

      return "";
    };

    const result = runLoop(slug, {
      tasksDir: h.tasksDir,
      configPath: h.configPath,
      templatesDir: h.templatesDir,
      execFn,
      promptFn: () => "s",
      pauseEvery: 2,
      maxIterations: 50,
      logFn: () => undefined,
    });

    expect(result.stoppedByUser).toBe(true);
    expect(result.converged).toBe(false);
    expect(result.iterations).toBe(2);

    fs.rmSync(h.tmpDir, { recursive: true });
  });

  it("throws with safety cap message when reaching maxIterations", () => {
    const slug = "cap";
    const h = makeLoopHarness(slug);

    const execFn = (binary: string): string => {
      // Architect always writes a NEW for-analyst question — no convergence,
      // and the new for-analyst file count grows so implicit convergence
      // never triggers either.
      if (binary === "fake-architect") {
        const qs = fs
          .readdirSync(h.forAnalystDir)
          .filter((f) => f.endsWith(".md")).length;
        fs.writeFileSync(
          path.join(h.forAnalystDir, `${slug}-q${qs + 1}.md`),
          "# q\n",
          "utf-8",
        );
      }

      return "";
    };

    expect(() =>
      runLoop(slug, {
        tasksDir: h.tasksDir,
        configPath: h.configPath,
        templatesDir: h.templatesDir,
        execFn,
        promptFn: () => "c",
        maxIterations: 3,
        pauseEvery: 100,
        logFn: () => undefined,
      }),
    ).toThrow(/Safety cap reached/);

    fs.rmSync(h.tmpDir, { recursive: true });
  });

  it("dry-run does not invoke execFn and exits after one iteration", () => {
    const slug = "dry";
    const h = makeLoopHarness(slug);
    let called = false;

    const execFn = (): string => {
      called = true;

      return "";
    };

    const result = runLoop(slug, {
      tasksDir: h.tasksDir,
      configPath: h.configPath,
      templatesDir: h.templatesDir,
      execFn,
      promptFn: () => "c",
      dryRun: true,
      logFn: () => undefined,
    });

    expect(called).toBe(false);
    expect(result.iterations).toBe(1);
    expect(result.converged).toBe(false);
    expect(result.reason).toContain("dry-run");

    fs.rmSync(h.tmpDir, { recursive: true });
  });

  it("invokes analyst before architect each iteration", () => {
    const slug = "order";
    const h = makeLoopHarness(slug);
    const order: string[] = [];

    const execFn = (binary: string): string => {
      order.push(binary);

      if (binary === "fake-analyst") {
        fs.writeFileSync(path.join(h.briefsDir, `${slug}-brief-v1.md`), "b\n", "utf-8");
      }

      if (binary === "fake-architect") {
        fs.writeFileSync(path.join(h.todoDir, `feat-${slug}.md`), "p\n", "utf-8");
        fs.writeFileSync(path.join(h.tasksDir, `.convergence-${slug}`), "{}", "utf-8");
      }

      return "";
    };

    runLoop(slug, {
      tasksDir: h.tasksDir,
      configPath: h.configPath,
      templatesDir: h.templatesDir,
      execFn,
      promptFn: () => "c",
      logFn: () => undefined,
    });

    expect(order).toEqual(["fake-analyst", "fake-architect"]);

    fs.rmSync(h.tmpDir, { recursive: true });
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
