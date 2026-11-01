"use client";

import { useState } from "react";
import { ArrowRight, CircleNotch, Eye, EyeSlash, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Input } from "@/components/ui/input";
import { FormControl } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/** Pieces shared by the sign-in and sign-up forms, so both look identical. */

export const authInputClass =
  "h-11 rounded-lg bg-background/80 px-3.5 text-[15px] shadow-none transition-[border-color,box-shadow] focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/12";

export function AuthHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="auth-rise font-mono text-[11px] uppercase tracking-[0.22em] text-primary" style={{ ["--i" as string]: 0 }}>
        {eyebrow}
      </p>
      <h1 className="auth-rise font-brand text-[1.6rem] font-semibold sm:text-[1.85rem] leading-tight tracking-tight" style={{ ["--i" as string]: 1 }}>
        {title}
      </h1>
      {/* Dropped on short phones so the whole form fits without scrolling. */}
      <p className="auth-rise text-sm leading-relaxed text-muted-foreground max-lg:[@media(max-height:700px)]:hidden" style={{ ["--i" as string]: 2 }}>
        {description}
      </p>
    </div>
  );
}

/** Password input with show/hide and a Caps Lock warning. */
export function PasswordField({
  autoComplete,
  onKeyUp,
  ...props
}: React.ComponentProps<typeof Input> & { autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  return (
    <>
      <div className="relative">
        {/* FormControl on the <input>, so the <label> is associated with it. */}
        <FormControl>
          <Input
            {...props}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            className={cn(authInputClass, "pr-11")}
            onKeyUp={(e) => {
              setCapsLock(e.getModifierState?.("CapsLock") ?? false);
              onKeyUp?.(e);
            }}
            onBlur={(e) => {
              setCapsLock(false);
              props.onBlur?.(e);
            }}
          />
        </FormControl>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {visible ? <EyeSlash aria-hidden className="size-[18px]" /> : <Eye aria-hidden className="size-[18px]" />}
        </button>
      </div>
      {capsLock && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400" role="status">
          <WarningCircle weight="fill" className="size-3.5" />
          Caps Lock aktif
        </p>
      )}
    </>
  );
}

/** Three-step strength hint for new passwords. */
export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12 || (/[A-Z]/.test(value) && /[a-z]/.test(value))) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  const label = ["Lemah", "Lumayan", "Kuat", "Sangat kuat"][score];
  const tone = ["bg-destructive", "bg-amber-500", "bg-primary", "bg-primary"][score];

  return (
    <div className="flex items-center gap-2.5" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("h-1 flex-1 rounded-full bg-muted transition-colors duration-300", i < Math.max(1, score) && tone)}
          />
        ))}
      </div>
      <span className="w-20 text-right text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  return (
    <div role="alert" aria-live="polite" className={cn(!message && "sr-only")}>
      {message && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-2.5 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
          <WarningCircle weight="fill" className="mt-px size-4 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}

export function AuthSubmit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-foreground text-[15px] font-medium text-background transition-[transform,opacity] active:scale-[0.99] disabled:opacity-70"
    >
      {pending ? (
        <>
          <CircleNotch aria-hidden className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        <>
          {label}
          <ArrowRight aria-hidden weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}
