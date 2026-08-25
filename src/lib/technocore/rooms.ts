/**
 * Relay metadata on top of Technocore.
 *
 * Technocore has no concept of a "relay" — it has rooms and notes. A relay is:
 *
 *   - the room  `/r/<relayId>`                   the conversation
 *   - the note  `/kv/agent-relay/<relayId>`      name, objective, mode, roles, status
 *   - the namespace `/kv/<relayId>/*`            shared memory the agents write
 *
 * The metadata note is an ordinary world-writable note. Anyone who knows the relay ID can
 * overwrite it. It is convenience, not a record of authority, and the UI says so.
 */

import { encodeSegment, requestJson, assertRoomName } from "./client";
import { getMemory, setMemory } from "./memory";
import { TechnocoreError } from "./types";
import type { Relay, RelayMode, RelayStatus, RoleId } from "@/types";
import { isValidRelayId } from "@/lib/relay-id";
import { ROLES } from "@/lib/roles";

/** The namespace every relay's metadata note lives in. */
export const RELAY_NS = "agent-relay";
/** Reserved shared-memory key the Writer role is told to fill in. */
export const FINAL_RESULT_KEY = "final";

const META_VERSION = 1;

interface StoredMeta {
  v: number;
  name: string;
  objective?: string;
  createdAt: string;
  mode: RelayMode;
  roles: RoleId[];
  status: RelayStatus;
}

const VALID_MODES = new Set<RelayMode>(["standard", "warroom"]);
const VALID_STATUS = new Set<RelayStatus>(["active", "closed"]);

/**
 * Turn whatever is in the metadata note into a `Relay`.
 *
 * The note is world-writable, so this is parsing hostile JSON, not deserializing our own
 * data: every field is length-capped and type-checked, and anything unrecognised is
 * dropped rather than passed through.
 */
export function parseRelayMeta(id: string, raw: string | null): Relay | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const meta = parsed as Partial<StoredMeta>;

  const name = typeof meta.name === "string" ? meta.name.slice(0, 120).trim() : "";
  if (!name) return null;

  const objective = typeof meta.objective === "string" ? meta.objective.slice(0, 600).trim() : "";
  const roles = Array.isArray(meta.roles)
    ? meta.roles.filter((r): r is RoleId => typeof r === "string" && r in ROLES).slice(0, 8)
    : [];

  return {
    id,
    name,
    objective: objective || undefined,
    createdAt: isoOrNow(meta.createdAt),
    mode: VALID_MODES.has(meta.mode as RelayMode) ? (meta.mode as RelayMode) : "standard",
    roles: Array.from(new Set(roles)),
    status: VALID_STATUS.has(meta.status as RelayStatus) ? (meta.status as RelayStatus) : "active",
  };
}

function isoOrNow(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function serialize(relay: Relay): string {
  const meta: StoredMeta = {
    v: META_VERSION,
    name: relay.name,
    ...(relay.objective ? { objective: relay.objective } : {}),
    createdAt: relay.createdAt,
    mode: relay.mode,
    roles: relay.roles,
    status: relay.status,
  };
  // Compact, and single-line by construction — Technocore sweeps newlines to spaces, which
  // would still be valid JSON but is not worth relying on.
  return JSON.stringify(meta);
}

export interface CreateRelayInput {
  id: string;
  name: string;
  objective?: string;
  mode?: RelayMode;
  roles?: RoleId[];
}

/**
 * Create a relay: write the metadata note, then open the room with a system line.
 *
 * `if_absent=1` on the metadata write means a collision on the (random) ID fails loudly
 * instead of silently taking over someone else's relay.
 */
export async function createRelay(input: CreateRelayInput): Promise<Relay> {
  if (!isValidRelayId(input.id)) {
    throw new TechnocoreError("bad-request", "That relay ID isn't a valid Technocore room name.");
  }
  const relay: Relay = {
    id: input.id,
    name: input.name.slice(0, 120).trim(),
    objective: input.objective?.slice(0, 600).trim() || undefined,
    createdAt: new Date().toISOString(),
    mode: input.mode ?? "standard",
    roles: input.roles ?? [],
    status: "active",
  };

  await setMemory(RELAY_NS, relay.id, serialize(relay), { ifAbsent: true });
  return relay;
}

/** Read a relay's metadata. Returns null when the note is missing, expired or unparseable. */
export async function getRelay(id: string, opts: { signal?: AbortSignal } = {}): Promise<Relay | null> {
  if (!isValidRelayId(id)) return null;
  const raw = await getMemory(RELAY_NS, id, opts);
  return parseRelayMeta(id, raw);
}

/**
 * Replace a relay's metadata note.
 *
 * Used for Close Relay. Closing is metadata, never deletion: Technocore has no delete, and
 * pretending a relay was destroyed when its messages are still world-readable would be a
 * lie about a security property.
 */
export async function updateRelay(relay: Relay): Promise<Relay> {
  await setMemory(RELAY_NS, relay.id, serialize(relay));
  return relay;
}

/**
 * Set the room's topic so a *listed* relay shows its name in Technocore's own `/rooms`
 * directory. Unlisted (`p-`) relays are never enumerated, so this would only leak the name
 * for no benefit — callers skip it for those.
 */
export async function setRoomTopic(room: string, topic: string): Promise<void> {
  assertRoomName(room);
  await setMemory("topic", room, topic);
}

/** Does the room exist and can we read it? Cheap probe used by the relay screen. */
export async function roomExists(room: string, opts: { signal?: AbortSignal } = {}): Promise<boolean> {
  assertRoomName(room);
  const view = await requestJson<{ last_seq?: number; messages?: unknown[] }>(
    `/r/${encodeSegment(room)}?format=json&limit=1`,
    opts,
  );
  return Array.isArray(view.messages) && view.messages.length > 0;
}
