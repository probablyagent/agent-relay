"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Swords, Users } from "lucide-react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { ROLES, ROLE_ORDER } from "@/lib/roles";
import { generateRelayId } from "@/lib/relay-id";
import { createRelay, setRoomTopic } from "@/lib/technocore/rooms";
import { postMessage } from "@/lib/technocore/messages";
import { TechnocoreError } from "@/lib/technocore/types";
import { ConnectionTrouble } from "@/components/relay/ConnectionTrouble";
import { rememberRelay } from "@/lib/local-storage";
import { cn } from "@/lib/utils";
import type { RelayMode, RoleId } from "@/types";

const NAME_MAX = 80;
const OBJECTIVE_MAX = 500;

export function CreateRelay() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [mode, setMode] = React.useState<RelayMode>("standard");
  const [roles, setRoles] = React.useState<RoleId[]>(["researcher", "skeptic", "writer"]);
  const [unlisted, setUnlisted] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /*
   * Creating a relay is the first request this app ever makes, so it is where a browser
   * that cannot reach Technocore finds out. A one-line "couldn't create that" would leave
   * the visitor with nothing to do about it; the trouble panel runs an actual diagnosis.
   */
  const [unreachable, setUnreachable] = React.useState<TechnocoreError | null>(null);

  function toggleRole(id: RoleId) {
    setRoles((current) =>
      current.includes(id) ? current.filter((r) => r !== id) : [...current, id],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the relay a name so agents know what they joined.");
      return;
    }

    setBusy(true);
    setError(null);
    setUnreachable(null);
    try {
      const id = generateRelayId(trimmed, { unlisted });
      const relay = await createRelay({
        id,
        name: trimmed,
        objective: objective.trim() || undefined,
        mode,
        roles: mode === "warroom" ? roles : [],
      });

      rememberRelay(relay);

      /*
       * Open the room with one system line. Technocore creates a room on first write, and a
       * room that never gets a second message is reclaimed after 24 hours — so this both
       * brings the room into existence and gives a joining agent something to read.
       */
      await postMessage(
        id,
        "agent-relay",
        `Relay opened: ${relay.name}.${relay.objective ? ` Objective: ${relay.objective}` : ""}`,
      ).catch(() => null);

      // Only a listed relay gets a topic: an unlisted room is never enumerated, so writing
      // one would publish the name for no benefit.
      if (!unlisted) await setRoomTopic(id, `Agent Relay: ${relay.name}`).catch(() => null);

      // `new=1` tells the relay screen this human just created the room, so it opens the
      // share dialog rather than making them find it.
      router.push(`/relay/?id=${encodeURIComponent(id)}&new=1`);
    } catch (err) {
      setBusy(false);
      const failure =
        err instanceof TechnocoreError
          ? err
          : new TechnocoreError("unknown", "Couldn't create that relay. Try again.");

      if (["network", "cors", "timeout"].includes(failure.kind)) setUnreachable(failure);
      else setError(failure.message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label htmlFor="relay-name">Relay name *</Label>
        <Input
          id="relay-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
          placeholder="Stablecoin Treasury Review"
          maxLength={NAME_MAX}
          required
          autoComplete="off"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="relay-objective">Objective</Label>
        <Textarea
          id="relay-objective"
          value={objective}
          onChange={(e) => setObjective(e.target.value.slice(0, OBJECTIVE_MAX))}
          placeholder="Decide whether to hold our treasury reserves in tokenized T-bills, on-chain lending markets, or a bank."
          rows={3}
          maxLength={OBJECTIVE_MAX}
          className="mt-1.5"
          aria-describedby="objective-help"
        />
        <p id="objective-help" className="mt-1 text-[11px] text-fg-faint">
          Every generated agent prompt carries this. {objective.length}/{OBJECTIVE_MAX}
        </p>
      </div>

      <fieldset>
        <legend className="text-xs font-medium uppercase tracking-wider text-fg-muted">Mode</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          <ModeCard
            selected={mode === "standard"}
            onSelect={() => setMode("standard")}
            icon={<Users className="size-4" aria-hidden="true" />}
            title="Standard relay"
            body="One shared prompt. Agents divide the work themselves."
            name="relay-mode"
            value="standard"
          />
          <ModeCard
            selected={mode === "warroom"}
            onSelect={() => setMode("warroom")}
            icon={<Swords className="size-4" aria-hidden="true" />}
            title="War room"
            body="Pick roles and get one copyable prompt per role."
            name="relay-mode"
            value="warroom"
          />
        </div>
      </fieldset>

      {mode === "warroom" ? (
        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wider text-fg-muted">
            Roles
          </legend>
          <div className="mt-1.5 space-y-1.5">
            {ROLE_ORDER.map((id) => (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors",
                  roles.includes(id)
                    ? "border-accent bg-accent-subtle"
                    : "border-border-base hover:bg-bg-inset",
                )}
              >
                <input
                  type="checkbox"
                  checked={roles.includes(id)}
                  onChange={() => toggleRole(id)}
                  className="mt-0.5 size-3.5 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-fg">{ROLES[id].label}</span>
                  <span className="block text-[11px] text-fg-muted">{ROLES[id].summary}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={unlisted}
          onChange={(e) => setUnlisted(e.target.checked)}
          className="mt-0.5 size-3.5 accent-[var(--accent)]"
        />
        <span className="min-w-0">
          <span className="block text-sm text-fg">Keep this relay out of Technocore&rsquo;s room list</span>
          <span className="block text-[11px] leading-relaxed text-fg-muted">
            Uses Technocore&rsquo;s <span className="font-mono">p-</span> room class, so the relay is
            never enumerated or announced. It is still unauthenticated: anyone who learns the ID
            can read and post. Obscurity, not access control.
          </span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}

      {unreachable ? (
        <ConnectionTrouble
          error={unreachable}
          onRetry={() => setUnreachable(null)}
          compact
        />
      ) : null}

      <Button type="submit" variant="primary" disabled={busy} className="w-full sm:w-auto">
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Creating relay…
          </>
        ) : (
          <>
            Create Relay
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </Button>
    </form>
  );
}

function ModeCard({
  selected,
  onSelect,
  icon,
  title,
  body,
  name,
  value,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
  name: string;
  value: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-2.5 rounded-md border px-3 py-2.5 transition-colors",
        selected ? "border-accent bg-accent-subtle" : "border-border-base hover:bg-bg-inset",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span className={cn("mt-0.5", selected ? "text-accent" : "text-fg-faint")}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block text-[11px] leading-relaxed text-fg-muted">{body}</span>
      </span>
    </label>
  );
}
