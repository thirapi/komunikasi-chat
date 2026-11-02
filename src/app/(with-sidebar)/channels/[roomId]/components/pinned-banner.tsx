"use client";

import { useEffect, useState } from "react";
import { PushPin, X } from "@phosphor-icons/react/dist/ssr";
import type { PinnedMessageDTO } from "@/lib/entities/models/message.model";
import { stripMarkdown } from "@/lib/strip-markdown";
import { cn } from "@/lib/utils";

function preview(pin: PinnedMessageDTO) {
  const text = stripMarkdown(pin.content.replace(/<@([a-zA-Z0-9_-]+)>/g, "@…")).replace(/\s+/g, " ").trim();
  if (text) return text;
  if (pin.attachmentType?.startsWith("image/")) return "📷 Foto";
  if (pin.attachmentType?.startsWith("video/")) return "🎬 Video";
  return pin.attachmentType ? "📁 File" : "Pesan";
}

/**
 * Pinned messages above the conversation, Telegram-style: shows one pin, a
 * click jumps to it and moves on to the next (older) one, and the bars on the
 * left show how many there are and which one is showing.
 */
export function PinnedBanner({
  pins,
  canUnpin,
  onJump,
  onUnpin,
}: {
  pins: PinnedMessageDTO[];
  canUnpin: boolean;
  onJump: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    // A new pin shows first; a shrinking list must not leave us past the end.
    setIndex(0);
  }, [pins.length, pins[0]?.id]);

  if (pins.length === 0) return null;
  const current = pins[Math.min(index, pins.length - 1)];
  const sender = current.user.name || current.user.username || "Pengguna";

  return (
    <div className="flex items-center gap-2 border-b border-border bg-background/95 px-3 py-1.5 sm:px-4">
      <button
        type="button"
        onClick={() => {
          onJump(current.id);
          setIndex((i) => (i + 1) % pins.length);
        }}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-0.5 text-left transition-colors hover:bg-muted/50"
        aria-label={`Pesan tersemat ${index + 1} dari ${pins.length}: ${preview(current)}`}
      >
        {pins.length > 1 ? (
          <span className="flex h-8 flex-col justify-center gap-0.5" aria-hidden>
            {pins.map((p, i) => (
              <span
                key={p.id}
                className={cn("w-0.5 flex-1 rounded-full", i === index ? "bg-primary" : "bg-border")}
              />
            ))}
          </span>
        ) : (
          <span className="h-8 w-0.5 rounded-full bg-primary" aria-hidden />
        )}
        <PushPin weight="fill" className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium text-primary">
            Pesan tersemat{pins.length > 1 ? ` ${index + 1}/${pins.length}` : ""}
          </span>
          <span className="block truncate text-[13px] text-foreground/90">
            <span className="font-medium">{sender}:</span> {preview(current)}
          </span>
        </span>
      </button>
      {canUnpin && (
        <button
          type="button"
          onClick={() => onUnpin(current.id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Lepas sematan"
          title="Lepas sematan"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
