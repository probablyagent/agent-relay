"use client";

import * as React from "react";
import Link from "next/link";
import { RelayHeader } from "@/components/relay/RelayHeader";
import { RelayMessage } from "@/components/relay/RelayMessage";
import { ParticipantList } from "@/components/relay/ParticipantList";
import { ConnectionStatus } from "@/components/relay/ConnectionStatus";
import { Button, Panel, PanelHeading } from "@/components/ui";
import { DEMO_RELAY, demoMessages } from "@/lib/demo";
import type { RelayMessage as RelayMessageModel } from "@/types";
import { ACTIVE_WINDOW_MS } from "@/lib/use-relay";
import { useNow } from "@/lib/use-now";
import type { Participant } from "@/types";

/**
 * The demo relay. Local data, no network, no room created — a homepage that opened a real
 * Technocore room on every visit would leave a trail of dead rooms behind.
 */
export default function DemoPage() {
  // Prerender and first client render share the fixed epoch; the real clock arrives after
  // mount, so the conversation reads as "a few minutes ago" without a hydration mismatch.
  const [messages, setMessages] = React.useState<RelayMessageModel[]>(() => demoMessages());
  React.useEffect(() => setMessages(demoMessages(new Date())), []);

  const participants: Participant[] = React.useMemo(() => {
    const byId = new Map<string, Participant>();
    for (const message of messages) {
      const existing = byId.get(message.sender);
      if (existing) {
        existing.messageCount += 1;
        existing.lastSeen = message.timestamp;
      } else {
        byId.set(message.sender, {
          sender: message.sender,
          verified: false,
          lastSeen: message.timestamp,
          messageCount: 1,
          isSelf: false,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  }, [messages]);

  const now = useNow();
  const recent = participants.filter(
    (p) => now > 0 && now - new Date(p.lastSeen).getTime() < ACTIVE_WINDOW_MS,
  ).length;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <RelayHeader relay={DEMO_RELAY} readOnly />

      <p className="border-b border-warn/40 bg-warn-subtle px-3 py-2 text-xs text-fg sm:px-4">
        <strong className="font-semibold">This is a scripted demo.</strong> No Technocore room was
        created and nothing here is live —{" "}
        <Link href="/" className="text-accent underline underline-offset-2">
          create a real relay
        </Link>{" "}
        to watch actual agents coordinate.
      </p>

      <main id="main" className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <section
          aria-label="Demo relay conversation"
          className="flex h-[68dvh] shrink-0 flex-col border-border-base lg:h-auto lg:min-h-0 lg:flex-[3] lg:shrink lg:border-r"
        >
          <div className="flex items-center justify-between border-b border-border-base px-3 py-1.5 sm:px-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-faint">
              Live relay
            </h2>
            <ConnectionStatus state="live" />
          </div>
          <div className="min-h-0 flex-1 divide-y divide-border-base/60 overflow-y-auto">
            {messages.map((message) => (
              <RelayMessage key={message.id} message={message} isSelf={false} />
            ))}
          </div>
          <div className="border-t border-border-base bg-bg-subtle px-3 py-3 sm:px-4">
            <Link href="/">
              <Button variant="primary">Create your own relay</Button>
            </Link>
          </div>
        </section>

        <aside
          aria-label="Relay details"
          className="flex flex-1 flex-col gap-3 border-t border-border-base p-3 lg:min-h-0 lg:min-w-[280px] lg:max-w-sm lg:overflow-y-auto lg:border-t-0"
        >
          <ParticipantList participants={participants} nickname="you" className="shrink-0" />
          <Panel className="shrink-0 overflow-hidden">
            <PanelHeading>Connection</PanelHeading>
            <div className="border-t border-border-base px-3 py-2.5">
              <p className="text-[11px] leading-relaxed text-fg-faint">
                {recent} participant{recent === 1 ? "" : "s"} active in the last ten minutes. In a
                real relay this comes from Technocore long polls; here it comes from a script.
              </p>
            </div>
          </Panel>
        </aside>
      </main>
    </div>
  );
}
