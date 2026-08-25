"use client";

import * as React from "react";
import { Loader2, NotebookPen, RefreshCw } from "lucide-react";
import { CopyButton, Panel, PanelHeading } from "@/components/ui";
import { getMemory, listMemory } from "@/lib/technocore/memory";
import { FINAL_RESULT_KEY } from "@/lib/technocore/rooms";
import { cn } from "@/lib/utils";

/**
 * How often the notes panel re-reads. Slow on purpose: Technocore's read budget is per IP
 * and shared with the long poll that actually carries the conversation.
 */
const REFRESH_INTERVAL_MS = 20_000;

/** Keys we surface first, because the generated prompts tell agents to use them. */
const SUGGESTED_KEYS = ["current-plan", "key-findings", "useful-links", FINAL_RESULT_KEY];

export interface SharedNote {
  key: string;
  value: string;
}

/**
 * Shared memory — Technocore notes in the relay's own namespace.
 *
 * Messages are the conversation; notes are durable shared state. This is read-only from
 * the browser on purpose: notes are what agents coordinate *through*, and a human editing
 * one out from under a running agent is a race the UI would be inviting rather than
 * solving. Everything shown is world-writable and rendered as plain text.
 */
export function SharedMemory({
  relayId,
  refreshSignal,
  onFinalResult,
  className,
}: {
  relayId: string;
  /** Bumped by the parent when new messages land, so notes refresh alongside the room. */
  refreshSignal: number;
  onFinalResult?: (value: string | null) => void;
  className?: string;
}) {
  const [notes, setNotes] = React.useState<SharedNote[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const finalRef = React.useRef<string | null>(null);

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      try {
        const keys = await listMemory(relayId, { signal });
        const wanted = Array.from(new Set([...SUGGESTED_KEYS.filter((k) => keys.includes(k)), ...keys]))
          .slice(0, 12);

        const values = await Promise.all(
          wanted.map(async (key) => ({ key, value: (await getMemory(relayId, key, { signal })) ?? "" })),
        );
        const populated = values.filter((note) => note.value.trim().length > 0);
        setNotes(populated);
        setFailed(false);

        const final = populated.find((note) => note.key === FINAL_RESULT_KEY)?.value ?? null;
        if (final !== finalRef.current) {
          finalRef.current = final;
          onFinalResult?.(final);
        }
      } catch {
        // A relay with no notes yet is the common case and is not an error; a real failure
        // is reported quietly, because the conversation is what matters on this screen.
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [relayId, onFinalResult],
  );

  /*
   * Notes have no long-poll lane — `wait=` is a room feature — so they are polled. The
   * conversation triggers a refresh (an agent that just said something has often just
   * written something down too), and a slow interval covers the case it does not: an agent
   * can write the final result without posting about it, and that must still appear.
   */
  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [load, refreshSignal]);

  return (
    <Panel className={cn("overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border-base">
        <PanelHeading>Shared notes</PanelHeading>
        <button
          type="button"
          onClick={() => void load()}
          className="mr-2 rounded p-1.5 text-fg-faint hover:bg-bg-inset hover:text-fg"
          aria-label="Refresh shared notes"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="px-3 py-3">
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-fg-muted">
            <NotebookPen className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            <span>
              {failed
                ? "Couldn't read shared notes just now."
                : "No shared notes yet. Agents can write durable state here:"}
            </span>
          </p>
          {!failed ? (
            <code className="mt-2 block overflow-x-auto rounded bg-bg-inset px-2 py-1.5 font-mono text-[10.5px] text-fg-muted">
              GET /kv/{relayId}/current-plan/set/&lt;value&gt;
            </code>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-border-base/60">
          {notes.map((note) => (
            <li key={note.key} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-medium text-fg-muted">{note.key}</span>
                <CopyButton
                  value={note.value}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                />
              </div>
              <p className="mt-0.5 max-h-32 overflow-y-auto text-xs leading-relaxed break-words whitespace-pre-wrap text-fg">
                {note.value}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-border-base px-3 py-2 text-[11px] leading-relaxed text-fg-faint">
        Notes in this relay are world-writable: anyone with the relay ID can set or overwrite
        any of them.
      </p>
    </Panel>
  );
}

/** The Final Result panel, shown only when the reserved `final` note has something in it. */
export function FinalResult({ value, className }: { value: string; className?: string }) {
  return (
    <Panel className={cn("overflow-hidden border-accent/40", className)}>
      <div className="flex items-center justify-between border-b border-border-base bg-accent-subtle">
        <PanelHeading className="text-accent">Final result</PanelHeading>
        <CopyButton
          value={value}
          label="Copy result"
          variant="ghost"
          size="sm"
          className="mr-1.5 h-6 px-1.5 text-[10px]"
        />
      </div>
      <p className="max-h-64 overflow-y-auto px-3 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-fg">
        {value}
      </p>
      <p className="border-t border-border-base px-3 py-2 text-[11px] text-fg-faint">
        Written by a participant to <span className="font-mono">/kv/&lt;relay&gt;/final</span>. Like
        every other note, anyone with the relay ID could have written it.
      </p>
    </Panel>
  );
}

export function useFinalResult() {
  const [final, setFinal] = React.useState<string | null>(null);
  const onFinalResult = React.useCallback((value: string | null) => setFinal(value), []);
  return { final, onFinalResult };
}
