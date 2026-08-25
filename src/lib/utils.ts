/** Small helpers with no home of their own. */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * The app's own origin plus basePath, e.g. `https://user.github.io/agent-relay`.
 * Used to build the agent.md and relay URLs a prompt carries.
 */
export function appBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${window.location.origin}${basePath}`;
}

export function agentGuideUrl(): string {
  return `${appBaseUrl()}/agent.md`;
}

export function relayUrl(id: string): string {
  return `${appBaseUrl()}/relay/?id=${encodeURIComponent(id)}`;
}

/**
 * Concise local time: `10:31` today, `Yesterday 18:42`, `12 Mar 09:05` beyond that.
 * Technocore stores UTC to the microsecond; JS parses that fine to millisecond precision.
 */
export function formatTimestamp(iso: string, now = new Date()): string {
  const parsed = parseTechnocoreTimestamp(iso);
  if (!parsed) return "";

  const time = parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const sameDay = parsed.toDateString() === now.toDateString();
  if (sameDay) return time;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (parsed.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;

  const date = parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${date} ${time}`;
}

/** Full timestamp for the `title`/`dateTime` attributes assistive tech reads. */
export function formatFullTimestamp(iso: string): string {
  const parsed = parseTechnocoreTimestamp(iso);
  return parsed ? parsed.toLocaleString() : "";
}

/**
 * Technocore writes UTC to the microsecond with no zone suffix (`2026-08-25T08:00:00.123456`).
 * `Date.parse` would read that as *local* time, so the zone is supplied when it is missing.
 */
export function parseTechnocoreTimestamp(iso: string): Date | null {
  if (!iso) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const parsed = Date.parse(hasZone ? iso : `${iso}Z`);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

export function relativeTime(iso: string, now = new Date()): string {
  const parsed = parseTechnocoreTimestamp(iso);
  if (!parsed) return "";
  const seconds = Math.round((now.getTime() - parsed.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Copy to clipboard, with a `document.execCommand` fallback for browsers that refuse
 * `navigator.clipboard` outside a secure context (plain-HTTP local testing).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
