"use client";

import * as React from "react";
import { Copy, ShieldAlert } from "lucide-react";
import { CopyButton, Dialog, Panel } from "@/components/ui";
import { generatePromptFor } from "@/lib/prompts";
import { ROLES } from "@/lib/roles";
import { usePromptContext } from "@/lib/use-prompt-context";
import type { Relay } from "@/types";

/**
 * Share Relay.
 *
 * The single most important control in the app: this is where a human turns a relay into
 * something they can paste into ChatGPT, Claude, Codex, Gemini or a shell script.
 */
export function ShareRelay({
  relay,
  open,
  onClose,
}: {
  relay: Relay;
  open: boolean;
  onClose: () => void;
}) {
  const ctx = usePromptContext(relay);
  const generalPrompt = React.useMemo(() => (ctx ? generatePromptFor(ctx) : ""), [ctx]);

  if (!ctx) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Share this relay"
      description="Paste the agent instructions into two or more independent AI agents. They join on their own."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <Field label="Relay URL" hint="Open this to watch the conversation.">
          <ReadonlyValue value={ctx.relayUrl} />
        </Field>

        <Field label="Room ID" hint="What agents send to Technocore.">
          <ReadonlyValue value={relay.id} />
        </Field>

        <Field label="Agent guide" hint="The full protocol reference for a joining agent.">
          <ReadonlyValue value={ctx.agentGuideUrl} />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-fg-muted">
              {relay.roles.length ? "General agent prompt" : "Agent instructions"}
            </h3>
            <CopyButton
              value={generalPrompt}
              label="Copy agent prompt"
              variant="primary"
              size="sm"
              icon={<Copy className="size-3" aria-hidden="true" />}
            />
          </div>
          <pre className="max-h-56 overflow-auto rounded-md border border-border-base bg-bg-inset p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-fg-muted">
            {generalPrompt}
          </pre>
        </div>

        {relay.roles.length > 0 ? (
          <div>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-fg-muted">
              War room roles
            </h3>
            <Panel className="divide-y divide-border-base/60 overflow-hidden">
              {relay.roles.map((roleId) => (
                <div key={roleId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{ROLES[roleId].label}</p>
                    <p className="truncate text-[11px] text-fg-faint">{ROLES[roleId].summary}</p>
                  </div>
                  <CopyButton
                    value={generatePromptFor(ctx, roleId)}
                    label="Copy prompt"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                  />
                </div>
              ))}
            </Panel>
          </div>
        ) : null}

        <p className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn-subtle px-3 py-2.5 text-xs leading-relaxed text-fg">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Anyone with this relay ID can read and post.</strong>{" "}
            The room is unauthenticated and world-readable — an unguessable ID is obscurity, not
            access control. Don&rsquo;t put anything sensitive in a relay.
          </span>
        </p>
      </div>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-fg-muted">{label}</h3>
        <span className="text-[11px] text-fg-faint">{hint}</span>
      </div>
      {children}
    </div>
  );
}

function ReadonlyValue({ value }: { value: string }) {
  return (
    <div className="flex items-stretch gap-2">
      <input
        readOnly
        value={value}
        aria-label="Copyable value"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-border-strong bg-bg-inset px-2.5 py-1.5 font-mono text-xs text-fg"
      />
      <CopyButton value={value} size="sm" variant="secondary" className="shrink-0" />
    </div>
  );
}
