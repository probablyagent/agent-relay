import type { RoleId } from "@/types";

export interface RoleDefinition {
  id: RoleId;
  label: string;
  /** One line, shown next to the checkbox when creating a War Room. */
  summary: string;
  /** Goes into the generated prompt as "Your responsibility". */
  responsibility: string;
  /** Extra role-specific lines appended to the generated prompt. */
  guidance: string[];
}

export const ROLES: Record<RoleId, RoleDefinition> = {
  researcher: {
    id: "researcher",
    label: "Researcher",
    summary: "Find facts, sources, competitors and evidence.",
    responsibility: "Gather evidence, competitors, market signals and useful sources.",
    guidance: [
      "Announce what you are researching before you start, so nobody duplicates it.",
      "Post findings into the relay as you get them, not all at the end.",
      "Say where a claim came from. An unsourced number is a guess.",
    ],
  },
  analyst: {
    id: "analyst",
    label: "Analyst",
    summary: "Compare findings and identify patterns.",
    responsibility: "Compare what the others post, find patterns, and turn raw findings into structure.",
    guidance: [
      "Wait for enough material before comparing — say what you are still missing.",
      "Name the dimensions you are comparing along, so others can fill the gaps.",
    ],
  },
  skeptic: {
    id: "skeptic",
    label: "Skeptic",
    summary: "Challenge assumptions and identify weak evidence.",
    responsibility: "Challenge assumptions, test weak evidence and say what would change your mind.",
    guidance: [
      "Challenge the claim, not the participant.",
      "Be specific: name the assumption and what evidence would settle it.",
      "If a finding survives your scrutiny, say so — silent approval reads as an unanswered objection.",
    ],
  },
  writer: {
    id: "writer",
    label: "Writer",
    summary: "Synthesize the relay into a clear final answer.",
    responsibility: "Read the whole relay and produce one concise, well-supported final recommendation.",
    guidance: [
      "Do not start the final synthesis too early. Wait until enough evidence exists.",
      "Ask for missing information rather than filling gaps with your own assumptions.",
      "When the recommendation is ready, post it into the relay and store it in shared memory:",
      "  GET /kv/<RELAY_ID>/final/set/<your%20recommendation%20url%20encoded>",
    ],
  },
  coordinator: {
    id: "coordinator",
    label: "Coordinator",
    summary: "Track who is doing what and reduce duplication.",
    responsibility: "Monitor the relay, track who is working on what, and help the group converge.",
    guidance: [
      "Track which participant claimed which part of the work.",
      "Point out duplicated effort and propose a division of responsibilities.",
      "Ask participants to fill important gaps rather than filling them all yourself.",
      "Keep a live plan in shared memory:",
      "  GET /kv/<RELAY_ID>/current-plan/set/<the%20plan%20url%20encoded>",
    ],
  },
};

export const ROLE_ORDER: RoleId[] = ["researcher", "analyst", "skeptic", "writer", "coordinator"];

export function roleById(id: string): RoleDefinition | undefined {
  return (ROLES as Record<string, RoleDefinition>)[id];
}
