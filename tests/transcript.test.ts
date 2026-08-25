import { describe, expect, it } from "vitest";
import { formatTranscript } from "@/lib/transcript";
import { parseAgentStatus } from "@/lib/use-relay";
import type { Relay, RelayMessage } from "@/types";

const relay: Relay = {
  id: "p-stablecoin-treasury-review-a82f19dd",
  name: "Stablecoin Treasury Review",
  objective: "Decide whether to hold treasury reserves in tokenized T-bills or on-chain lending.",
  createdAt: "2026-08-25T08:00:00.000Z",
  mode: "warroom",
  roles: ["researcher", "skeptic"],
  status: "active",
};

const now = new Date("2026-08-25T08:30:00.000Z");

function message(overrides: Partial<RelayMessage> & { seq?: number }): RelayMessage {
  return {
    id: `seq:${overrides.seq ?? 1}`,
    seq: overrides.seq,
    sender: "research-agent",
    role: "agent",
    content: "hello",
    timestamp: "2026-08-25T08:05:00.000Z",
    verified: false,
    ...overrides,
  };
}

describe("formatTranscript", () => {
  it("carries the relay's identity and objective", () => {
    const text = formatTranscript(relay, [message({ seq: 1 })], now);
    expect(text).toContain("Stablecoin Treasury Review");
    expect(text).toContain("Objective: Decide whether to hold treasury reserves");
    expect(text).toContain("Relay: p-stablecoin-treasury-review-a82f19dd");
  });

  it("preserves the self-asserted marker on nicknames", () => {
    // A transcript that dropped the `~` would quietly upgrade an anonymous nickname into
    // something that reads as authenticated once it is pasted somewhere else.
    const text = formatTranscript(relay, [message({ seq: 1, sender: "research-agent" })], now);
    expect(text).toContain("~research-agent:");
    expect(text).not.toContain("(verified)");
  });

  it("marks a sender Technocore actually verified", () => {
    const did = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";
    const text = formatTranscript(relay, [message({ seq: 1, sender: did, verified: true })], now);
    expect(text).toContain("z6MkhaXg…2doK (verified):");
    expect(text).not.toContain("~did:key");
  });

  it("omits messages that are still sending", () => {
    const text = formatTranscript(
      relay,
      [message({ seq: 1, content: "confirmed" }), message({ seq: undefined, content: "in flight" })],
      now,
    );
    expect(text).toContain("confirmed");
    expect(text).not.toContain("in flight");
  });

  it("handles an empty relay without producing a misleading transcript", () => {
    const text = formatTranscript(relay, [], now);
    expect(text).toContain("(no messages)");
  });

  it("notes a closed relay", () => {
    expect(formatTranscript({ ...relay, status: "closed" }, [], now)).toContain("Status: closed");
  });

  it("says the participants are unverified", () => {
    expect(formatTranscript(relay, [], now)).toMatch(/self-asserted/i);
  });
});

describe("parseAgentStatus", () => {
  it("reads the documented markers, case-insensitively", () => {
    expect(parseAgentStatus("Comparison complete. STATUS: DONE")).toBe("done");
    expect(parseAgentStatus("status: blocked on the pricing data")).toBe("blocked");
    expect(parseAgentStatus("STATUS:WAITING on research-agent")).toBe("waiting");
  });

  it("returns undefined for anything it does not recognise", () => {
    // The marker is a convention, not a server feature, and the text is written by a
    // stranger: only the fixed enum may ever reach the UI.
    expect(parseAgentStatus("no marker here")).toBeUndefined();
    expect(parseAgentStatus("STATUS: OWNED")).toBeUndefined();
    expect(parseAgentStatus("STATUS: <script>alert(1)</script>")).toBeUndefined();
    expect(parseAgentStatus("")).toBeUndefined();
  });

  it("does not match a word that merely contains a marker", () => {
    expect(parseAgentStatus("STATUS: DONENESS")).toBeUndefined();
  });
});
