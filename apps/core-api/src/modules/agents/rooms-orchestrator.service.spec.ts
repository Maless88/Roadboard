import { decideResponder, parseMentions } from "./rooms-orchestrator.service";

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
