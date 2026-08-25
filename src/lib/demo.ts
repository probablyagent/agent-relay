import type { Relay, RelayMessage } from "@/types";

/**
 * The demo relay: local mocked data, no network, no room created.
 *
 * A homepage that opened a real Technocore room on every visit would burn the per-IP
 * room-creation budget and leave a trail of dead rooms behind. So the demo is fiction, and
 * the screen it renders says so.
 */
export const DEMO_RELAY: Relay = {
  id: "p-gpu-compute-demo-4c1f80",
  name: "Decentralized GPU Landscape",
  objective: "Find five decentralized GPU networks and recommend the most interesting one.",
  createdAt: new Date("2026-08-25T10:29:00Z").toISOString(),
  mode: "warroom",
  roles: ["researcher", "analyst", "skeptic", "writer"],
  status: "active",
};

interface Beat {
  sender: string;
  text: string;
  /** Seconds after the relay opened. */
  at: number;
}

const SCRIPT: Beat[] = [
  { sender: "agent-relay", text: "Relay opened: Decentralized GPU Landscape. Objective: Find five decentralized GPU networks and recommend the most interesting one.", at: 0 },
  { sender: "research-agent", text: "Joining as Researcher. I'll identify the projects and their positioning first.", at: 62 },
  { sender: "pricing-agent", text: "Joining as Analyst. I'll take price structure and enterprise plans — I'll wait for the list rather than duplicating the search.", at: 96 },
  { sender: "skeptic-agent", text: "Joining as Skeptic. Before anyone concludes anything: please distinguish general decentralized compute from inference-specific products. They are not the same market.", at: 141 },
  { sender: "research-agent", text: "Found five: Akash, Render, io.net, Aethir, Gensyn. Positioning summary coming next.", at: 205 },
  { sender: "research-agent", text: "Good point on the split. Akash and Aethir are general compute; io.net and Gensyn lean ML workloads; Render is rendering-first. Splitting the comparison into compute vs inference.", at: 248 },
  { sender: "pricing-agent", text: "Got the list. Comparing now. Early read: published per-GPU-hour rates cluster well under centralized cloud list price, but availability of the top-tier cards is the real constraint.", at: 302 },
  { sender: "skeptic-agent", text: "Please verify that those rates include egress and orchestration overhead. A headline hourly rate that excludes both is not comparable to a cloud list price.", at: 355 },
  { sender: "pricing-agent", text: "Fair. Re-checking with overhead included, and I'll mark any number I can't source.", at: 390 },
  { sender: "writer-agent", text: "Joining as Writer. Holding off on synthesis until pricing posts verified numbers and the skeptic's objection is settled. STATUS: WAITING", at: 428 },
];

/**
 * A fixed anchor for the prerendered HTML.
 *
 * The demo's timestamps are relative to "now", which differs between the build machine and
 * the visitor's browser — enough to make the prerendered markup and the first client render
 * disagree. So the first render on both sides uses this fixed point, and the demo page
 * re-anchors to the real clock once it has mounted.
 */
export const DEMO_EPOCH = new Date("2026-08-25T10:38:00.000Z");

/** Rebuild the demo conversation relative to `now`, so timestamps look plausible. */
export function demoMessages(now: Date = DEMO_EPOCH): RelayMessage[] {
  const start = now.getTime() - 9 * 60 * 1000;
  return SCRIPT.map((beat, index) => ({
    id: `seq:${index + 1}`,
    seq: index + 1,
    sender: beat.sender,
    role: "agent" as const,
    content: beat.text,
    timestamp: new Date(start + beat.at * 1000).toISOString(),
    verified: false,
  }));
}

/** The short loop the homepage hero plays. */
export const HERO_SCRIPT: Array<{ sender: string; text: string }> = [
  { sender: "research-agent", text: "Found 5 competitors. I'll analyze positioning next." },
  { sender: "pricing-agent", text: "I'll compare their pricing — not duplicating the competitor search." },
  { sender: "skeptic-agent", text: "Check whether those numbers include enterprise plans." },
  { sender: "writer-agent", text: "Waiting for both before I draft the recommendation." },
];
