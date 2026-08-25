"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { Button, Input, Panel } from "@/components/ui";
import {
  DEFAULT_BASE_URL,
  getBaseUrl,
  probeConnection,
  setBaseUrl,
  type Reachability,
} from "@/lib/technocore/client";
import { cn } from "@/lib/utils";
import type { TechnocoreError } from "@/lib/technocore/types";

/**
 * What the page says when it cannot talk to Technocore.
 *
 * A cross-origin read the browser refuses fails as an opaque `TypeError` — no status, no
 * body, indistinguishable from a dropped connection. Rather than shrug at that, this runs
 * a probe that *can* tell the two apart (see `probeConnection`) and reports what it found.
 * Until the probe has run it claims nothing.
 */
export function ConnectionTrouble({
  error,
  onRetry,
  compact,
}: {
  error: TechnocoreError;
  onRetry: () => void;
  /** Inline inside a form, rather than filling the page. */
  compact?: boolean;
}) {
  const body = <TroubleBody error={error} onRetry={onRetry} />;

  if (compact) {
    return (
      <Panel className="overflow-hidden border-warn/40" role="alert">
        {body}
      </Panel>
    );
  }

  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto p-4 sm:p-8">
      <Panel className="w-full max-w-xl overflow-hidden">{body}</Panel>
    </div>
  );
}

const VERDICT: Record<Reachability, { title: string; tone: string; detail: React.ReactNode }> = {
  ok: {
    title: "Technocore is reachable now",
    tone: "text-live",
    detail: (
      <>
        The connection test just succeeded, so whatever failed looks temporary. Try again.
      </>
    ),
  },
  "cors-blocked": {
    title: "Technocore answered, but your browser blocked the reply",
    tone: "text-warn",
    detail: (
      <>
        The request reached the server and came back — the browser refused to let this page
        read it, because that Technocore instance does not send CORS headers for this
        origin. This is not something the page can work around; it has to be fixed on the
        Technocore side, or you can point the app at an instance that allows this origin.
      </>
    ),
  },
  unreachable: {
    title: "Technocore did not respond at all",
    tone: "text-danger",
    detail: (
      <>
        The request never got a reply, so this is a network, DNS or availability problem
        rather than a browser restriction. Check your connection, then try again.
      </>
    ),
  },
};

function TroubleBody({ error, onRetry }: { error: TechnocoreError; onRetry: () => void }) {
  const [base, setBaseState] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [verdict, setVerdict] = React.useState<Reachability | null>(null);
  const [probing, setProbing] = React.useState(false);

  const isNetwork = error.kind === "network" || error.kind === "cors" || error.kind === "timeout";

  React.useEffect(() => {
    const current = getBaseUrl();
    setBaseState(current);
    setDraft(current);

    // Run the diagnosis immediately: the answer changes what the reader should do, and
    // making them press a button first only delays it.
    if (!isNetwork) return;
    let cancelled = false;
    setProbing(true);
    void probeConnection()
      .then((result) => !cancelled && setVerdict(result))
      .finally(() => !cancelled && setProbing(false));
    return () => {
      cancelled = true;
    };
  }, [isNetwork]);

  return (
    <>
      <div className="flex items-start gap-3 border-b border-border-base bg-warn-subtle px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-fg">
            {isNetwork ? "Can't reach Technocore from this browser" : error.message}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            {isNetwork ? (
              <>
                The request to <span className="font-mono break-all">{base}</span> did not come
                back.
              </>
            ) : (
              <>Technocore answered, but not with something this page could use.</>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {isNetwork ? (
          <div
            className={cn(
              "rounded-md border px-3 py-2.5",
              verdict ? "border-border-strong bg-bg-inset" : "border-border-base",
            )}
          >
            {probing ? (
              <p className="flex items-center gap-2 text-xs text-fg-muted">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Testing the connection…
              </p>
            ) : verdict ? (
              <>
                <p className={cn("flex items-center gap-1.5 text-xs font-semibold", VERDICT[verdict].tone)}>
                  {verdict === "ok" ? (
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                  )}
                  {VERDICT[verdict].title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                  {VERDICT[verdict].detail}
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={onRetry}>
            Try again
          </Button>
          <a
            href={`${base}/healthz`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-bg-raised px-2.5 text-xs font-medium text-fg hover:bg-bg-inset"
          >
            Open the service directly
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>

        <div>
          <label
            htmlFor="technocore-base"
            className="block text-xs font-medium uppercase tracking-wider text-fg-muted"
          >
            Technocore instance
          </label>
          <p className="mt-1 mb-2 text-[11px] leading-relaxed text-fg-faint">
            Agent Relay talks to Technocore straight from your browser — there is no server in
            between. If <span className="font-mono">{DEFAULT_BASE_URL}</span> does not send CORS
            headers for this origin, point the app at an instance that does. Running your own
            takes one command:{" "}
            <span className="font-mono text-[10.5px] break-all">
              docker run -p 8080:8080 -e CHAT_CORS_ORIGINS=&lt;this origin&gt;
              ghcr.io/flop-labs/technocore-chat
            </span>
            .
          </p>
          <div className="flex items-stretch gap-2">
            <Input
              id="technocore-base"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
              className="font-mono text-xs"
              inputMode="url"
            />
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={() => {
                setBaseUrl(draft.trim() || null);
                window.location.reload();
              }}
            >
              Use this
            </Button>
          </div>
          {base !== DEFAULT_BASE_URL ? (
            <button
              type="button"
              className="mt-1.5 rounded text-[11px] text-accent underline underline-offset-2"
              onClick={() => {
                setBaseUrl(null);
                window.location.reload();
              }}
            >
              Reset to {DEFAULT_BASE_URL}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
