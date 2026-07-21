import { buildContextMessages, decideResponder, parseMentions } from "./rooms-orchestrator.service";

const CAND = [
  { slug: "researcher", capability: "research" },
  { slug: "dev", capability: "code" },
  { slug: "sysadmin", capability: "ops" },
];

// stub director heuristic: trivial keyword -> capability
const capFor = (m: string) =>
  /codice|bug/.test(m) ? "code" : /server|docker/.test(m) ? "ops" : /cerca|notizie/.test(m) ? "research" : "general";

describe("parseMentions", () => {
  it("extracts, lowercases and de-dupes @slugs", () => {
    expect(parseMentions("ehi @Dev e @dev guardate, @researcher")).toEqual(["dev", "researcher"]);
    expect(parseMentions("nessuna menzione")).toEqual([]);
  });
});

describe("decideResponder (2C)", () => {
  it("an @mention of a room agent wins over capability", () => {
    expect(decideResponder("@dev cerca le notizie", CAND, capFor)).toEqual({ slug: "dev", reason: "mention" });
  });

  it("ignores mentions that are not room participants", () => {
    expect(decideResponder("@ghost un bug nel codice", CAND, capFor)).toEqual({
      slug: "dev", reason: "director:capability:code",
    });
  });

  it("director routes by capability when no mention", () => {
    expect(decideResponder("riavvia il docker", CAND, capFor)).toEqual({
      slug: "sysadmin", reason: "director:capability:ops",
    });
  });

  it("falls back to the first candidate when nothing matches", () => {
    expect(decideResponder("ciao a tutti", CAND, capFor)).toEqual({ slug: "researcher", reason: "director:fallback" });
  });

  it("returns null for an empty room", () => {
    expect(decideResponder("qualcosa", [], capFor)).toBeNull();
  });
});

describe("buildContextMessages (read-time assembly)", () => {
  // identity mapper: user -> user, own slug -> assistant, other -> "[slug]: …"
  const mapFor = (self: string) => (m: { senderKind: string; senderId: string; content: string }) => {
    if (m.senderKind === "user") return { role: "user" as const, content: m.content };

    return m.senderId === self
      ? { role: "assistant" as const, content: m.content }
      : { role: "user" as const, content: `[${m.senderId}]: ${m.content}` };
  };

  const msgs = [
    { id: "m1", senderKind: "user", senderId: "alessio", content: "primo" },
    { id: "m2", senderKind: "agent", senderId: "dev", content: "secondo" },
    { id: "m3", senderKind: "user", senderId: "alessio", content: "terzo" },
    { id: "m4", senderKind: "agent", senderId: "dev", content: "quarto" },
  ];

  it("summary present: emits the summary turn + only post-watermark raw messages", () => {
    const out = buildContextMessages(
      { summaryText: "riassunto dei fatti", summaryUpToMessageId: "m2", messages: msgs },
      mapFor("dev"),
    );
    expect(out[0]).toEqual({ role: "user", content: "[contesto riassunto]\nriassunto dei fatti" });
    // pre-watermark m1/m2 excluded; only m3/m4 survive
    expect(out.slice(1)).toEqual([
      { role: "user", content: "terzo" },
      { role: "assistant", content: "quarto" },
    ]);
    expect(out.some((x) => x.content === "primo")).toBe(false);
  });

  it("summary absent: falls back to the raw last-K window unchanged (no summary turn)", () => {
    const out = buildContextMessages(
      { summaryText: null, summaryUpToMessageId: null, messages: msgs },
      mapFor("dev"),
    );
    expect(out).toEqual([
      { role: "user", content: "primo" },
      { role: "assistant", content: "secondo" },
      { role: "user", content: "terzo" },
      { role: "assistant", content: "quarto" },
    ]);
  });

  it("summary absent + more than CONTEXT_MSG_CAP messages: keeps only the last-K window", () => {
    // 50 > CONTEXT_MSG_CAP (40): the 10 oldest must be dropped, the last 40 kept in order.
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: `x${i}`,
      senderKind: "user",
      senderId: "alessio",
      content: `msg-${i}`,
    }));
    const out = buildContextMessages(
      { summaryText: null, summaryUpToMessageId: null, messages: many },
      mapFor("dev"),
    );
    expect(out).toHaveLength(40);
    // oldest 10 excluded
    expect(out.some((x) => x.content === "msg-0")).toBe(false);
    expect(out.some((x) => x.content === "msg-9")).toBe(false);
    // window is the contiguous last 40, mapped unchanged
    expect(out[0]).toEqual({ role: "user", content: "msg-10" });
    expect(out[39]).toEqual({ role: "user", content: "msg-49" });
  });

  it("watermark id missing from loaded messages: safe fallback to the full window", () => {
    const out = buildContextMessages(
      { summaryText: "riassunto", summaryUpToMessageId: "ghost", messages: msgs },
      mapFor("dev"),
    );
    expect(out.some((x) => x.content.startsWith("[contesto riassunto]"))).toBe(false);
    expect(out).toHaveLength(msgs.length);
    expect(out[0]).toEqual({ role: "user", content: "primo" });
  });

  it("mapper returning null drops that message", () => {
    const out = buildContextMessages(
      { summaryText: null, summaryUpToMessageId: null, messages: msgs },
      (m) => (m.senderId === "dev" ? null : { role: "user" as const, content: m.content }),
    );
    expect(out).toEqual([
      { role: "user", content: "primo" },
      { role: "user", content: "terzo" },
    ]);
  });
});
