"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { MagnifyingGlass, X, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { searchMessagesAction } from "@/app/(with-sidebar)/channels/[roomId]/messages.action";
import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Kbd, Shortcut } from "@/components/ui/kbd";
import { stripMarkdown } from "@/lib/strip-markdown";
import { clientChatCache } from "@/lib/infrastructure/cache/client-cache";
import { cn } from "@/lib/utils";
import { format } from "date-fns/format";
import { id } from "date-fns/locale/id";

interface MessageSearchProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  roomId?: string; // Optional for global search
  onSelectMessage: (messageId: string, roomId?: string) => void;
}

/**
 * Spotlight-style message search. Global (Ctrl/⌘+K, owned by the sidebar) when
 * no roomId is given; scoped to one room (Ctrl/⌘+F, owned by the chat room)
 * otherwise. Fully keyboard driven: type, ↑/↓ to move, Enter to open.
 */
export function MessageSearch({ isOpen, onOpenChange, roomId, onSelectMessage }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessageWithUserDTO[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const requestRef = useRef(0);

  const scopeName = roomId ? clientChatCache.getRoomSync(roomId)?.name : null;

  const handleSearch = useCallback(async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchedFor("");
      return;
    }
    const req = ++requestRef.current;
    setIsSearching(true);
    try {
      const response = await searchMessagesAction(q, roomId);
      // Ignore responses for queries the user has already typed past.
      if (req !== requestRef.current) return;
      setResults(response.status === "success" && response.data ? response.data : []);
      setSearchedFor(q);
      setActive(0);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      if (req === requestRef.current) setIsSearching(false);
    }
  }, [roomId]);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  // Start fresh each time it opens.
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSearchedFor("");
      setActive(0);
    }
  }, [isOpen]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const handleSelect = (message: MessageWithUserDTO) => {
    onSelectMessage(message.id, message.roomId);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(results[active]);
    }
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.split(new RegExp(`(${escaped})`, "gi")).map((part, i) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <mark key={i} className="rounded-[3px] bg-amber-400/30 px-px text-foreground dark:bg-amber-300/25">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const roomLabel = (message: MessageWithUserDTO) => {
    if (roomId) return null;
    const room = clientChatCache.getRoomSync(message.roomId);
    if (!room) return null;
    return room.isDirect ? "Pesan langsung" : `#${room.name}`;
  };

  const showEmpty = !isSearching && searchedFor && results.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12vh] translate-y-0 sm:max-w-xl p-0 gap-0 overflow-hidden max-h-[70vh] flex flex-col [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">{roomId ? "Cari di room ini" : "Cari pesan"}</DialogTitle>
        <DialogDescription className="sr-only">Ketik minimal dua huruf untuk mencari pesan.</DialogDescription>

        <div className="flex items-center gap-2.5 border-b border-border px-4 h-12 shrink-0">
          {isSearching ? (
            <CircleNotch className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <MagnifyingGlass className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            placeholder={roomId ? `Cari di ${scopeName ? `#${scopeName}` : "room ini"}` : "Cari di semua pesan"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            autoFocus
            aria-controls="message-search-results"
            aria-activedescendant={results[active] ? `search-result-${results[active].id}` : undefined}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Hapus kata kunci"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Kbd>Esc</Kbd>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {results.length > 0 ? (
            <ul id="message-search-results" ref={listRef} role="listbox" className="p-1.5">
              {results.map((message, index) => {
                const label = roomLabel(message);
                return (
                  <li key={message.id} role="option" aria-selected={index === active} id={`search-result-${message.id}`} data-index={index}>
                    <button
                      type="button"
                      onClick={() => handleSelect(message)}
                      onMouseMove={() => setActive(index)}
                      className={cn(
                        "w-full text-left flex gap-3 rounded-md px-2.5 py-2",
                        index === active ? "bg-muted" : "",
                      )}
                    >
                      <UserAvatar
                        src={message.user.avatar || "/avatars/avatar1.png"}
                        alt={message.user.username}
                        className="h-8 w-8 shrink-0 rounded-full mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="text-[13px] font-semibold truncate">
                            {message.user.name || message.user.username}
                          </span>
                          {label && <span className="text-xs text-muted-foreground truncate">{label}</span>}
                          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
                            {format(new Date(message.createdAt), "d MMM, HH:mm", { locale: id })}
                          </span>
                        </div>
                        <p className="text-[13px] text-foreground/80 line-clamp-2 break-words">
                          {highlightText(stripMarkdown(message.content) || "Lampiran", searchedFor)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : showEmpty ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-foreground">Tidak ada pesan yang cocok dengan “{searchedFor}”</p>
              <p className="mt-1 text-xs text-muted-foreground">Coba kata kunci lain yang lebih pendek.</p>
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {roomId
                ? "Ketik untuk mencari pesan di room ini."
                : "Ketik untuk mencari di semua channel dan obrolan pribadi."}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border bg-muted/30 px-4 h-9 shrink-0 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><Shortcut keys={["up", "down"]} /> pilih</span>
          <span className="flex items-center gap-1.5"><Shortcut keys={["enter"]} /> buka</span>
          <span className="ml-auto hidden sm:flex items-center gap-1.5">
            {roomId ? <>Cari semua pesan <Shortcut keys={["mod", "k"]} /></> : <>Cari di room <Shortcut keys={["mod", "f"]} /></>}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
