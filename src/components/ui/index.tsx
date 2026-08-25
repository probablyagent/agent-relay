"use client";

/**
 * A handful of primitives in the shadcn/ui idiom, written out rather than generated: the
 * app needs six of them and pulling in the generator's dependency tree for that would cost
 * more than it saves.
 */

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ Button

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-90 border border-transparent",
  secondary: "bg-bg-raised text-fg border border-border-strong hover:bg-bg-inset",
  ghost: "bg-transparent text-fg-muted border border-transparent hover:bg-bg-inset hover:text-fg",
  danger: "bg-transparent text-danger border border-border-strong hover:bg-danger-subtle",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
});

// ------------------------------------------------------------------ Input / Textarea

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border border-border-strong bg-bg-raised px-3 py-2 text-sm",
          "text-fg placeholder:text-fg-faint",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-none rounded-md border border-border-strong bg-bg-raised px-3 py-2 text-sm",
        "text-fg placeholder:text-fg-faint",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});

// ------------------------------------------------------------------ Label / Field

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-xs font-medium uppercase tracking-wider text-fg-muted", className)}
      {...props}
    />
  );
}

// ------------------------------------------------------------------ Panel

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border-base bg-bg-raised", className)}
      {...props}
    />
  );
}

export function PanelHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-faint",
        className,
      )}
    >
      {children}
    </h2>
  );
}

// ------------------------------------------------------------------ Dialog

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Max width class; share modals want more room than confirmations. */
  className?: string;
}

/**
 * A modal dialog with a focus trap, Escape to close, and focus returned to whatever opened
 * it. `<dialog>` would give some of this for free but not consistently across the browsers
 * this has to work in, so it is done explicitly.
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocus = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative z-10 w-full rounded-xl border border-border-strong bg-bg-raised shadow-2xl",
          className ?? "max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-base px-5 py-4">
          <div>
            <h2 id={titleId} className="text-sm font-semibold text-fg">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-xs text-fg-muted">
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Copy button

export interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  value: string;
  label?: string;
  copiedLabel?: string;
  icon?: React.ReactNode;
}

/**
 * Copy-to-clipboard with a confirmation that is announced, not merely coloured — the
 * "Copied" state is real text in a live region, so it reaches a screen reader too.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  icon,
  ...props
}: CopyButtonProps) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");

  React.useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <Button
      {...props}
      onClick={async () => {
        const { copyToClipboard } = await import("@/lib/utils");
        setState((await copyToClipboard(value)) ? "copied" : "failed");
      }}
    >
      {icon}
      <span aria-live="polite">
        {state === "copied" ? copiedLabel : state === "failed" ? "Press Ctrl+C" : label}
      </span>
    </Button>
  );
}
