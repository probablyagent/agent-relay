"use client";

import * as React from "react";
import Link from "next/link";
import { EyeOff, Lock, Radio, Target } from "lucide-react";
import { Button } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isUnlisted } from "@/lib/relay-id";
import type { Relay } from "@/types";

export function RelayHeader({
  relay,
  onClose,
  onShare,
  closing,
  readOnly,
}: {
  relay: Relay;
  onClose?: () => void;
  /** Opens the share dialog, which the relay screen owns. */
  onShare?: () => void;
  closing?: boolean;
  /** The demo relay renders the header without live controls. */
  readOnly?: boolean;
}) {
  const unlisted = isUnlisted(relay.id);

  return (
    <header className="border-b border-border-base bg-bg-subtle">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded font-mono text-[13px] font-semibold tracking-tight text-fg hover:text-accent"
        >
          <Radio className="size-4 text-accent" aria-hidden="true" />
          AGENT RELAY
        </Link>

        <span aria-hidden="true" className="text-fg-faint">
          /
        </span>

        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-fg" title={relay.name}>
          {relay.name}
        </h1>

        <div className="flex items-center gap-2">
          {relay.status === "closed" ? (
            <span className="rounded border border-border-strong bg-bg-inset px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
              Closed
            </span>
          ) : null}
          <ThemeToggle />
          {!readOnly ? (
            <>
              {onClose && relay.status === "active" ? (
                <Button variant="ghost" size="sm" onClick={onClose} disabled={closing}>
                  {closing ? "Closing…" : "Close Relay"}
                </Button>
              ) : null}
              <Button variant="primary" size="sm" onClick={onShare}>
                Share Relay
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5 border-t border-border-base px-3 py-2 sm:px-4">
        {relay.objective ? (
          <p className="flex min-w-0 flex-1 items-start gap-1.5 text-xs leading-relaxed text-fg-muted">
            <Target className="mt-0.5 size-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
            <span>
              <span className="font-medium uppercase tracking-wider text-fg-faint">Objective </span>
              <span className="text-fg">{relay.objective}</span>
            </span>
          </p>
        ) : (
          <p className="flex-1 text-xs text-fg-faint">No objective stated.</p>
        )}

        <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-fg-faint">
          <span className="inline-flex items-center gap-1" title="The Technocore room name">
            {unlisted ? (
              <Lock className="size-3" aria-hidden="true" />
            ) : (
              <EyeOff className="size-3 opacity-0" aria-hidden="true" />
            )}
            {relay.id}
          </span>
        </div>
      </div>
    </header>
  );
}
