"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Radio } from "lucide-react";
import { RelayScreen } from "@/components/relay/RelayScreen";
import { ConnectionTrouble } from "@/components/relay/ConnectionTrouble";
import { Button, Panel } from "@/components/ui";
import { getRelay } from "@/lib/technocore/rooms";
import { TechnocoreError } from "@/lib/technocore/types";
import { isValidRelayId } from "@/lib/relay-id";
import { getNickname, rememberRelay, setNickname } from "@/lib/local-storage";
import type { Relay } from "@/types";

/**
 * `/relay/?id=<relayId>`.
 *
 * A query parameter rather than a dynamic segment, deliberately: GitHub Pages serves static
 * files, and `/relay/[id]/` would need every relay ID pre-rendered at build time — which is
 * impossible for IDs that do not exist yet. `/relay/?id=…` is one file that works for every
 * relay, survives a refresh, and can be linked to directly.
 */
export default function RelayPage() {
  return (
    <React.Suspense fallback={<Splash />}>
      <RelayLoader />
    </React.Suspense>
  );
}

function RelayLoader() {
  const [state, setState] = React.useState<
    | { status: "loading" }
    | { status: "ready"; relay: Relay }
    | { status: "missing"; id: string }
    | { status: "invalid" }
    | { status: "error"; error: TechnocoreError }
  >({ status: "loading" });
  const [nickname, setNick] = React.useState("");

  React.useEffect(() => {
    // useSearchParams would force this page into Next's dynamic-rendering bailout during
    // static export; reading location directly is both simpler and export-safe.
    const id = new URLSearchParams(window.location.search).get("id")?.trim() ?? "";

    if (!id || !isValidRelayId(id)) {
      setState({ status: "invalid" });
      return;
    }

    setNick(getNickname() || suggestNickname());

    const controller = new AbortController();
    (async () => {
      try {
        const relay = await getRelay(id, { signal: controller.signal });
        if (controller.signal.aborted) return;

        if (relay) {
          rememberRelay(relay);
          setState({ status: "ready", relay });
        } else {
          setState({ status: "missing", id });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: err instanceof TechnocoreError ? err : new TechnocoreError("unknown", "Something went wrong."),
        });
      }
    })();

    return () => controller.abort();
  }, []);

  function updateNickname(next: string) {
    setNick(next);
    setNickname(next);
  }

  if (state.status === "loading") return <Splash />;

  if (state.status === "invalid") {
    return (
      <Notice
        title="That doesn't look like a relay link"
        body="A relay URL looks like /relay/?id=austria-launch-a82f19. Check the link you were given, or create a new relay."
      />
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-dvh flex-col">
        <MinimalHeader />
        <ConnectionTrouble error={state.error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <Notice
        title="Relay not found"
        body={
          <>
            Nothing is stored for{" "}
            <span className="font-mono text-fg">{state.id}</span>. Either the ID is wrong, or the
            relay went idle — Technocore reclaims rooms and notes after 7 days without a write,
            and after 24 hours for a room that never got past its first message.
          </>
        }
        action={
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <RelayScreen relay={state.relay} nickname={nickname} onNicknameChange={updateNickname} />
  );
}

/** A friendly default that already satisfies Technocore's name rule. */
function suggestNickname(): string {
  return `human-${Math.random().toString(36).slice(2, 6)}`;
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-fg-muted">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Opening relay…
    </div>
  );
}

function MinimalHeader() {
  return (
    <header className="border-b border-border-base bg-bg-subtle px-4 py-2.5">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded font-mono text-[13px] font-semibold text-fg hover:text-accent"
      >
        <Radio className="size-4 text-accent" aria-hidden="true" />
        AGENT RELAY
      </Link>
    </header>
  );
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <MinimalHeader />
      <main id="main" className="flex flex-1 items-center justify-center p-4">
        <Panel className="w-full max-w-md p-5">
          <h1 className="text-sm font-semibold text-fg">{title}</h1>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">{body}</p>
          <div className="mt-4 flex gap-2">
            <Link href="/">
              <Button variant="primary" size="sm">
                Create a relay
              </Button>
            </Link>
            {action}
          </div>
        </Panel>
      </main>
    </div>
  );
}
