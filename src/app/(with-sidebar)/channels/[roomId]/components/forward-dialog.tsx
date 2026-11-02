"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Hash, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { SidebarRoomDTO } from "@/lib/entities/models/room.model";
import { getSidebarData } from "../room.action";
import { forwardMessageAction } from "../messages.action";

const MAX_TARGETS = 5;

/**
 * Pick up to 5 chats to forward a message to (WhatsApp's limit). The list is
 * the user's own chat list, fetched when the dialog opens.
 */
export function ForwardDialog({
  messageId,
  currentUserId,
  onOpenChange,
}: {
  messageId: string | null;
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const open = messageId !== null;
  const [rooms, setRooms] = useState<SidebarRoomDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setQuery("");
    let alive = true;
    getSidebarData(currentUserId).then((res) => {
      if (!alive || res.status !== "success" || !res.data) return;
      const all = [...res.data.directMessages, ...res.data.channels];
      all.sort((a, b) => new Date(b.lastMessageTime ?? 0).getTime() - new Date(a.lastMessageTime ?? 0).getTime());
      setRooms(all);
    });
    return () => {
      alive = false;
    };
  }, [open, currentUserId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rooms ?? []).filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [rooms, query]);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_TARGETS ? prev : [...prev, id],
    );

  const send = async () => {
    if (!messageId || selected.length === 0) return;
    setSending(true);
    const res = await forwardMessageAction(messageId, selected);
    setSending(false);
    if (res.status !== "success" || !res.data) {
      toast.error(res.error?.message || "Gagal meneruskan pesan");
      return;
    }
    const { sent, failed } = res.data;
    if (failed.length === 0) toast.success(sent.length === 1 ? "Pesan diteruskan" : `Diteruskan ke ${sent.length} chat`);
    else toast.warning(`Diteruskan ke ${sent.length} chat, ${failed.length} gagal`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Teruskan pesan</DialogTitle>
          <DialogDescription>Pilih sampai {MAX_TARGETS} chat.</DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-2">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari chat" className="pl-9" autoFocus />
          </div>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto px-2 pb-2" role="listbox" aria-multiselectable>
          {rooms === null && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Memuat…</li>}
          {rooms !== null && visible.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada chat</li>
          )}
          {visible.map((r) => {
            const isSelected = selected.includes(r.id);
            const disabled = !isSelected && selected.length >= MAX_TARGETS;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={disabled}
                  onClick={() => toggle(r.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-40",
                    isSelected && "bg-muted",
                  )}
                >
                  {r.type === "direct" ? (
                    <UserAvatar src={r.avatar} alt={r.name} className="size-9 rounded-full" />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                      <Hash className="size-4 text-muted-foreground" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {isSelected && <Check weight="bold" className="size-3" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <DialogFooter className="border-t px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={send} disabled={selected.length === 0 || sending}>
            {sending ? "Meneruskan…" : selected.length > 1 ? `Teruskan ke ${selected.length} chat` : "Teruskan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
