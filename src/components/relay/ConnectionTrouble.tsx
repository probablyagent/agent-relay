"use client";

import * as React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button, Input, Panel } from "@/components/ui";
import { DEFAULT_BASE_URL, getBaseUrl, setBaseUrl } from "@/lib/technocore/client";
import type { TechnocoreError } from "@/lib/technocore/types";

/**
 * What to show when the relay cannot talk to Technocore at all.
 *
 * A cross-origin request the browser refuses to let the page read fails as an opaque
 * TypeError: no status, no body, indistinguishable from a dropped connection from inside
 * the page. So this does not claim to know which it was — it names both, and offers the one
 * thing that fixes the CORS case without a rebuild: point the app at a Technocore instance
 * that allows this origin.
 */
export function ConnectionTrouble({ error, onRetry }: { error: TechnocoreError; onRetry: () => void }) {
  const [base, setBase] = React.useState("");
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    const current = getBaseUrl();
    setBase(current);
    setDraft(current);
  }, []);

  const isNetwork = error.kind === "network" || error.kind === "cors" || error.kind === "timeout";

  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto p-4 sm:p-8">
      <Panel className="w-full max-w-xl overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border-base bg-warn-subtle px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-fg">
              {isNetwork ? "Can't reach Technocore from this browser" : error.message}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              {isNetwork ? (
                <>
                  The request to <span className="font-mono">{base}</span> never came back. Either
                  the network dropped it, or the browser blocked the cross-origin read because
                  that Technocore instance does not allow this page&rsquo;s origin. A page cannot
                  tell those apart — both arrive as the same opaque failure.
                </>
              ) : (
                <>Technocore answered, but not with something this relay could use.</>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4">
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
              Check the service directly
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
              between. If <span className="font-mono">{DEFAULT_BASE_URL}</span> does not send
              CORS headers for this origin, point the app at an instance that does. Running your
              own takes one command:{" "}
              <span className="font-mono text-[10.5px]">
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
      </Panel>
    </div>
  );
}
