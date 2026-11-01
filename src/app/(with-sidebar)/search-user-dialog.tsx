"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MagnifyingGlass, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { searchUsersAction } from "./user.action";
import { UserAvatar } from "@/components/ui/user-avatar";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

export function SearchUserDialog({ open, onOpenChange }: SearchUserDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      try {
        const res = await searchUsersAction(debouncedQuery);
        if (res.status === "success") {
          setResults(res.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Cari pengguna</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Username atau handle fediverse"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {isSearching && (
              <CircleNotch className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="border-t border-border min-h-[200px] max-h-[360px] overflow-y-auto">
          {results.length > 0 ? (
            <ul className="p-1.5">
              {results.map((user) => (
                <li key={user.id}>
                  <Link
                    href={user.isRemote ? `/profile/${user.id.startsWith("@") ? user.id : user.handle || `@${user.username}`}` : `/profile/${user.username}`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 rounded-md px-2.5 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none transition-colors"
                  >
                    <UserAvatar src={user.avatar} className="h-8 w-8 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.username}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.isRemote ? (user.handle || "Pengguna fediverse") : `@${user.username.toLowerCase()}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              {isSearching
                ? "Mencari…"
                : query.length >= 2
                  ? "Tidak ada pengguna yang ditemukan."
                  : "Ketik minimal dua huruf untuk mencari."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
