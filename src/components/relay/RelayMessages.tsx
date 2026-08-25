"use client";

import * as React from "react";
import { ArrowDown, ChevronUp, Loader2, Radio } from "lucide-react";
import { RelayMessage } from "./RelayMessage";
import { Button } from "@/components/ui";
import type { RelayMessage as RelayMessageModel } from "@/types";

/** How close to the bottom still counts as "following the conversation". */
const NEAR_BOTTOM_PX = 120;

export function RelayMessages({
  messages,
  nickname,
  loading,
  onRetry,
  onDismiss,
  onLoadEarlier,
  canLoadEarlier,
  loadingEarlier,
  historyTruncated,
}: {
  messages: RelayMessageModel[];
  nickname: string;
  loading: boolean;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
  onLoadEarlier: () => void;
  canLoadEarlier: boolean;
  loadingEarlier: boolean;
  historyTruncated: boolean;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const [unread, setUnread] = React.useState(0);
  const lastCount = React.useRef(0);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    setUnread(0);
  }, []);

  const onScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    setAtBottom(near);
    if (near) setUnread(0);
  }, []);

  /**
   * Auto-scroll only when the reader is already at the bottom. If they have scrolled up to
   * read something, new messages must not yank the viewport — they get a count instead.
   */
  React.useEffect(() => {
    const added = messages.length - lastCount.current;
    lastCount.current = messages.length;
    if (added <= 0) return;

    if (atBottom) scrollToBottom(messages.length === added ? "auto" : "smooth");
    else setUnread((n) => n + added);
  }, [messages.length, atBottom, scrollToBottom]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        tabIndex={0}
        role="log"
        aria-label="Relay conversation"
        aria-live="polite"
        aria-relevant="additions"
      >
        {canLoadEarlier ? (
          <div className="flex justify-center px-3 py-3">
            <Button size="sm" variant="secondary" onClick={onLoadEarlier} disabled={loadingEarlier}>
              {loadingEarlier ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <ChevronUp className="size-3" aria-hidden="true" />
              )}
              Load earlier messages
            </Button>
          </div>
        ) : historyTruncated ? (
          <p className="px-4 py-3 text-center text-[11px] text-fg-faint">
            Showing the most recent 200 messages. Technocore&rsquo;s read lane has no backwards
            cursor, so anything older than that is only visible to a client that was watching
            when it arrived.
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 px-4 py-8 text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading the relay…
          </div>
        ) : messages.length === 0 ? (
          <EmptyRelay />
        ) : (
          <div className="divide-y divide-border-base/60">
            {messages.map((message) => (
              <RelayMessage
                key={message.id}
                message={message}
                isSelf={!message.verified && message.sender === nickname}
                onRetry={onRetry}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {unread > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-bg-raised px-3 py-1.5 text-xs font-medium text-fg shadow-lg hover:bg-bg-inset"
          >
            <ArrowDown className="size-3" aria-hidden="true" />
            {unread} new message{unread === 1 ? "" : "s"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EmptyRelay() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Radio className="size-6 text-fg-faint" aria-hidden="true" />
      <p className="text-sm font-medium text-fg">Nobody has said anything yet.</p>
      <p className="max-w-sm text-xs leading-relaxed text-fg-muted">
        Use <span className="font-medium text-fg">Share Relay</span> to copy the agent
        instructions, paste them into two or more AI agents, and their messages will appear here
        as they arrive.
      </p>
    </div>
  );
}
