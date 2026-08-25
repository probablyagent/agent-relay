/**
 * Shared memory — Technocore notes.
 *
 * Read:   GET /kv/<ns>/<key>              -> text/plain, always (there is no ?format=json
 *                                            on this route), prefixed by the service's
 *                                            untrusted-content banner
 * List:   GET /kv/<ns>?format=json        -> { ns, keys }   (p- keys are never listed)
 * Write:  GET /kv/<ns>/<key>/set/<value>[?if=<prev>|?if_absent=1]
 *         POST /kv/<ns>/<key> {"value":..,"if":..|"if_absent":true}
 *
 * Messages are the conversation. Notes are durable shared state — a plan, a link list,
 * the final answer. Both are world-writable: anybody who knows the relay ID can overwrite
 * any note in it.
 */

import { LIMITS, encodeSegment, request, requestJson, assertRoomName } from "./client";
import { TechnocoreError, type NoteList, type NoteMeta } from "./types";
import { toSingleLine } from "./messages";

/**
 * `GET /kv/<ns>/<key>` answers `text/plain` shaped as:
 *
 *   !! UNTRUSTED CONTENT — …
 *   <blank line>
 *   <the value>
 *   [# budget: N of M reads left this minute (…)]
 *
 * The banner is the server telling us what we already assume. Strip it and the optional
 * budget footer to recover the stored value; everything left is anonymous input.
 */
export function parseNoteBody(body: string): string {
  let value = body;
  const split = value.indexOf("\n\n");
  if (value.startsWith("!!") && split !== -1) value = value.slice(split + 2);
  // The budget footer is appended as "\n# budget: …" and only ever as the last line.
  value = value.replace(/\n# budget: [^\n]*\n?$/, "");
  return value;
}

/** Read one note. Returns null when nothing has been written there (or it expired). */
export async function getMemory(
  ns: string,
  key: string,
  opts: { signal?: AbortSignal } = {},
): Promise<string | null> {
  assertRoomName(ns);
  assertRoomName(key);
  const { status, body } = await request(`/kv/${encodeSegment(ns)}/${encodeSegment(key)}`, {
    signal: opts.signal,
    allow404: true,
  });
  if (status === 404) return null;
  return parseNoteBody(body);
}

export interface SetMemoryOptions {
  /** Compare-and-set: only write if the note still holds exactly this. */
  ifMatches?: string;
  /** Create-only: fail with 409 if anything is already there. */
  ifAbsent?: boolean;
  signal?: AbortSignal;
}

/**
 * Write one note.
 *
 * Conditional writes order writes; they do not fence ownership. Winning a CAS does not
 * stop a stalled peer from acting on a claim it still believes it holds.
 */
export async function setMemory(
  ns: string,
  key: string,
  value: string,
  opts: SetMemoryOptions = {},
): Promise<NoteMeta> {
  assertRoomName(ns);
  assertRoomName(key);

  const clean = toSingleLine(value);
  if (clean.length > LIMITS.NOTE_CHARS) {
    throw new TechnocoreError(
      "too-large",
      `That's ${clean.length} characters. Technocore caps a note at ${LIMITS.NOTE_CHARS}.`,
    );
  }

  const params = new URLSearchParams({ format: "json" });
  if (opts.ifAbsent) params.set("if_absent", "1");
  else if (opts.ifMatches !== undefined) params.set("if", opts.ifMatches);

  const getPath = `/kv/${encodeSegment(ns)}/${encodeSegment(key)}/set/${encodeSegment(clean)}`;
  if (`${getPath}?${params}`.length <= LIMITS.GET_URL_BUDGET) {
    return requestJson<NoteMeta>(`${getPath}?${params}`, { signal: opts.signal });
  }

  return requestJson<NoteMeta>(`/kv/${encodeSegment(ns)}/${encodeSegment(key)}?format=json`, {
    method: "POST",
    signal: opts.signal,
    json: {
      value: clean,
      ...(opts.ifAbsent ? { if_absent: true } : {}),
      ...(!opts.ifAbsent && opts.ifMatches !== undefined ? { if: opts.ifMatches } : {}),
    },
  });
}

/** List the keys in a namespace. Keys whose leading classes include `p-` are never listed. */
export async function listMemory(ns: string, opts: { signal?: AbortSignal } = {}): Promise<string[]> {
  assertRoomName(ns);
  const view = await requestJson<NoteList>(`/kv/${encodeSegment(ns)}?format=json`, {
    signal: opts.signal,
  });
  return Array.isArray(view?.keys) ? view.keys.filter((k) => typeof k === "string") : [];
}
