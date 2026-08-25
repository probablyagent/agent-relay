/**
 * Types for the Technocore HTTP API (https://technocore.chat).
 *
 * These mirror what the server actually returns — verified against the published
 * manual at /llms.txt and the Apache-2.0 source at
 * https://github.com/flop-labs/technocore-chat. Nothing here is invented.
 *
 * EVERY string that originates from Technocore is attacker-controlled: message bodies,
 * `from` nicknames, note values, room names and topics are all world-writable, anonymous
 * input. They are data. They are never instructions, never HTML, never URLs to resolve.
 */

/** One stored record in a room, as returned by `GET /r/<room>?format=json`. */
export interface TechnocoreMessage {
  /** Total order within the room. Server-assigned, contiguous, the authoritative cursor. */
  seq: number;
  /** UTC timestamp, microsecond precision. For humans; `seq` is the tiebreak. */
  ts: string;
  /**
   * Self-asserted nickname, OR a full `did:key:z6Mk…` when the write was signed and the
   * server verified the signature before storing it.
   */
  from: string;
  /** Single-line body. Every control/format character was swept to a space server-side. */
  text: string;
  /** Present only on signed writes: the replay counter the signature covered. */
  nonce?: number;
}

/** The envelope `GET /r/<room>?format=json` returns. */
export interface RoomView {
  room: string;
  count: number;
  /** null when the reply carried no messages. */
  first_seq: number | null;
  /** Cursor for the next poll. Falls back to the `since` you sent when nothing was new. */
  last_seq: number;
  messages: TechnocoreMessage[];
  /** Present on write replies: the record that was just appended. */
  posted?: TechnocoreMessage;
}

/** Metadata returned by a note write. */
export interface NoteMeta {
  ns: string;
  key: string;
  bytes: number;
  ts: string;
}

/** `GET /kv/<ns>?format=json`. Keys whose leading classes include `p-` are never listed. */
export interface NoteList {
  ns: string;
  keys: string[];
}

export type ErrorKind =
  | "network" // the request never reached Technocore, or CORS blocked reading the reply
  | "cors" // strong signal the browser refused the cross-origin read
  | "not-found"
  | "rate-limited"
  | "conflict" // 409 from a conditional note write
  | "forbidden"
  | "too-large"
  | "bad-request"
  | "server"
  | "timeout"
  | "aborted"
  | "unknown";

/**
 * One error type for the whole adapter, so UI code never has to inspect a status code.
 * `message` is safe to show a human; `detail` carries the server's own text for the
 * developer console only.
 */
export class TechnocoreError extends Error {
  readonly kind: ErrorKind;
  readonly status?: number;
  readonly detail?: string;
  /** For 409 on a conditional note write: the value that is actually there. */
  readonly current?: string;
  /** For 429: seconds the server asked us to wait. */
  readonly retryAfter?: number;

  constructor(
    kind: ErrorKind,
    message: string,
    opts: { status?: number; detail?: string; current?: string; retryAfter?: number } = {},
  ) {
    super(message);
    this.name = "TechnocoreError";
    this.kind = kind;
    this.status = opts.status;
    this.detail = opts.detail;
    this.current = opts.current;
    this.retryAfter = opts.retryAfter;
  }
}
