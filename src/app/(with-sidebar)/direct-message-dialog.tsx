"use client";

import { useState, useEffect } from "react";
import { MagnifyingGlass, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { searchUsersAction } from "./user.action";

interface User {
  id: string;
  username: string;
  avatar: string;
}

type CurrentUser = {
  id: string;
  name: string;
  initial: string;
  role: string;
  email: string;
  avatar: string;
};

interface DirectMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (userId: string) => void;
  user: CurrentUser;
}

export function DirectMessageDialog({
  open,
  onOpenChange,
  onSelectUser,
  user,
}: DirectMessageDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const searchUsers = async (query: string): Promise<User[]> => {
    const response = await searchUsersAction(query);
    if (response.status === "success" && response.data) {
      return response.data
        .filter((u) => u.id !== user.id)
        .map((u) => ({
          id: u.id,
          username: u.username,
          avatar: u.avatar,
        }));
    }
    return [];
  };

  // Handle search with debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setUsers([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchUsers(searchQuery);
        setUsers(results);
      } catch (error) {
        console.error("Error searching users:", error);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setUsers([]);
      setIsLoading(false);
    }
  }, [open]);

  const handleUserSelect = (userId: string) => {
    onSelectUser(userId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Pesan baru</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau username"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
            {isLoading && (
              <CircleNotch className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="border-t border-border min-h-[200px] max-h-[360px] overflow-y-auto">
          {users.length > 0 ? (
            <ul className="p-1.5">
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none transition-colors"
                    onClick={() => handleUserSelect(user.id)}
                  >
                    <UserAvatar src={user.avatar} alt={user.username} className="h-8 w-8 rounded-full" />
                    <span className="text-sm font-medium truncate">@{user.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              {isLoading
                ? "Mencari…"
                : searchQuery
                  ? "Tidak ada pengguna yang cocok."
                  : "Ketik untuk mencari orang yang ingin kamu ajak bicara."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
