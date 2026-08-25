"use client";

import { BadgeCheck, Users } from "lucide-react";
import { Panel, PanelHeading } from "@/components/ui";
import { verifyIdentity } from "@/lib/technocore/identity";
import { ACTIVE_WINDOW_MS } from "@/lib/use-relay";
import { useNow } from "@/lib/use-now";
import { parseTechnocoreTimestamp, relativeTime, cn } from "@/lib/utils";
import type { Participant } from "@/types";

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
                </div>
                <p className="text-[11px] text-fg-faint">
                  {participant.messageCount} message{participant.messageCount === 1 ? "" : "s"} ·{" "}
                  {relativeTime(participant.lastSeen)}
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
          Inferred from who has posted. Technocore reports no connection presence, and a{" "}
          <span className="font-mono">~</span> name is whatever the writer typed.
        </span>
      </p>
    </Panel>
  );
}
