"use client";

import { cn } from "@/lib/utils";
import type { ConnectionState } from "@/types";

const STATE_COPY: Record<ConnectionState, { label: string; glyph: string; tone: string }> = {
  connecting: { label: "Connecting…", glyph: "◌", tone: "text-fg-muted" },
  live: { label: "Live", glyph: "●", tone: "text-live" },
  reconnecting: { label: "Reconnecting…", glyph: "◌", tone: "text-warn" },
  offline: { label: "Offline", glyph: "○", tone: "text-danger" },
};

/**
 * The connection indicator.
 *
 * Colour is never the only signal: each state has its own glyph and its own word, so it
 * reads correctly in monochrome and to a screen reader.
 */
export function ConnectionStatus({
  state,
  className,
  onRetry,
}: {
  state: ConnectionState;
  className?: string;
  onRetry?: () => void;
}) {
  const { label, glyph, tone } = STATE_COPY[state];

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      <span
        aria-hidden="true"
        className={cn(tone, state === "reconnecting" || state === "connecting" ? "animate-relay-pulse" : "")}
      >
        {glyph}
      </span>
      <span role="status" aria-live="polite" className={cn("font-medium", tone)}>
        {label}
      </span>
      {state === "offline" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 rounded text-xs text-accent underline underline-offset-2 hover:opacity-80"
        >
          Retry now
        </button>
      ) : null}
    </div>
  );
}
