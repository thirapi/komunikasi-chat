"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { createPollAction } from "../messages.action";

const MAX_OPTIONS = 10;

export function PollComposerDialog({
  open,
  onOpenChange,
  roomId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  onCreated: (message: MessageWithUserDTO) => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuestion("");
    setOptions(["", ""]);
    setAllowMultiple(false);
  }, [open]);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const canSend = question.trim().length > 0 && new Set(filled.map((o) => o.toLowerCase())).size >= 2 && !sending;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    const res = await createPollAction(roomId, { question, options, allowMultiple });
    setSending(false);
    if (res.status !== "success" || !res.data) {
      toast.error(res.error?.message || "Gagal membuat polling");
      return;
    }
    onCreated(res.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buat polling</DialogTitle>
          <DialogDescription>Anggota bisa melihat siapa memilih apa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="poll-question">Pertanyaan</label>
            <Input id="poll-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="Makan siang di mana?" autoFocus />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Pilihan</p>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  value={o}
                  maxLength={100}
                  placeholder={`Pilihan ${i + 1}`}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value;
                    // Typing in the last box opens a new one, like WhatsApp.
                    if (i === next.length - 1 && e.target.value && next.length < MAX_OPTIONS) next.push("");
                    setOptions(next);
                  }}
                />
                {options.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label={`Hapus pilihan ${i + 1}`}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && options.every((o) => o.trim()) && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOptions([...options, ""])} className="gap-1.5">
                <Plus className="h-4 w-4" /> Tambah pilihan
              </Button>
            )}
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Boleh pilih lebih dari satu</span>
            <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={!canSend}>{sending ? "Mengirim…" : "Kirim polling"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
