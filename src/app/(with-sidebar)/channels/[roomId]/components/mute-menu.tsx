"use client";

import { Bell, BellSlash } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUnread } from "@/components/unread-provider";
import { setRoomMuteAction } from "../room.action";

type Duration = "1h" | "8h" | "1w" | "forever";

const OPTIONS: { value: Duration; label: string }[] = [
  { value: "1h", label: "1 jam" },
  { value: "8h", label: "8 jam" },
  { value: "1w", label: "1 minggu" },
  { value: "forever", label: "Sampai dinyalakan lagi" },
];

const HOUR = 60 * 60 * 1000;
const untilFor = (d: Duration) =>
  d === "1h" ? Date.now() + HOUR : d === "8h" ? Date.now() + 8 * HOUR : d === "1w" ? Date.now() + 168 * HOUR : new Date("9999-12-31T00:00:00.000Z").getTime();

function describeUntil(until: number) {
  if (until > Date.now() + 365 * 24 * HOUR) return "Dibisukan";
  const time = new Date(until);
  const sameDay = time.toDateString() === new Date().toDateString();
  return `Dibisukan sampai ${time.toLocaleString("id-ID", sameDay ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Mute this room's notifications. Applied locally first (optimistic) and
 * rolled back if the server refuses; other tabs follow via room-mute-changed.
 */
export function MuteMenu({ roomId }: { roomId: string }) {
  const { mutedRooms, setMuted } = useUnread();
  const until = mutedRooms[roomId] ?? 0;
  const muted = until > Date.now();

  const apply = async (duration: Duration | "off") => {
    const previous = muted ? new Date(until) : null;
    setMuted(roomId, duration === "off" ? null : new Date(untilFor(duration)));
    const res = await setRoomMuteAction(roomId, duration);
    if (res.status !== "success") {
      setMuted(roomId, previous);
      toast.error(res.error?.message || "Gagal mengubah notifikasi");
      return;
    }
    setMuted(roomId, res.data?.mutedUntil ?? null);
    toast(duration === "off" ? "Notifikasi dinyalakan" : "Notifikasi dibisukan", {
      description: duration === "off" ? undefined : "Sebutan untukmu tetap memberi notifikasi.",
      duration: 2500,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={muted ? "Notifikasi dibisukan" : "Bisukan notifikasi"}
          title={muted ? describeUntil(until) : "Bisukan notifikasi"}
          className={cn(
            "h-8 w-8 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground flex-shrink-0",
            muted && "text-foreground",
          )}
        >
          {muted ? <BellSlash className="h-[18px] w-[18px]" /> : <Bell className="h-[18px] w-[18px]" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {muted ? (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{describeUntil(until)}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => apply("off")}>
              <Bell className="mr-2 h-4 w-4" />
              Bunyikan lagi
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Ubah durasi</DropdownMenuLabel>
          </>
        ) : (
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Bisukan notifikasi selama</DropdownMenuLabel>
        )}
        {OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => apply(o.value)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
