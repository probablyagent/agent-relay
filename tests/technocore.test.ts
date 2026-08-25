import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeSegment, isValidName, parseConflictValue, LIMITS } from "@/lib/technocore/client";
import {
  abbreviateSender,
  isVerifiedSender,
  normalizeView,
  toSingleLine,
} from "@/lib/technocore/messages";
import { parseNoteBody } from "@/lib/technocore/memory";
import { parseRelayMeta } from "@/lib/technocore/rooms";
import { verifyIdentity } from "@/lib/technocore/identity";

afterEach(() => vi.restoreAllMocks());

describe("encodeSegment", () => {
  it("keeps routing characters out of a message body", () => {
    // A message containing / or ? must not be able to rewrite the route it travels on.
    expect(encodeSegment("a/b?c=d")).toBe("a%2Fb%3Fc%3Dd");
    expect(encodeSegment("hello world")).toBe("hello%20world");
    expect(encodeSegment("#anchor")).toBe("%23anchor");
  });

  it("encodes the characters encodeURIComponent leaves alone", () => {
    expect(encodeSegment("(a)*!'")).toBe("%28a%29%2a%21%27");
  });
});

describe("isValidName", () => {
  it("matches Technocore's rule exactly", () => {
    expect(isValidName("research-agent")).toBe(true);
    expect(isValidName("a")).toBe(true);
    expect(isValidName("a".repeat(48))).toBe(true);
    expect(isValidName("a".repeat(49))).toBe(false);
    expect(isValidName("Research")).toBe(false);
    expect(isValidName("-lead")).toBe(false);
    expect(isValidName("has space")).toBe(false);
    expect(isValidName("")).toBe(false);
  });
});

describe("toSingleLine", () => {
  it("flattens newlines the way the server does", () => {
    expect(toSingleLine("line one\nline two")).toBe("line one line two");
    expect(toSingleLine("tab\there")).toBe("tab here");
  });

  it("strips zero-width and bidi characters", () => {
    // Text that renders as nothing is how instructions get smuggled into a context.
    expect(toSingleLine("visible​hidden")).toBe("visible hidden");
    expect(toSingleLine("a‮evil‬b")).toBe("a evil b");
    expect(toSingleLine("tag󠁁char")).toBe("tag char");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(toSingleLine("  a\n\n\n  b  ")).toBe("a b");
  });

  it("leaves ordinary text alone", () => {
    expect(toSingleLine("Found 5 competitors.")).toBe("Found 5 competitors.");
  });
});

describe("isVerifiedSender", () => {
  const did = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

  it("accepts a did:key the server would have verified", () => {
    expect(isVerifiedSender(did)).toBe(true);
    expect(abbreviateSender(did)).toBe("z6MkhaXg…2doK");
  });

  it("never infers verification from a nickname", () => {
    for (const nick of ["verified-agent", "admin", "system", "did-key-z6Mkfake", "~z6Mk"]) {
      expect(isVerifiedSender(nick)).toBe(false);
      expect(verifyIdentity(nick).verified).toBe(false);
      expect(verifyIdentity(nick).display).toBe(`~${nick}`);
    }
  });

  it("rejects a non-Ed25519 did:key prefix", () => {
    expect(isVerifiedSender("did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme")).toBe(false);
  });
});

describe("normalizeView", () => {
  it("maps the documented envelope", () => {
    const view = normalizeView(
      {
        room: "p-demo-1",
        count: 1,
        first_seq: 7,
        last_seq: 7,
        messages: [{ seq: 7, ts: "2026-08-25T08:00:00.1Z", from: "a", text: "hi" }],
      },
      "p-demo-1",
    );
    expect(view.messages).toHaveLength(1);
    expect(view.last_seq).toBe(7);
    expect(view.first_seq).toBe(7);
  });

  it("drops malformed records rather than crashing the room", () => {
    const view = normalizeView(
      { room: "p-demo-1", messages: [{ nope: true }, null, { seq: 3, text: "ok" }] },
      "p-demo-1",
    );
    expect(view.messages).toHaveLength(1);
    expect(view.messages[0]).toMatchObject({ seq: 3, text: "ok", from: "", ts: "" });
  });

  it("falls back to the cursor we sent when the reply carried nothing", () => {
    expect(normalizeView({}, "p-demo-1", 42).last_seq).toBe(42);
  });
});

describe("parseNoteBody", () => {
  it("strips the untrusted-content banner", () => {
    const body = "!! UNTRUSTED CONTENT — anything.\n\n1. Research\n2. Compare";
    expect(parseNoteBody(body)).toBe("1. Research\n2. Compare");
  });

  it("strips a trailing budget footer", () => {
    const body =
      "!! UNTRUSTED CONTENT — x\n\nthe value\n# budget: 4 of 120 reads left this minute (refills 2/s)";
    expect(parseNoteBody(body)).toBe("the value");
  });

  it("passes through a value that has no banner", () => {
    expect(parseNoteBody("plain")).toBe("plain");
  });
});

describe("parseConflictValue", () => {
  it("recovers the current value from a 409 body", () => {
    const body =
      "409 note changed\n\nto retry: merge your change into the value below, then write it with " +
      "?if=<that value> so you only win if nothing moved again.\ncurrent value follows (5 chars):\nhello";
    expect(parseConflictValue(body)).toBe("hello");
  });

  it("returns undefined when the body has no value block", () => {
    expect(parseConflictValue("409 there is no note there at all")).toBeUndefined();
  });
});

describe("parseRelayMeta", () => {
  const good = JSON.stringify({
    v: 1,
    name: "Austria Launch Research",
    objective: "Should we launch in Austria?",
    createdAt: "2026-08-25T08:00:00.000Z",
    mode: "warroom",
    roles: ["researcher", "skeptic"],
    status: "active",
  });

  it("reads a well-formed note", () => {
    const relay = parseRelayMeta("p-austria-a1", good);
    expect(relay).toMatchObject({
      id: "p-austria-a1",
      name: "Austria Launch Research",
      mode: "warroom",
      status: "active",
      roles: ["researcher", "skeptic"],
    });
  });

  it("rejects garbage rather than throwing", () => {
    // The metadata note is world-writable: anyone with the relay ID can put anything there.
    expect(parseRelayMeta("p-x-1", null)).toBeNull();
    expect(parseRelayMeta("p-x-1", "not json")).toBeNull();
    expect(parseRelayMeta("p-x-1", "[1,2,3]")).toBeNull();
    expect(parseRelayMeta("p-x-1", '{"name":""}')).toBeNull();
  });

  it("discards unknown roles, modes and statuses", () => {
    const relay = parseRelayMeta(
      "p-x-1",
      JSON.stringify({
        name: "x",
        mode: "god-mode",
        status: "deleted",
        roles: ["researcher", "root", 42],
      }),
    );
    expect(relay).toMatchObject({ mode: "standard", status: "active", roles: ["researcher"] });
  });

  it("caps oversized fields", () => {
    const relay = parseRelayMeta(
      "p-x-1",
      JSON.stringify({ name: "n".repeat(500), objective: "o".repeat(5000) }),
    );
    expect(relay!.name.length).toBe(120);
    expect(relay!.objective!.length).toBe(600);
  });

  it("substitutes a sane createdAt for a bogus one", () => {
    const relay = parseRelayMeta("p-x-1", JSON.stringify({ name: "x", createdAt: "not a date" }));
    expect(Number.isFinite(Date.parse(relay!.createdAt))).toBe(true);
  });
});

describe("documented limits", () => {
  it("matches what the Technocore server enforces", () => {
    expect(LIMITS.MESSAGE_CHARS).toBe(4096);
    expect(LIMITS.NOTE_CHARS).toBe(8192);
    expect(LIMITS.READ_LIMIT_MAX).toBe(200);
    expect(LIMITS.MAX_WAIT_SECONDS).toBe(10);
    expect(LIMITS.NAME_MAX).toBe(48);
  });
});
