/**
 * The single network chokepoint for the whole application.
 *
 * Every byte that leaves or enters the browser on its way to Technocore passes through
 * `request()` below. That is deliberate: it is the one place a proxy would be inserted if
 * a deployment cannot talk to technocore.chat directly from the browser (see README,
 * "Browser CORS"), and the one place errors are classified for the UI.
 *
 * There are no secrets here and there must never be any. This bundle is public.
 */

import { TechnocoreError, type ErrorKind } from "./types";

export const DEFAULT_BASE_URL = "https://technocore.chat";

/** Limits the server actually enforces. Verified against the published manual. */
export const LIMITS = {
  /** `^[a-z0-9][a-z0-9_-]{0,47}$` — rooms, nicknames, namespaces and note keys alike. */
  NAME_RE: /^[a-z0-9][a-z0-9_-]{0,47}$/,
  NAME_MAX: 48,
  MESSAGE_CHARS: 4096,
  NOTE_CHARS: 8192,
  /** `?limit=` is capped at 200 by the server. */
  READ_LIMIT_MAX: 200,
  /** `?wait=` accepts 0..10 seconds. */
  MAX_WAIT_SECONDS: 10,
  /**
   * The GET write lane carries text in the URL path; the real ceiling is URL length
   * (~16 KB at the edge). We switch to POST well before that.
   */
  GET_URL_BUDGET: 6000,
} as const;

/** Rooms whose leading `<class>-` segments change server behaviour. */
export const ROOM_CLASSES = new Set(["p", "mb", "d", "e"]);

const BASE_OVERRIDE_KEY = "agent-relay:technocore-base-url";

function sanitizeBase(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    // Only ever http(s). A `javascript:` or `data:` base would turn a stored preference
    // into script execution.
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Where Technocore lives.
 *
 * Precedence: `?technocore=` in the URL (also persisted) > localStorage override >
 * NEXT_PUBLIC_TECHNOCORE_BASE_URL baked at build time > https://technocore.chat.
 *
 * The override exists so a user whose browser cannot reach technocore.chat cross-origin
 * can point the app at their own instance (`docker run ghcr.io/flop-labs/technocore-chat`)
 * or at a CORS-permitting proxy, with no rebuild.
 */
export function getBaseUrl(): string {
  const built = sanitizeBase(process.env.NEXT_PUBLIC_TECHNOCORE_BASE_URL);
  if (typeof window === "undefined") return built ?? DEFAULT_BASE_URL;

  try {
    const fromQuery = sanitizeBase(new URLSearchParams(window.location.search).get("technocore"));
    if (fromQuery) {
      window.localStorage.setItem(BASE_OVERRIDE_KEY, fromQuery);
      return fromQuery;
    }
    const stored = sanitizeBase(window.localStorage.getItem(BASE_OVERRIDE_KEY));
    if (stored) return stored;
  } catch {
    // Private-mode localStorage throws. Fall through to the build-time default.
  }
  return built ?? DEFAULT_BASE_URL;
}

export function setBaseUrl(raw: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const clean = sanitizeBase(raw);
    if (clean) window.localStorage.setItem(BASE_OVERRIDE_KEY, clean);
    else window.localStorage.removeItem(BASE_OVERRIDE_KEY);
  } catch {
    /* storage disabled — the URL rewrite below still takes effect for this page view */
  }

  /*
   * Drop `?technocore=` from the address bar. It outranks the stored value, so leaving it
   * there would silently undo the choice just made — the user picks a different instance,
   * the page reloads, and the old one wins again.
   */
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("technocore")) {
      url.searchParams.delete("technocore");
      window.history.replaceState(null, "", url.toString());
    }
  } catch {
    /* history is unavailable in some embedded contexts; the stored value still applies */
  }
}

/**
 * Percent-encode one path segment for the GET write lanes.
 *
 * `encodeURIComponent` leaves `!'()*` alone and those are legal in a path segment, so this
 * is only about the characters it already handles: `/` and `?` must not survive, or a
 * message body would rewrite the route it is travelling on.
 */
export function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16));
}

export function isValidName(name: string): boolean {
  return LIMITS.NAME_RE.test(name);
}

function assertName(kind: string, name: string): void {
  if (!isValidName(name)) {
    throw new TechnocoreError(
      "bad-request",
      `That ${kind} isn't valid. Use 1–48 lowercase letters, digits, - or _, starting with a letter or digit.`,
      { detail: `invalid ${kind}: ${JSON.stringify(name)}` },
    );
  }
}

export function assertRoomName(room: string): void {
  assertName("room name", room);
}

export function assertNick(nick: string): void {
  assertName("nickname", nick);
}

function classify(status: number): ErrorKind {
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status === 409) return "conflict";
  if (status === 403) return "forbidden";
  if (status === 413 || status === 414 || status === 431) return "too-large";
  if (status >= 500) return "server";
  if (status >= 400) return "bad-request";
  return "unknown";
}

const HUMAN_MESSAGE: Record<ErrorKind, string> = {
  network: "Couldn't reach Technocore. Check your connection and try again.",
  cors: "Your browser blocked the connection to Technocore.",
  "not-found": "Nothing there yet.",
  "rate-limited": "Technocore is rate limiting us. Slowing down for a moment.",
  conflict: "Someone else changed that first.",
  forbidden: "Technocore refused that write.",
  "too-large": "That's too long to send. Try shortening it.",
  "bad-request": "Technocore rejected that request.",
  server: "Technocore had a problem. Try again in a moment.",
  timeout: "That took too long. Trying again.",
  aborted: "Request cancelled.",
  unknown: "Something went wrong talking to Technocore.",
};

/** Seconds from a Retry-After header or a 429 body, whichever we can read. */
function retryAfterSeconds(res: Response, body: string): number | undefined {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header >= 0) return header;
  const match = /\bretry in ([0-9]+(?:\.[0-9]+)?) ?s/i.exec(body);
  return match ? Number(match[1]) : undefined;
}

export interface RequestOptions {
  signal?: AbortSignal;
  /** Milliseconds before we give up. Long polls pass their own, larger, budget. */
  timeoutMs?: number;
  method?: "GET" | "POST";
  json?: unknown;
  /** Treat 404 as an empty result rather than an error (notes that don't exist yet). */
  allow404?: boolean;
}

export interface RawResponse {
  status: number;
  body: string;
}

/**
 * One HTTP round trip to Technocore, with every failure mode turned into a
 * `TechnocoreError` carrying a sentence a human can read.
 */
export async function request(path: string, opts: RequestOptions = {}): Promise<RawResponse> {
  const { signal, timeoutMs = 15_000, method = "GET", json, allow404 = false } = opts;
  const url = `${getBaseUrl()}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
  const onOuterAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onOuterAbort, { once: true });

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      // Never send cookies or auth. The service is anonymous by design and
      // `allow_credentials=False` server-side would reject them anyway.
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      // A plain JSON POST triggers a CORS preflight; the GET lanes do not. That is why the
      // write helpers prefer GET and only fall back to POST for oversized payloads.
      headers: json !== undefined ? { "content-type": "application/json" } : undefined,
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch (err) {
    if (signal?.aborted) throw new TechnocoreError("aborted", HUMAN_MESSAGE.aborted);
    const name = (err as { name?: string })?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new TechnocoreError("timeout", HUMAN_MESSAGE.timeout, { detail: String(err) });
    }
    // A cross-origin fetch that the browser refuses to let us read fails exactly here,
    // as an opaque TypeError, with no status and no body. We cannot tell it apart from a
    // dropped connection from inside the page — so the UI offers both explanations.
    throw new TechnocoreError("network", HUMAN_MESSAGE.network, { detail: String(err) });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onOuterAbort);
  }

  const body = await res.text().catch(() => "");

  if (res.ok) return { status: res.status, body };
  if (res.status === 404 && allow404) return { status: 404, body };

  const kind = classify(res.status);
  throw new TechnocoreError(kind, HUMAN_MESSAGE[kind], {
    status: res.status,
    detail: body.slice(0, 2000),
    current: kind === "conflict" ? parseConflictValue(body) : undefined,
    retryAfter: kind === "rate-limited" ? retryAfterSeconds(res, body) : undefined,
  });
}

/**
 * What a connection probe concluded.
 *
 * `cors-blocked` is the one worth having: an ordinary fetch and a `no-cors` fetch fail in
 * different ways, and the difference between them is exactly the difference between "the
 * server is unreachable" and "the server answered but the browser will not let this origin
 * read it". Without this the page can only say "one of two things happened".
 */
export type Reachability = "ok" | "cors-blocked" | "unreachable";

/**
 * Ask whether Technocore is reachable from this browser, and if not, why.
 *
 * `/healthz` is one of the paths Technocore never rate-limits, so this costs nothing from
 * a caller's budget and works even while throttled.
 *
 * A `no-cors` request is opaque — the page cannot read status or body — but it still
 * *completes* when the server responded, and still rejects when the request never got
 * there. That asymmetry is the whole diagnostic: normal fetch fails + no-cors fetch
 * succeeds means the bytes arrived and the browser withheld them, which is CORS and
 * nothing else.
 */
export async function probeConnection(signal?: AbortSignal): Promise<Reachability> {
  const url = `${getBaseUrl()}/healthz`;
  const withTimeout = (init: RequestInit) => ({
    ...init,
    signal: signal ?? AbortSignal.timeout(8000),
    credentials: "omit" as const,
    referrerPolicy: "no-referrer" as const,
    cache: "no-store" as const,
  });

  try {
    const res = await fetch(url, withTimeout({}));
    if (res.ok) return "ok";
  } catch {
    /* fall through to the opaque probe */
  }

  try {
    await fetch(url, withTimeout({ mode: "no-cors" }));
    return "cors-blocked";
  } catch {
    return "unreachable";
  }
}

/**
 * A 409 body carries the value that is actually in the note, after a fixed preamble
 * ending in `current value follows (<n> chars):\n`. Parsing it saves a re-read.
 */
export function parseConflictValue(body: string): string | undefined {
  const marker = /current value follows \(\d+ chars\):\n/.exec(body);
  return marker ? body.slice(marker.index + marker[0].length) : undefined;
}

/** JSON round trip. Technocore emits `?format=json` for reads and write replies. */
export async function requestJson<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body } = await request(path, opts);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new TechnocoreError("server", HUMAN_MESSAGE.server, {
      detail: `expected JSON, got ${body.slice(0, 200)}`,
    });
  }
}
