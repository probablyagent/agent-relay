/**
 * localStorage, used only for conveniences.
 *
 * Never authoritative. Messages always come from Technocore; this remembers a nickname and
 * a list of relays the browser has opened so they can be reopened. Every access is wrapped
 * because private-mode Safari throws on write and some browsers throw on read.
 */

import { isValidRelayId } from "@/lib/relay-id";

const NICK_KEY = "agent-relay:nickname";
const RECENT_KEY = "agent-relay:recent";
const MAX_RECENT = 8;

export interface RecentRelay {
  id: string;
  name: string;
  openedAt: string;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota, private mode, or storage disabled — the app works without it */
  }
}

export function getNickname(): string {
  const value = read<unknown>(NICK_KEY, "");
  return typeof value === "string" ? value : "";
}

export function setNickname(nick: string): void {
  write(NICK_KEY, nick);
}

export function getRecentRelays(): RecentRelay[] {
  const value = read<unknown>(RECENT_KEY, []);
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is RecentRelay => {
      if (typeof entry !== "object" || entry === null) return false;
      const e = entry as Partial<RecentRelay>;
      return typeof e.id === "string" && isValidRelayId(e.id) && typeof e.name === "string";
    })
    .map((entry) => ({
      id: entry.id,
      // Locally stored but originally typed by a human; cap it before it reaches the DOM.
      name: String(entry.name).slice(0, 120),
      openedAt: typeof entry.openedAt === "string" ? entry.openedAt : new Date().toISOString(),
    }))
    .slice(0, MAX_RECENT);
}

export function rememberRelay(relay: { id: string; name: string }): void {
  if (!isValidRelayId(relay.id)) return;
  const existing = getRecentRelays().filter((entry) => entry.id !== relay.id);
  write(RECENT_KEY, [
    { id: relay.id, name: relay.name.slice(0, 120), openedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX_RECENT));
}

export function forgetRelay(id: string): void {
  write(RECENT_KEY, getRecentRelays().filter((entry) => entry.id !== id));
}
