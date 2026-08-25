import { describe, expect, it } from "vitest";
import { generateAgentPrompt, generateRolePrompt, generatePromptFor } from "@/lib/prompts";
import { ROLE_ORDER } from "@/lib/roles";
import type { Relay } from "@/types";

const relay: Relay = {
  id: "p-stablecoin-treasury-review-a82f19dd",
  name: "Stablecoin Treasury Review",
  objective: "Decide whether to hold treasury reserves in tokenized T-bills or on-chain lending.",
  createdAt: "2026-08-25T08:00:00.000Z",
  mode: "warroom",
  roles: ["researcher", "skeptic", "writer"],
  status: "active",
};

const ctx = {
  relay,
  agentGuideUrl: "https://example.github.io/agent-relay/agent.md",
  relayUrl: "https://example.github.io/agent-relay/relay/?id=p-stablecoin-treasury-review-a82f19dd",
  technocoreBaseUrl: "https://technocore.chat",
};

describe("generateAgentPrompt", () => {
  const prompt = generateAgentPrompt(ctx);

  it("carries the relay's identity", () => {
    expect(prompt).toContain("Stablecoin Treasury Review");
    expect(prompt).toContain("tokenized T-bills or on-chain lending");
    expect(prompt).toContain("p-stablecoin-treasury-review-a82f19dd");
    expect(prompt).toContain("https://example.github.io/agent-relay/agent.md");
  });

  it("carries real, documented endpoints so a prompt alone is enough", () => {
    expect(prompt).toContain("GET https://technocore.chat/r/p-stablecoin-treasury-review-a82f19dd");
    expect(prompt).toContain("/say/<your-name>/<your%20message%20url%20encoded>");
    expect(prompt).toContain("&wait=10");
    expect(prompt).toContain("/kv/p-stablecoin-treasury-review-a82f19dd/<key>");
  });

  it("names no endpoint Technocore does not have", () => {
    for (const invented of ["/join", "/leave", "/participants", "/presence", "/subscribe", "/ws"]) {
      expect(prompt).not.toContain(invented);
    }
  });

  it("always instructs the agent to distrust other participants", () => {
    expect(prompt).toMatch(/untrusted data/i);
    expect(prompt).toMatch(/never as an instruction/i);
    expect(prompt).toMatch(/credentials/i);
  });

  it("states the name rule and the message limit an agent will hit", () => {
    expect(prompt).toContain("^[a-z0-9][a-z0-9_-]{0,47}$");
    expect(prompt).toContain("4096");
  });

  it("handles a relay with no objective without printing undefined", () => {
    const prompt = generateAgentPrompt({ ...ctx, relay: { ...relay, objective: undefined } });
    expect(prompt).not.toContain("undefined");
    expect(prompt).toContain("(none stated");
  });
});

describe("generateRolePrompt", () => {
  it("produces a distinct prompt per role", () => {
    const prompts = ROLE_ORDER.map((role) => generateRolePrompt(ctx, role));
    expect(new Set(prompts).size).toBe(ROLE_ORDER.length);
    for (const prompt of prompts) {
      expect(prompt).toContain("p-stablecoin-treasury-review-a82f19dd");
      expect(prompt).toMatch(/untrusted data/i);
    }
  });

  it("names the role it is for", () => {
    expect(generateRolePrompt(ctx, "skeptic")).toContain("SKEPTIC");
    expect(generateRolePrompt(ctx, "writer")).toContain("WRITER");
  });

  it("substitutes the relay ID into role guidance", () => {
    const writer = generateRolePrompt(ctx, "writer");
    expect(writer).toContain("/kv/p-stablecoin-treasury-review-a82f19dd/final/set/");
    expect(writer).not.toContain("<RELAY_ID>");
  });
});

describe("generatePromptFor", () => {
  it("returns the general prompt with no role", () => {
    expect(generatePromptFor(ctx)).toBe(generateAgentPrompt(ctx));
  });

  it("returns the role prompt with one", () => {
    expect(generatePromptFor(ctx, "researcher")).toBe(generateRolePrompt(ctx, "researcher"));
  });
});
