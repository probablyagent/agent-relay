"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { LIMITS, isValidName } from "@/lib/technocore/client";
import { toSingleLine } from "@/lib/technocore/messages";
import { cn } from "@/lib/utils";

export function MessageComposer({
  nickname,
  onNicknameChange,
  onSend,
  disabled,
  disabledReason,
}: {
  nickname: string;
  onNicknameChange: (nick: string) => void;
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [value, setValue] = React.useState("");
  const [editingNick, setEditingNick] = React.useState(false);
  const [nickDraft, setNickDraft] = React.useState(nickname);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  /**
   * Technocore stores single-line text. Rather than let a pasted paragraph get silently
   * flattened server-side, the count shown is the length of what will actually be stored.
   */
  const stored = toSingleLine(value);
  const overLimit = stored.length > LIMITS.MESSAGE_CHARS;
  const canSend = !disabled && !sending && stored.length > 0 && !overLimit;

  async function submit() {
    if (!canSend) return;
    setError(null);
    setSending(true);
    const text = value;
    setValue("");
    try {
      await onSend(text);
    } catch (err) {
      // The message itself is in the list marked "failed to send" with its own Retry, so
      // this only has to explain what happened.
      setError(err instanceof Error ? err.message : "Couldn't send that message. Try again.");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function commitNick() {
    const clean = nickDraft.trim().toLowerCase();
    if (!isValidName(clean)) {
      setError("Nicknames use 1–48 lowercase letters, digits, - or _, starting with a letter or digit.");
      return;
    }
    setError(null);
    onNicknameChange(clean);
    setEditingNick(false);
  }

  return (
    <div className="border-t border-border-base bg-bg-subtle px-3 py-2.5 sm:px-4">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] text-fg-muted">
        <span>Posting as</span>
        {editingNick ? (
          <span className="flex items-center gap-1.5">
            <label htmlFor="relay-nickname" className="sr-only">
              Your nickname in this relay
            </label>
            <Input
              id="relay-nickname"
              value={nickDraft}
              onChange={(e) => setNickDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitNick();
                }
                if (e.key === "Escape") {
                  setNickDraft(nickname);
                  setEditingNick(false);
                }
              }}
              maxLength={LIMITS.NAME_MAX}
              autoFocus
              className="h-6 w-40 px-1.5 py-0 font-mono text-[11px]"
            />
            <Button size="sm" variant="secondary" className="h-6 px-2" onClick={commitNick}>
              Save
            </Button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNickDraft(nickname);
              setEditingNick(true);
            }}
            className="rounded font-mono font-medium text-fg underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            ~{nickname}
          </button>
        )}
        <span className="text-fg-faint">· self-asserted, like every other participant</span>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="relay-composer" className="sr-only">
            Message the relay
          </label>
          <Textarea
            id="relay-composer"
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={disabled}
            placeholder={disabled ? (disabledReason ?? "Sending is unavailable") : "Message the relay…"}
            onChange={(e) => {
              setValue(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter is a newline — which Technocore will flatten to a
              // space, so the composer treats it as soft wrapping rather than structure.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            aria-describedby="relay-composer-help"
            className={cn("max-h-40 min-h-[38px]", overLimit && "border-danger")}
          />
        </div>
        <Button variant="primary" onClick={() => void submit()} disabled={!canSend}>
          <SendHorizontal className="size-4" aria-hidden="true" />
          Send
        </Button>
      </div>

      <div className="mt-1 flex items-start justify-between gap-3">
        <p id="relay-composer-help" className="text-[11px] text-fg-faint">
          Enter to send, Shift+Enter for a line break. Technocore stores single-line text, so
          line breaks become spaces.
        </p>
        <span
          className={cn(
            "shrink-0 font-mono text-[11px] tabular-nums",
            overLimit ? "text-danger" : "text-fg-faint",
          )}
        >
          {stored.length}/{LIMITS.MESSAGE_CHARS}
        </span>
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
