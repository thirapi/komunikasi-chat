"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChartBarHorizontal } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import type { PollDTO } from "@/lib/entities/models/message.model";
import { cn } from "@/lib/utils";
import { votePollAction } from "../messages.action";

/**
 * A poll in a message: tap an option to vote, tap it again to take the vote
 * back; with multiple answers allowed each option toggles on its own. Results
 * show for everyone with names on hover (votes are visible, like WhatsApp).
 * The vote shows at once and is replaced by the server's message-updated.
 */
export function PollCard({ poll, currentUserId }: { poll: PollDTO; currentUserId: string }) {
  const serverMine = useMemo(
    () => poll.options.filter((o) => o.votes.some((v) => v.userId === currentUserId)).map((o) => o.id),
    [poll, currentUserId],
  );
  const [pending, setPending] = useState<string[] | null>(null);
  useEffect(() => setPending(null), [poll]);
  const mine = pending ?? serverMine;

  const counts = poll.options.map((o) => {
    const others = o.votes.filter((v) => v.userId !== currentUserId).length;
    return others + (mine.includes(o.id) ? 1 : 0);
  });
  const voters = new Set(poll.options.flatMap((o) => o.votes.map((v) => v.userId)).filter((id) => id !== currentUserId));
  if (mine.length > 0) voters.add(currentUserId);
  const total = voters.size;
  const top = Math.max(0, ...counts);

  const vote = async (optionId: string) => {
    const next = poll.allowMultiple
      ? mine.includes(optionId) ? mine.filter((id) => id !== optionId) : [...mine, optionId]
      : mine.includes(optionId) ? [] : [optionId];
    setPending(next);
    const res = await votePollAction(poll.id, next);
    if (res.status !== "success") {
      setPending(null);
      toast.error(res.error?.message || "Gagal memilih");
    }
  };

  return (
    <div className="mt-1 mb-0.5 w-full max-w-sm rounded-lg border border-border bg-background p-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-2">
        <ChartBarHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug break-words">{poll.question}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {poll.allowMultiple ? "Pilih satu atau lebih" : "Pilih satu"}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {poll.options.map((o, i) => {
          const selected = mine.includes(o.id);
          const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
          const names = o.votes
            .filter((v) => v.userId !== currentUserId)
            .map((v) => v.user?.name || v.user?.username || "Pengguna");
          if (selected) names.unshift("Kamu");
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => vote(o.id)}
              title={names.length ? names.join(", ") : "Belum ada suara"}
              aria-pressed={selected}
              className={cn(
                "relative overflow-hidden rounded-md border px-2.5 py-2 text-left text-[13px] transition-colors",
                selected ? "border-primary/60" : "border-border hover:bg-muted/50",
              )}
            >
              <span
                aria-hidden
                className={cn("absolute inset-y-0 left-0 transition-[width] duration-300", counts[i] === top && top > 0 ? "bg-primary/15" : "bg-muted")}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center border",
                    poll.allowMultiple ? "rounded" : "rounded-full",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                  )}
                >
                  {selected && <Check weight="bold" className="h-2.5 w-2.5" />}
                </span>
                <span className="min-w-0 flex-1 break-words">{o.text}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {counts[i]} · {pct}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {total === 0 ? "Belum ada suara" : `${total} orang memilih`}
      </p>
    </div>
  );
}
