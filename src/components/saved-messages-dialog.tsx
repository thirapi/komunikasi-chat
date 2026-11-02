"use client";

import { useEffect, useState } from "react";
import { BookmarkSimple, Hash } from "@phosphor-icons/react/dist/ssr";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { stripMarkdown } from "@/lib/strip-markdown";
import type { SavedMessageDTO } from "@/lib/entities/models/saved-message.model";
import { listSavedMessagesAction } from "@/app/(with-sidebar)/saved-messages.action";

function preview(m: SavedMessageDTO) {
  const text = stripMarkdown(m.content.replace(/<@([a-zA-Z0-9_-]+)>/g, "@…")).replace(/\s+/g, " ").trim();
  if (text) return text;
  if (m.attachmentType?.startsWith("image/")) return "📷 Foto";
  if (m.attachmentType?.startsWith("video/")) return "🎬 Video";
  if (m.attachmentType?.startsWith("audio/")) return "🎤 Pesan suara";
  return m.attachmentType ? "📁 File" : "Pesan";
}

/** The user's saved messages; picking one jumps to it in its chat. */
export function SavedMessagesDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (roomId: string, messageId: string) => void;
}) {
  const [items, setItems] = useState<SavedMessageDTO[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setItems(null);
    listSavedMessagesAction().then((res) => {
      if (alive) setItems(res.status === "success" && res.data ? res.data : []);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Pesan tersimpan</DialogTitle>
          <DialogDescription>Simpan pesan dari menu pesan untuk membukanya lagi di sini.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[60vh] overflow-y-auto px-2 pb-3">
          {items === null && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Memuat…</li>}
          {items?.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-3 py-10 text-center text-sm text-muted-foreground">
              <BookmarkSimple className="h-6 w-6" />
              Belum ada pesan tersimpan
            </li>
          )}
          {items?.map((m) => (
            <li key={m.messageId}>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onSelect(m.roomId, m.messageId);
                }}
                className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <UserAvatar src={m.user.avatar || "/avatars/avatar1.png"} alt={m.user.username} className="mt-0.5 size-8 rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-sm font-semibold">{m.user.name || m.user.username}</span>
                    <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
                      {m.isDirect ? "Pesan langsung" : (<><Hash className="size-3" />{m.roomName}</>)}
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[13px] text-foreground/85">{preview(m)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
