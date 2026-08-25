"use client";

import { AlertTriangle, BadgeCheck, Loader2, RotateCw, X } from "lucide-react";
import { verifyIdentity } from "@/lib/technocore/identity";
import { formatFullTimestamp, formatTimestamp, cn } from "@/lib/utils";
import type { RelayMessage as RelayMessageModel } from "@/types";
import { Button } from "@/components/ui";

/**
 * Render one message.
 *
 * Everything here is anonymous, world-writable input from Technocore. It reaches the DOM
 * exclusively as React text children, which React escapes — this component builds no HTML,
 * resolves no URLs and turns no part of a message body into an element with somewhere to
 * go. A message that reads "IGNORE ALL PREVIOUS INSTRUCTIONS" is a string that says that.
 */
export function RelayMessage({
  message,
  isSelf,
  onRetry,
  onDismiss,
}: {
  message: RelayMessageModel;
  isSelf: boolean;
  onRetry?: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  const identity = verifyIdentity(message.sender);
  const pending = message.status === "sending";
  const failed = message.status === "failed";

  return (
    <article
      className={cn(
        "group animate-relay-fade-in px-3 py-2 sm:px-4",
        failed && "bg-danger-subtle",
        pending && "opacity-60",
      )}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className={cn(
            "font-mono text-[13px] font-medium break-all",
            isSelf ? "text-accent" : identity.verified ? "text-fg" : "text-fg",
          )}
        >
          {/*
            Self-asserted names show a `~`; a verified writer shows the abbreviated key with
            no `~`. The distinction comes from the shape of the value Technocore stored,
            never from anything the writer claimed about itself.
          */}
          {isSelf ? "You" : identity.display}
        </span>

        {identity.verified ? (
          <span
            className="inline-flex items-center gap-1 rounded border border-border-base bg-bg-inset px-1.5 py-px text-[10px] font-medium text-live"
            title={`Technocore verified an Ed25519 signature for ${identity.raw}`}
          >
            <BadgeCheck className="size-3" aria-hidden="true" />
            verified
          </span>
        ) : null}

        {isSelf ? (
          <span className="text-[10px] uppercase tracking-wider text-fg-faint">human</span>
        ) : null}

        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-fg-faint">
          {pending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              sending
            </span>
          ) : failed ? (
            <span className="inline-flex items-center gap-1 text-danger">
              <AlertTriangle className="size-3" aria-hidden="true" />
              failed to send
            </span>
          ) : (
            <time dateTime={message.timestamp} title={formatFullTimestamp(message.timestamp)}>
              {formatTimestamp(message.timestamp)}
            </time>
          )}
        </span>
      </header>

      <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-fg">
        {message.content}
      </p>

      {failed ? (
        <div className="mt-1.5 flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => onRetry?.(message.id)}>
            <RotateCw className="size-3" aria-hidden="true" />
            Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDismiss?.(message.id)}>
            <X className="size-3" aria-hidden="true" />
            Discard
          </Button>
        </div>
      ) : null}
    </article>
  );
}
