"use client";

import { useState } from "react";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createChannel } from "./channels/[roomId]/room.action";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  userId,
}: CreateChannelDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Nama channel tidak boleh kosong");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createChannel(name, userId, description, isPublic);

      if (response.status === "success" && response.data) {
        toast.success("Channel berhasil dibuat!");
        onOpenChange(false);
        router.push(`/channels/${response.data.id}`);
        router.refresh();
      } else {
        toast.error(response.error?.message ?? "Gagal membuat channel");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog 
        open={open} 
        onOpenChange={(v) => {
            if (!isSubmitting) {
                onOpenChange(v);
                if (!v) {
                    setName("");
                    setDescription("");
                    setIsPublic(false);
                }
            }
        }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat channel</DialogTitle>
          <DialogDescription>
            Channel adalah ruang obrolan untuk satu tim atau topik.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="name" className="text-xs">Nama</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">#</span>
              <Input
                id="name"
                placeholder="pengumuman"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className="pl-7"
                disabled={isSubmitting}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim() && !isSubmitting) handleCreate();
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Huruf kecil, angka, dan tanda hubung.</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="description" className="text-xs">
              Deskripsi <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Untuk apa channel ini?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="resize-none min-h-[80px]"
            />
          </div>

          <label htmlFor="create-channel-public" className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
            <span>
              <span className="block text-sm font-medium">Channel publik</span>
              <span className="block text-xs text-muted-foreground">
                {isPublic
                  ? "Siapa pun bisa menemukan dan bergabung."
                  : "Hanya orang yang diundang yang bisa bergabung."}
              </span>
            </span>
            <Switch
              id="create-channel-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={isSubmitting}
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting || !name.trim()}>
            {isSubmitting && <CircleNotch className="mr-1.5 h-4 w-4 animate-spin" />}
            Buat channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
