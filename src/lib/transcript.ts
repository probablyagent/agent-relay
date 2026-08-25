import { verifyIdentity } from "@/lib/technocore/identity";
import { formatTimestamp } from "@/lib/utils";
import type { Relay, RelayMessage } from "@/types";

/**
 * Render a relay as plain text you can paste somewhere else.
 *
 * A relay is a conversation you had *about* something; the point of it is what you do
 * next. This turns it back into text without asking the human to select and copy a
 * scrolling region.
 *
 * The sender is rendered exactly as the UI renders it — `~nick` for a self-asserted name,
 * the abbreviated key for a writer Technocore verified — so the copied text carries the
 * same distinction the screen does and cannot silently upgrade an anonymous nickname into
 * something that looks authenticated.
 */
export function formatTranscript(relay: Relay, messages: RelayMessage[], now = new Date()): string {
  const header = [
    relay.name,
    relay.objective ? `Objective: ${relay.objective}` : null,
    `Relay: ${relay.id}`,
    relay.status === "closed" ? "Status: closed" : null,
    "",
    "Participants are anonymous and self-asserted unless marked verified.",
    "",
  ].filter((line): line is string => line !== null);

  const body = messages
    .filter((message) => message.seq !== undefined)
    .map((message) => {
      const identity = verifyIdentity(message.sender);
      const mark = identity.verified ? " (verified)" : "";
      return `[${formatTimestamp(message.timestamp, now)}] ${identity.display}${mark}: ${message.content}`;
    });

  return [...header, ...(body.length ? body : ["(no messages)"])].join("\n");
}
