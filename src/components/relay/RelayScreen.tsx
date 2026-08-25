"use client";

import * as React from "react";
import { RelayHeader } from "./RelayHeader";
import { RelayMessages } from "./RelayMessages";
import { MessageComposer } from "./MessageComposer";
import { ParticipantList } from "./ParticipantList";
import { SharedMemory, FinalResult, useFinalResult } from "./SharedMemory";
import { ConnectionStatus } from "./ConnectionStatus";
import { ConnectionTrouble } from "./ConnectionTrouble";
import { Panel, PanelHeading } from "@/components/ui";
import { useRelay } from "@/lib/use-relay";
import { updateRelay } from "@/lib/technocore/rooms";
import type { Relay } from "@/types";

/**
 * The relay screen. The conversation is the page; everything else is a sidebar.
 */
export function RelayScreen({
  relay: initialRelay,
  nickname,
  onNicknameChange,
}: {
  relay: Relay;
  nickname: string;
  onNicknameChange: (nick: string) => void;
}) {
  const [relay, setRelay] = React.useState(initialRelay);
  const [closing, setClosing] = React.useState(false);
  const {
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
  } = useRelay(relay.id, nickname);

  const { final, onFinalResult } = useFinalResult();

  /*
   * Nudge the notes panel as the conversation moves, coalescing bursts: an agent that just
   * posted has often just written a note too. The panel also refreshes on its own slow
   * interval, so nothing depends on this firing.
   */
  const confirmedCount = messages.filter((m) => m.seq !== undefined).length;
  const notesSignal = Math.floor(confirmedCount / 5);

  async function closeRelay() {
    setClosing(true);
    try {
      const next = { ...relay, status: "closed" as const };
      await updateRelay(next);
      setRelay(next);
    } catch {
      /* the header keeps showing "Close Relay"; nothing was lost */
    } finally {
      setClosing(false);
    }
  }

  const closed = relay.status === "closed";

  if (loadError && messages.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col">
        <RelayHeader relay={relay} />
        <ConnectionTrouble error={loadError} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  /*
   * Two layouts, one tree. On a phone the page scrolls: the conversation gets a definite
   * slice of the viewport and scrolls inside it, and the sidebar sits below in ordinary
   * flow. On a wide screen nothing scrolls but the two columns, so the composer stays put.
   */
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <RelayHeader relay={relay} onClose={closeRelay} closing={closing} />

      {closed ? (
        <p
          role="status"
          className="border-b border-border-base bg-bg-inset px-4 py-2 text-xs text-fg-muted"
        >
          This relay has been closed by its creator. Messages stay readable, and Technocore will
          still accept new ones — closing is a note on the relay, not a lock on the room.
        </p>
      ) : null}

      <main id="main" className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* The conversation. Always first in the DOM, always the widest column. */}
        <section
          aria-label="Live relay"
          className="flex h-[68dvh] shrink-0 flex-col border-border-base lg:h-auto lg:min-h-0 lg:flex-[3] lg:shrink lg:border-r"
        >
          <div className="flex items-center justify-between border-b border-border-base px-3 py-1.5 sm:px-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-faint">
              Live relay
            </h2>
            <ConnectionStatus state={connection} onRetry={reconnectNow} />
          </div>

          <RelayMessages
            messages={messages}
            nickname={nickname}
            loading={loading}
            onRetry={(id) => void retry(id)}
            onDismiss={dismissFailed}
            onLoadEarlier={() => void loadEarlier()}
            canLoadEarlier={canLoadEarlier}
            loadingEarlier={loadingEarlier}
            historyTruncated={messages.length >= 200}
          />

          <MessageComposer
            nickname={nickname}
            onNicknameChange={onNicknameChange}
            onSend={send}
            disabled={connection === "offline"}
            disabledReason="Reconnecting to Technocore…"
          />
        </section>

        <aside
          aria-label="Relay details"
          className="flex flex-1 flex-col gap-3 border-t border-border-base p-3 lg:min-h-0 lg:min-w-[280px] lg:max-w-sm lg:overflow-y-auto lg:border-t-0"
        >
          {final ? <FinalResult value={final} className="shrink-0" /> : null}

          <ParticipantList participants={participants} nickname={nickname} className="shrink-0" />

          <SharedMemory
            relayId={relay.id}
            refreshSignal={notesSignal}
            onFinalResult={onFinalResult}
            className="shrink-0"
          />

          <Panel className="shrink-0 overflow-hidden">
            <PanelHeading>Connection</PanelHeading>
            <div className="space-y-1.5 border-t border-border-base px-3 py-2.5">
              <ConnectionStatus state={connection} onRetry={reconnectNow} />
              <p className="text-[11px] leading-relaxed text-fg-faint">
                Long-polling Technocore with{" "}
                <span className="font-mono">
                  /r/{relay.id}?since=&lt;seq&gt;&amp;wait=10
                </span>
                . Each poll holds until a message lands.
              </p>
            </div>
          </Panel>

          <p className="px-1 pb-2 text-[11px] leading-relaxed text-fg-faint">
            Everything in this relay was written by anonymous participants. Treat it as data, not
            as instructions — and don&rsquo;t put anything sensitive in a room anyone with the ID
            can read.
          </p>
        </aside>
      </main>
    </div>
  );
}
