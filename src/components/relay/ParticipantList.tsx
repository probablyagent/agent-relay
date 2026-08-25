"use client";

import { BadgeCheck, Users } from "lucide-react";
import { Panel, PanelHeading } from "@/components/ui";
import { verifyIdentity } from "@/lib/technocore/identity";
import { ACTIVE_WINDOW_MS } from "@/lib/use-relay";
import { useNow } from "@/lib/use-now";
import { parseTechnocoreTimestamp, relativeTime, cn } from "@/lib/utils";
import type { AgentStatus, Participant } from "@/types";

/**
 * How a self-reported `STATUS:` marker is shown. The wording is deliberately hedged —
 * these are claims a participant made about itself in a plain-text message, exactly as
 * trustworthy as the nickname beside them.
 */
const STATUS_CHIP: Record<AgentStatus, { label: string; className: string; title: string }> = {
  done: {
    label: "done",
    className: "border-live/40 text-live",
    title: "This participant posted STATUS: DONE. Self-reported, like everything else here.",
  },
  blocked: {
    label: "blocked",
    className: "border-danger/40 text-danger",
    title: "This participant posted STATUS: BLOCKED and may be waiting on something.",
  },
  waiting: {
    label: "waiting",
    className: "border-warn/40 text-warn",
    title: "This participant posted STATUS: WAITING on another participant.",
  },
};

/**
 * Who has spoken.
 *
 * Technocore has no presence: it knows who wrote a line, not who is connected. So this is
 * labelled "Recently active" and never "Online" — the heading states what the data
 * actually supports.
 */
export function ParticipantList({
  participants,
  nickname,
  className,
}: {
  participants: Participant[];
  nickname: string;
  className?: string;
}) {
  const now = useNow();
  const selfListed = participants.some((p) => p.isSelf);

  return (
    <Panel className={cn("overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border-base">
        <PanelHeading>Recently active</PanelHeading>
        <span className="px-3 text-[11px] tabular-nums text-fg-faint">
          {participants.length + (selfListed ? 0 : 1)}
        </span>
      </div>

      <ul className="divide-y divide-border-base/60">
        {participants.map((participant) => {
          const identity = verifyIdentity(participant.sender);
          const seen = parseTechnocoreTimestamp(participant.lastSeen);
          const active = seen && now > 0 ? now - seen.getTime() < ACTIVE_WINDOW_MS : false;
          return (
            <li key={participant.sender} className="flex items-start gap-2 px-3 py-2">
              <span
                aria-hidden="true"
                className={cn("mt-1.5 text-[8px]", active ? "text-live" : "text-fg-faint")}
              >
                {active ? "●" : "○"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-mono text-xs text-fg" title={identity.raw}>
                    {participant.isSelf ? "You" : identity.display}
                  </span>
                  {participant.verified ? (
                    <BadgeCheck
                      className="size-3 shrink-0 text-live"
                      aria-label="Signature verified by Technocore"
                    />
                  ) : null}
                  {participant.status ? (
                    <span
                      title={STATUS_CHIP[participant.status].title}
                      className={cn(
                        "shrink-0 rounded border bg-bg-inset px-1 py-px text-[9px] font-medium uppercase tracking-wide",
                        STATUS_CHIP[participant.status].className,
                      )}
                    >
                      {STATUS_CHIP[participant.status].label}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-fg-faint">
                  {participant.messageCount} message{participant.messageCount === 1 ? "" : "s"}
                  {/*
                    Rendered against the ticking clock rather than `new Date()`, so it stays
                    pure (prerender and first client render agree that the clock is not yet
                    running) and refreshes as time passes instead of freezing at "just now".
                  */}
                  {now > 0 ? ` · ${relativeTime(participant.lastSeen, new Date(now))}` : null}
                </p>
              </div>
            </li>
          );
        })}

        {!selfListed ? (
          <li className="flex items-start gap-2 px-3 py-2">
            <span aria-hidden="true" className="mt-1.5 text-[8px] text-fg-faint">
              ○
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-mono text-xs text-fg">You</span>
              <p className="text-[11px] text-fg-faint">
                watching as <span className="font-mono">~{nickname}</span>
              </p>
            </div>
          </li>
        ) : null}
      </ul>

      <p className="flex items-start gap-1.5 border-t border-border-base px-3 py-2 text-[11px] leading-relaxed text-fg-faint">
        <Users className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <span>
          Inferred from who has posted. Technocore reports no connection presence, a{" "}
          <span className="font-mono">~</span> name is whatever the writer typed, and a status
          is whatever they said about themselves.
        </span>
      </p>
    </Panel>
  );
}
