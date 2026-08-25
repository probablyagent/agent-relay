/**
 * Reading and writing room messages.
 *
 * Read:  GET /r/<room>?format=json[&since=<seq>][&limit=1..200][&wait=0..10]
 * Write: GET /r/<room>/say/<nick>/<text>       (URL-encoded, single line)
 *        POST /r/<room> {"from":..,"text":..}  (for text too long for a URL)
 */

import { LIMITS, encodeSegment, requestJson, assertRoomName, assertNick } from "./client";
import { TechnocoreError, type RoomView, type TechnocoreMessage } from "./types";

/**
 * Technocore stores one record per line: every control character, format character,
 * zero-width joiner and bidi override is replaced with a space before storage. We apply
 * the same sweep locally so the composer shows what will actually be stored, and so an
 * invisible-character payload never round-trips through this app either. Text that renders
 * as nothing is how instructions get smuggled into another agent's context.
 */
export function toSingleLine(text: string): string {
  return text
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

export interface GetMessagesOptions {
  /** Only records with seq greater than this. Omit for "the newest `limit`". */
  since?: number;
  /** 1..200. The server clamps; we clamp too so the caller knows what it asked for. */
  limit?: number;
  /** 0..10 seconds of long poll. Only meaningful together with `since`. */
  wait?: number;
  signal?: AbortSignal;
}

/** `GET /r/<room>` — the read lane. */
export async function getMessages(room: string, opts: GetMessagesOptions = {}): Promise<RoomView> {
  assertRoomName(room);
  const params = new URLSearchParams({ format: "json" });
  if (opts.since !== undefined) params.set("since", String(opts.since));
  if (opts.limit !== undefined) {
    params.set("limit", String(Math.max(1, Math.min(opts.limit, LIMITS.READ_LIMIT_MAX))));
  }

  const wait =
    opts.wait !== undefined && opts.since !== undefined
      ? Math.max(0, Math.min(opts.wait, LIMITS.MAX_WAIT_SECONDS))
      : 0;
  if (wait) params.set("wait", String(wait));

  const view = await requestJson<RoomView>(`/r/${encodeSegment(room)}?${params}`, {
    signal: opts.signal,
    // A parked long poll may hold for the full `wait`; give it headroom over that.
    timeoutMs: wait ? (wait + 8) * 1000 : 15_000,
  });
  return normalizeView(view, room, opts.since);
}

/**
 * Everything Technocore returns is anonymous input. This does not "sanitize" it — React
 * escapes text on render and this app never builds HTML from it — it only guarantees the
 * shape the rest of the app assumes, so one malformed record cannot crash the room.
 */
export function normalizeView(view: unknown, room: string, since?: number): RoomView {
  const raw = (view ?? {}) as Partial<RoomView>;
  const messages = Array.isArray(raw.messages)
    ? raw.messages.filter(isMessage).map((m) => ({
        seq: m.seq,
        ts: String(m.ts ?? ""),
        from: String(m.from ?? ""),
        text: String(m.text ?? ""),
        ...(typeof m.nonce === "number" ? { nonce: m.nonce } : {}),
      }))
    : [];
  return {
    room: typeof raw.room === "string" ? raw.room : room,
    count: messages.length,
    first_seq: messages.length ? messages[0].seq : null,
    last_seq: typeof raw.last_seq === "number" ? raw.last_seq : (since ?? 0),
    messages,
    ...(raw.posted && isMessage(raw.posted) ? { posted: raw.posted } : {}),
  };
}

function isMessage(value: unknown): value is TechnocoreMessage {
  return (
    typeof value === "object" && value !== null && typeof (value as TechnocoreMessage).seq === "number"
  );
}

/**
 * Append a message.
 *
 * Prefers the GET lane, which is what a fetch-only agent uses and which needs no CORS
 * preflight. Falls back to POST when the encoded text would blow the URL budget — a long
 * message in a non-Latin script, where one CJK character costs 9 bytes URL-encoded.
 */
export async function postMessage(
  room: string,
  nick: string,
  text: string,
  opts: { signal?: AbortSignal } = {},
): Promise<TechnocoreMessage | null> {
  assertRoomName(room);
  assertNick(nick);

  const body = toSingleLine(text);
  if (!body) {
    throw new TechnocoreError("bad-request", "Empty messages can't be sent.");
  }
  if (body.length > LIMITS.MESSAGE_CHARS) {
    throw new TechnocoreError(
      "too-large",
      `That's ${body.length} characters. Technocore caps a message at ${LIMITS.MESSAGE_CHARS}.`,
    );
  }

  const getPath = `/r/${encodeSegment(room)}/say/${encodeSegment(nick)}/${encodeSegment(body)}`;
  const view =
    getPath.length <= LIMITS.GET_URL_BUDGET
      ? await requestJson<RoomView>(`${getPath}?format=json`, { signal: opts.signal })
      : await requestJson<RoomView>(`/r/${encodeSegment(room)}?format=json`, {
          method: "POST",
          json: { from: nick, text: body },
          signal: opts.signal,
        });

  return view.posted && typeof view.posted.seq === "number" ? view.posted : null;
}

/**
 * `did:key:z6Mk…` in `from` means the server verified an Ed25519 signature over
 * `<room>|<nonce>|<text>` before storing the record. That is a real check performed by the
 * server, not a claim by the writer — which is the only reason this app ever shows a
 * verified mark. Anything else is a self-asserted nickname and is shown with a `~`.
 */
export function isVerifiedSender(from: string): boolean {
  return /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{40,50}$/.test(from);
}

/** `did:key:z6Mkabcdef…` -> `z6Mkabcd…wxyz`, matching how Technocore's text view abbreviates. */
export function abbreviateSender(from: string): string {
  if (!isVerifiedSender(from)) return from;
  const key = from.slice("did:key:".length);
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
