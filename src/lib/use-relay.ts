"use client";

/**
 * The live relay: history, long polling, reconnection, dedup and optimistic sends.
 *
 * The loop Technocore documents:
 *
 *   load history        GET /r/<room>?limit=100&format=json
 *   long poll           GET /r/<room>?since=<last_seq>&wait=10&format=json
 *   message lands       -> render, advance the cursor, poll again immediately
 *   nothing landed      -> the reply is empty after the wait; poll again with the same cursor
 *
 * `wait=10` costs one request per ten seconds of silence rather than twenty, and the URL
 * changes as the room advances, which defeats intermediary caches. Waiter slots are bounded
 * server-side; over the cap the server answers immediately, so a fast empty reply is normal
 * and the loop just becomes ordinary polling. A short floor between iterations keeps that
 * degraded case from turning into a spin.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMessages, postMessage } from "@/lib/technocore/messages";
import { verifyIdentity } from "@/lib/technocore/identity";
import { TechnocoreError } from "@/lib/technocore/types";
import type { AgentStatus, ConnectionState, Participant, RelayMessage } from "@/types";

/** How many messages the first load asks for. */
const INITIAL_LIMIT = 100;
/** Technocore's own ceiling for one read. There is no backwards cursor beyond this. */
const MAX_HISTORY = 200;
const WAIT_SECONDS = 10;
/** Floor between polls, so a server with no free waiter slot cannot make us spin. */
const MIN_POLL_INTERVAL_MS = 1200;
/** Reconnect backoff: 1s, 2s, 4s, 8s, 15s, then hold. */
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15_000];
/** A sender is "recently active" if they posted within this window. */
export const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

/**
 * The completion convention `agent.md` asks participants to use: `STATUS: DONE`, and the
 * two neighbours that make a stalled relay legible. It is a convention, not a server
 * feature — a participant that ignores it is not malfunctioning, so nothing depends on
 * finding one. Parsing is a fixed enum match on untrusted text: anything unrecognised
 * yields undefined rather than reaching the UI.
 */
const STATUS_RE = /\bSTATUS:\s*(DONE|BLOCKED|WAITING)\b/i;

export function parseAgentStatus(text: string): AgentStatus | undefined {
  const match = STATUS_RE.exec(text);
  return match ? (match[1].toLowerCase() as AgentStatus) : undefined;
}

function toRelayMessage(
  raw: { seq: number; ts: string; from: string; text: string },
  selfNick: string,
): RelayMessage {
  const identity = verifyIdentity(raw.from);
  return {
    id: `seq:${raw.seq}`,
    seq: raw.seq,
    sender: raw.from,
    role: !identity.verified && raw.from === selfNick ? "human" : "agent",
    content: raw.text,
    timestamp: raw.ts,
    verified: identity.verified,
  };
}

export interface UseRelayResult {
  messages: RelayMessage[];
  connection: ConnectionState;
  /** Set when the first load failed outright and there is nothing to show. */
  loadError: TechnocoreError | null;
  /** True while the very first history request is in flight. */
  loading: boolean;
  participants: Participant[];
  send: (text: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
  dismissFailed: (id: string) => void;
  loadEarlier: () => Promise<void>;
  canLoadEarlier: boolean;
  loadingEarlier: boolean;
  /** Nudges a reconnect immediately instead of waiting out the backoff. */
  reconnectNow: () => void;
}

export function useRelay(roomId: string | null, nickname: string): UseRelayResult {
  const [messages, setMessages] = useState<RelayMessage[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [loadError, setLoadError] = useState<TechnocoreError | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(INITIAL_LIMIT);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [oldestSeq, setOldestSeq] = useState<number | null>(null);

  /**
   * Every seq we have rendered. The long poll is `since`-based so duplicates should not
   * happen, but a retried write, an optimistic send confirmed twice, or an overlapping
   * history reload all can produce one — and a duplicated message in a coordination room
   * is worse than a missing one, because agents act on it twice.
   */
  const seenSeqs = useRef<Set<number>>(new Set());
  const cursor = useRef(0);
  /*
   * The live loop and the send path both need the *current* nickname, but neither should
   * restart when it changes: re-running the effect would tear down the long poll and
   * reload history just because the human renamed themselves. A ref updated in an effect
   * gives them the latest value without becoming a dependency.
   */
  const nickRef = useRef(nickname);
  useEffect(() => {
    nickRef.current = nickname;
  }, [nickname]);

  const wakeUp = useRef<(() => void) | null>(null);

  /*
   * Dedup happens HERE, not inside the state updater. React may invoke an updater more
   * than once for the same update (it does in development, to surface exactly this), and
   * an updater that mutates `seenSeqs` would mark every message seen on its first run and
   * then discard all of them on its second. The updater below is pure.
   */
  const mergeMessages = useCallback((incoming: RelayMessage[]) => {
    if (!incoming.length) return;

    const fresh = incoming.filter((m) => m.seq === undefined || !seenSeqs.current.has(m.seq));
    if (!fresh.length) return;
    for (const m of fresh) if (m.seq !== undefined) seenSeqs.current.add(m.seq);

    setMessages((current) => {
      const merged = [...current, ...fresh];
      // Confirmed messages sort by seq; anything still sending stays pinned at the bottom.
      merged.sort((a, b) => {
        if (a.seq === undefined) return 1;
        if (b.seq === undefined) return -1;
        return a.seq - b.seq;
      });
      return merged;
    });
  }, []);

  // ---------------------------------------------------------------- the live loop
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;
    const controller = new AbortController();

    seenSeqs.current = new Set();
    cursor.current = 0;
    setMessages([]);
    setOldestSeq(null);
    setHistoryLimit(INITIAL_LIMIT);
    setLoading(true);
    setLoadError(null);
    setConnection("connecting");

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        wakeUp.current = () => {
          clearTimeout(timer);
          resolve();
        };
        controller.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });

    (async () => {
      let failures = 0;

      while (!cancelled) {
        const firstLoad = cursor.current === 0 && seenSeqs.current.size === 0;
        try {
          const view = firstLoad
            ? await getMessages(roomId, { limit: INITIAL_LIMIT, signal: controller.signal })
            : await getMessages(roomId, {
                since: cursor.current,
                wait: WAIT_SECONDS,
                signal: controller.signal,
              });

          if (cancelled) return;

          if (view.messages.length) {
            mergeMessages(view.messages.map((m) => toRelayMessage(m, nickRef.current)));
            if (firstLoad) setOldestSeq(view.first_seq);
          }
          cursor.current = Math.max(cursor.current, view.last_seq);

          failures = 0;
          setConnection("live");
          if (firstLoad) {
            setLoading(false);
            setLoadError(null);
          }
        } catch (err) {
          if (cancelled) return;
          const error = err instanceof TechnocoreError ? err : new TechnocoreError("unknown", "Something went wrong.");
          if (error.kind === "aborted") return;

          if (firstLoad) {
            setLoading(false);
            setLoadError(error);
          }
          setConnection(failures >= BACKOFF_MS.length ? "offline" : "reconnecting");

          // 429 tells us how long to wait; honour it rather than our own backoff.
          const delay =
            error.kind === "rate-limited" && error.retryAfter
              ? Math.min(error.retryAfter * 1000, 60_000)
              : BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)];
          failures += 1;
          await sleep(delay);
          continue;
        }

        // A long poll that returned instantly (no waiter slot free, or a burst of traffic)
        // must not become a spin loop.
        await sleep(MIN_POLL_INTERVAL_MS);
      }
    })();

    return () => {
      cancelled = true;
      wakeUp.current = null;
      controller.abort(new DOMException("relay changed", "AbortError"));
    };
  }, [roomId, mergeMessages]);

  // Poll harder when the tab comes back, and stop claiming "Live" while offline.
  useEffect(() => {
    const wake = () => wakeUp.current?.();
    const onOffline = () => setConnection("offline");
    window.addEventListener("online", wake);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") wake();
    });
    return () => {
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ---------------------------------------------------------------- sending
  const sendText = useCallback(
    async (localId: string, text: string) => {
      if (!roomId) return;
      try {
        const posted = await postMessage(roomId, nickRef.current, text);
        setMessages((current) => current.filter((m) => m.id !== localId));
        if (posted && !seenSeqs.current.has(posted.seq)) {
          mergeMessages([toRelayMessage(posted, nickRef.current)]);
          cursor.current = Math.max(cursor.current, posted.seq);
        }
        // Whatever happened, get the room's own view of it promptly.
        wakeUp.current?.();
      } catch (err) {
        setMessages((current) =>
          current.map((m) => (m.id === localId ? { ...m, status: "failed" as const } : m)),
        );
        throw err;
      }
    },
    [roomId, mergeMessages],
  );

  const send = useCallback(
    async (text: string) => {
      const localId = `pending:${crypto.randomUUID()}`;
      setMessages((current) => [
        ...current,
        {
          id: localId,
          sender: nickRef.current,
          role: "human",
          content: text,
          timestamp: new Date().toISOString(),
          verified: false,
          status: "sending",
        },
      ]);
      await sendText(localId, text);
    },
    [sendText],
  );

  const retry = useCallback(
    async (id: string) => {
      const target = messages.find((m) => m.id === id);
      if (!target) return;
      setMessages((current) =>
        current.map((m) => (m.id === id ? { ...m, status: "sending" as const } : m)),
      );
      await sendText(id, target.content);
    },
    [messages, sendText],
  );

  const dismissFailed = useCallback((id: string) => {
    setMessages((current) => current.filter((m) => m.id !== id));
  }, []);

  // ---------------------------------------------------------------- earlier history
  /**
   * Technocore's read lane has no backwards cursor: `since` only moves forward and `limit`
   * returns the newest N, capped at 200. So "load earlier" can widen the window from 100 to
   * 200 and no further — after that, older messages are only reachable if you were watching
   * when they arrived. The UI says so rather than offering a button that does nothing.
   */
  const canLoadEarlier =
    historyLimit < MAX_HISTORY && oldestSeq !== null && oldestSeq > 1 && !loadingEarlier;

  const loadEarlier = useCallback(async () => {
    if (!roomId || historyLimit >= MAX_HISTORY) return;
    setLoadingEarlier(true);
    try {
      const view = await getMessages(roomId, { limit: MAX_HISTORY });
      mergeMessages(view.messages.map((m) => toRelayMessage(m, nickRef.current)));
      setOldestSeq(view.first_seq);
      setHistoryLimit(MAX_HISTORY);
    } catch {
      /* the banner already reports connection trouble; a failed widen is not fatal */
    } finally {
      setLoadingEarlier(false);
    }
  }, [roomId, historyLimit, mergeMessages]);

  const reconnectNow = useCallback(() => wakeUp.current?.(), []);

  // ---------------------------------------------------------------- participants
  const participants = useMemo(() => {
    const byId = new Map<string, Participant>();
    // Messages arrive oldest-first, so a later STATUS marker simply overwrites an earlier
    // one and a participant keeps the last state it declared.
    for (const message of messages) {
      if (message.seq === undefined) continue;
      const status = parseAgentStatus(message.content);
      const existing = byId.get(message.sender);
      if (existing) {
        existing.messageCount += 1;
        if (message.timestamp > existing.lastSeen) existing.lastSeen = message.timestamp;
        if (status) existing.status = status;
      } else {
        byId.set(message.sender, {
          sender: message.sender,
          verified: message.verified,
          lastSeen: message.timestamp,
          messageCount: 1,
          isSelf: !message.verified && message.sender === nickname,
          ...(status ? { status } : {}),
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  }, [messages, nickname]);

  return {
    messages,
    connection,
    loadError,
    loading,
    participants,
    send,
    retry,
    dismissFailed,
    loadEarlier,
    canLoadEarlier,
    loadingEarlier,
    reconnectNow,
  };
}
