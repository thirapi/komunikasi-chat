"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { debounce } from "@/lib/debounce";
import { MagnifyingGlass, CircleNotch, Check } from "@phosphor-icons/react/dist/ssr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { searchInvitableUsers, inviteToChannel } from "../room.action";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomName: string;
  currentUserId: string;
}

type UserResult = { id: string; username: string; avatar: string };

export function InviteMemberDialog({
  open,
  onOpenChange,
  roomId,
  roomName,
  currentUserId,
}: InviteMemberDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [invitingIds, setInvitingIds] = useState<Set<string>>(new Set());
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const searchRequestRef = useRef(0);

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    // Guard against out-of-order responses: only the newest query may write.
    const requestId = ++searchRequestRef.current;
    setIsSearching(true);
    try {
      const response = await searchInvitableUsers(roomId, trimmed);
      if (requestId !== searchRequestRef.current) return;
      if (response.status === "success") {
        setResults(response.data ?? []);
      }
    } finally {
      if (requestId === searchRequestRef.current) setIsSearching(false);
    }
  }, [roomId]);

  // One server round-trip per pause in typing instead of one per keystroke.
  const debouncedRunSearch = useMemo(
    () => debounce(runSearch, 300),
    [runSearch],
  );

  useEffect(() => () => debouncedRunSearch.cancel(), [debouncedRunSearch]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    debouncedRunSearch(value);
  }, [debouncedRunSearch]);

  const handleInvite = async (user: UserResult) => {
    setInvitingIds((prev) => new Set(prev).add(user.id));
    try {
      const response = await inviteToChannel(roomId, currentUserId, user.id);
      if (response.status === "success") {
        setInvitedIds((prev) => new Set(prev).add(user.id));
        toast.success(`${user.username} berhasil diundang ke #${roomName}`);
        router.refresh();
      } else {
        toast.error(response.error?.message ?? "Gagal mengundang anggota");
      }
    } finally {
      setInvitingIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setQuery("");
      setResults([]);
      setInvitedIds(new Set());
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Undang anggota</DialogTitle>
          <DialogDescription>
            Tambahkan orang ke{" "}
            <span className="font-medium text-foreground">#{roomName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari username"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
          {isSearching && (
            <CircleNotch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results */}
        <div className="-mx-2 min-h-[140px] max-h-[240px] overflow-y-auto">
          {query.length < 2 && (
            <p className="flex h-[140px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
              Ketik minimal dua huruf untuk mencari.
            </p>
          )}

          {!isSearching && query.length >= 2 && results.length === 0 && (
            <p className="flex h-[140px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
              Tidak ada pengguna yang cocok.
            </p>
          )}

          {results.map((user) => {
            const isInvited = invitedIds.has(user.id);
            const isInviting = invitingIds.has(user.id);

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
              >
                <UserAvatar 
                  src={user.avatar} 
                  alt={user.username}
                  className="h-8 w-8 rounded-full"
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">@{user.username}</p>
                </div>

                {isInvited ? (
                  <span className="inline-flex h-8 items-center gap-1 px-2 text-xs text-muted-foreground shrink-0">
                    <Check weight="bold" className="w-3.5 h-3.5 text-primary" />
                    Diundang
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs shrink-0"
                    onClick={() => handleInvite(user)}
                    disabled={isInviting}
                  >
                    {isInviting ? <CircleNotch className="w-3.5 h-3.5 animate-spin" /> : "Undang"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Invitation Link Section */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex flex-col gap-0.5">
            <h4 className="text-sm font-medium text-foreground">Tautan undangan</h4>
            <p className="text-xs text-muted-foreground">Siapa pun yang punya tautan ini bisa bergabung.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${roomId}`}
              className="flex-1 bg-muted/40 text-xs font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-9"
              onClick={() => {
                const link = `${window.location.origin}/join/${roomId}`;
                navigator.clipboard.writeText(link);
                toast.success("Tautan disalin");
              }}
            >
              Salin
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
