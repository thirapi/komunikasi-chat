"use client";

import { useState, useEffect } from "react";
import { MagnifyingGlass, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getPublicRooms, joinRoom } from "./channels/[roomId]/room.action";
import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ExploreChannelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function ExploreChannelsDialog({
  open,
  onOpenChange,
  userId,
}: ExploreChannelsDialogProps) {
  const [channels, setChannels] = useState<RoomWithParticipantsDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const router = useRouter();

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const response = await getPublicRooms(userId);
      if (response.status === "success" && response.data) {
        setChannels(response.data);
      }
    } catch (error) {
      toast.error("Gagal mengambil daftar channel");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchChannels();
    }
  }, [open]);

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const handleJoin = async (channelId: string) => {
    setIsJoining(channelId);
    try {
      const response = await joinRoom(channelId, userId);
      if (response.status === "success") {
        toast.success("Kamu bergabung ke channel");
        onOpenChange(false);
        router.push(`/channels/${channelId}`);
        router.refresh();
      } else {
        toast.error(response.error?.message ?? "Gagal bergabung");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsJoining(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden flex flex-col max-h-[80vh] p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Jelajahi channel</DialogTitle>
          <DialogDescription>Channel publik yang bisa kamu ikuti.</DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau deskripsi"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 min-h-[220px] overflow-y-auto border-t border-border">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <CircleNotch className="h-4 w-4 animate-spin" />
              Memuat channel…
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-sm text-foreground">
                {searchQuery ? "Tidak ada channel yang cocok" : "Belum ada channel publik"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery ? "Coba kata kunci lain." : "Kamu bisa membuat channel sendiri."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredChannels.map((channel) => (
                <li key={channel.id} className="flex items-center gap-3 px-5 py-3">
                  <UserAvatar
                    src={channel.avatar}
                    alt={channel.name}
                    className="h-10 w-10 rounded-lg shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">#{channel.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {channel.participants.length} anggota
                      {channel.description && <> · {channel.description}</>}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-8"
                    onClick={() => handleJoin(channel.id)}
                    disabled={isJoining !== null}
                  >
                    {isJoining === channel.id ? <CircleNotch className="w-4 h-4 animate-spin" /> : "Gabung"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
