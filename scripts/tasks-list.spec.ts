import { describe, it, expect } from "vitest";
import { extractTitle, formatAge } from "./tasks-list";

describe("extractTitle", () => {
  it("returns the first H1 heading", () => {
    const content = `# feat-foo: My Task Title\n\n## Context\nsome text`;
    expect(extractTitle(content, "feat-foo")).toBe("feat-foo: My Task Title");
  });

  it("ignores lines before the first H1", () => {
    const content = `some preamble\n# Real Title\n## Other`;
    expect(extractTitle(content, "slug")).toBe("Real Title");
  });

  it("falls back to slug when no H1 is found", () => {
    const content = `## Only H2 here\nsome text`;
    expect(extractTitle(content, "fallback-slug")).toBe("fallback-slug");
  });

  it("handles empty content", () => {
    expect(extractTitle("", "my-slug")).toBe("my-slug");
  });

  it("trims whitespace from the title", () => {
    const content = `#   Spaced Title   `;
    expect(extractTitle(content, "slug")).toBe("Spaced Title");
  });
});

describe("formatAge", () => {
  const base = new Date("2024-06-10T12:00:00Z");

  it("returns 'oggi' for same day", () => {
    const date = new Date("2024-06-10T08:00:00Z");
    expect(formatAge(date, base)).toBe("oggi");
  });

  it("returns 'ieri' for 1 day ago", () => {
    const date = new Date("2024-06-09T12:00:00Z");
    expect(formatAge(date, base)).toBe("ieri");
  });

  it("returns 'N giorni fa' for 2-6 days", () => {
    const date = new Date("2024-06-07T12:00:00Z");
    expect(formatAge(date, base)).toBe("3 giorni fa");
  });

  it("returns '1 settimana fa' for exactly 7 days", () => {
    const date = new Date("2024-06-03T12:00:00Z");
    expect(formatAge(date, base)).toBe("1 settimana fa");
  });

  it("returns 'N settimane fa' for 2-3 weeks", () => {
    const date = new Date("2024-05-27T12:00:00Z");
    expect(formatAge(date, base)).toBe("2 settimane fa");
  });

  it("returns '1 mese fa' for ~30 days", () => {
    const date = new Date("2024-05-11T12:00:00Z");
    expect(formatAge(date, base)).toBe("1 mese fa");
  });

  it("returns 'N mesi fa' for 2+ months", () => {
    const date = new Date("2024-03-10T12:00:00Z");
    expect(formatAge(date, base)).toBe("3 mesi fa");
  });
});
