"use client";
import React, { useState, useMemo, useEffect } from "react";
import { EmojiPicker } from "frimousse";
import { Smiley, MagnifyingGlass, Sticker } from "@phosphor-icons/react/dist/ssr";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useEmojis } from "@/components/emoji-provider";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void;
    triggerClassName?: string;
    triggerSize?: "default" | "sm" | "lg" | "icon";
}

type TabType = "custom" | "default";

const INITIAL_EMOJI_PAGE = 160;
const EMOJI_PAGE_STEP = 240;

export function EmojiPickerComponent({ onEmojiSelect, triggerClassName, triggerSize }: EmojiPickerProps) {
    const [open, setOpen] = useState(false);
    const { customEmojis, isLoading } = useEmojis();
    const [searchQuery, setSearchQuery] = useState("");
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState<TabType>("custom");

    const groupedCustomEmojis = useMemo(() => {
        const filtered = searchQuery 
            ? customEmojis.filter(e => e.shortcode.toLowerCase().includes(searchQuery.toLowerCase()))
            : customEmojis;

        const groups: Record<string, typeof customEmojis> = {};
        filtered.forEach((emoji) => {
            if (!groups[emoji.category]) {
                groups[emoji.category] = [];
            }
            groups[emoji.category].push(emoji);
        });
        return groups;
    }, [customEmojis, searchQuery]);

    const handleEmojiClick = (emoji: string) => {
        onEmojiSelect(emoji);
        setOpen(false);
    };

    const isSearching = searchQuery.length > 0;

    // The custom set is unbounded, so the grid is rendered in pages rather than
    // mounting every emoji (and its <img>) the moment the popover opens.
    const [visibleLimit, setVisibleLimit] = useState(INITIAL_EMOJI_PAGE);

    useEffect(() => {
        setVisibleLimit(INITIAL_EMOJI_PAGE);
    }, [searchQuery, activeTab]);

    const visibleGroups = useMemo(() => {
        if (visibleLimit >= Number.MAX_SAFE_INTEGER) return groupedCustomEmojis;

        const limited: Record<string, typeof customEmojis> = {};
        let remaining = visibleLimit;
        for (const [category, emojis] of Object.entries(groupedCustomEmojis)) {
            if (remaining <= 0) break;
            limited[category] = emojis.slice(0, remaining);
            remaining -= limited[category].length;
        }
        return limited;
    }, [groupedCustomEmojis, visibleLimit]);

    const totalVisible = Object.values(visibleGroups).reduce((n, list) => n + list.length, 0);
    const totalMatching = Object.values(groupedCustomEmojis).reduce((n, list) => n + list.length, 0);
    const hasMore = totalVisible < totalMatching;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size={triggerSize ?? "icon"}
                    className={triggerClassName ?? "h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 flex items-center justify-center"}
                    aria-label="Pilih emoji"
                >
                    <Smiley className="h-[18px] w-[18px]" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align={isMobile ? "center" : "start"}
                sideOffset={8}
                collisionPadding={12}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                    "p-0 shadow-lg overflow-hidden rounded-lg bg-popover",
                    isMobile ? "w-[calc(100vw-32px)] max-w-[360px]" : "w-[320px]"
                )}
            >
                <div className="relative mx-3 mt-3 mb-2">
                    <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        className="w-full h-8 pl-8 pr-3 text-[13px] bg-muted/50 border border-transparent rounded-md placeholder:text-muted-foreground focus:outline-none focus:border-ring/50 focus:bg-background transition-colors"
                        autoFocus={!isMobile}
                        placeholder="Cari emoji atau stiker"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {!isSearching && (
                    <div className="flex mx-3 mb-1 p-0.5 gap-0.5 rounded-md bg-muted/60">
                        <button
                            onClick={() => setActiveTab("custom")}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 h-6 text-xs font-medium rounded transition-colors",
                                activeTab === "custom"
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Sticker className="h-3.5 w-3.5" />
                            Stiker & kustom
                        </button>
                        <button
                            onClick={() => setActiveTab("default")}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 h-6 text-xs font-medium rounded transition-colors",
                                activeTab === "default"
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Smiley className="h-3.5 w-3.5" />
                            Emoji
                        </button>
                    </div>
                )}

                <div className="flex flex-col h-[340px]">
                    {(activeTab === "custom" || isSearching) && Object.keys(groupedCustomEmojis).length > 0 && (
                        <div className={cn(
                            "overflow-y-auto px-2 pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
                            isSearching ? "max-h-[140px] border-b border-border/40" : "h-full"
                        )}>
                            {isLoading && customEmojis.length === 0 ? (
                                 <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground/60">
                                    <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                                    <span className="text-[11px] font-medium">Memuat custom emoji...</span>
                                 </div>
                            ) : (
                                Object.entries(visibleGroups).map(([category, emojis]) => (
                                    <div key={category} className="mb-2">
                                        <div className="px-1.5 pt-2 pb-1 text-[11px] font-medium text-muted-foreground sticky top-0 bg-popover z-20">
                                            {category}
                                        </div>
                                        <div className="grid grid-cols-7 gap-0.5">
                                            {emojis.map((emoji) => (
                                                <button
                                                    key={emoji.shortcode}
                                                    onClick={() => handleEmojiClick(`:${emoji.shortcode}:`)}
                                                    title={emoji.shortcode}
                                                    className="flex items-center justify-center aspect-square w-full rounded-md hover:bg-muted active:bg-muted-foreground/15 transition-colors cursor-pointer"
                                                >
                                                    <img
                                                        src={emoji.url}
                                                        alt={emoji.shortcode}
                                                        loading="lazy"
                                                        className="w-7 h-7 object-contain"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                            {hasMore && (
                                <div className="flex justify-center py-2">
                                    <button
                                        type="button"
                                        onClick={() => setVisibleLimit((n) => n + EMOJI_PAGE_STEP)}
                                        className="rounded-md px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    >
                                        Muat lebih banyak ({totalMatching - totalVisible} lagi)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {(activeTab === "default" || isSearching) && (
                        <div className="flex-1 min-h-0">
                            <EmojiPicker.Root
                                onEmojiSelect={({ emoji }) => {
                                    handleEmojiClick(emoji);
                                }}
                                columns={8}
                            >
                                <EmojiPicker.Viewport 
                                    className={cn(
                                        "overflow-y-auto pb-2 px-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
                                        isSearching ? "h-[200px]" : "h-[340px]"
                                    )}
                                >
                                    <EmojiPicker.Loading className="flex flex-col items-center justify-center py-10 gap-2 text-sm text-muted-foreground/60">
                                        <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                                        <span className="text-xs">Memuat emoji…</span>
                                    </EmojiPicker.Loading>

                                    <EmojiPicker.Empty className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground/50 p-6 text-center">
                                        {Object.keys(groupedCustomEmojis).length === 0 && (
                                            <>
                                                <MagnifyingGlass className="h-6 w-6 opacity-50" />
                                                <p className="text-xs leading-relaxed">
                                                    Tidak ada emoji yang cocok.
                                                </p>
                                            </>
                                        )}
                                    </EmojiPicker.Empty>

                                    <EmojiPicker.List
                                        className="select-none"
                                        components={{
                                            CategoryHeader: ({ category, ...props }) => (
                                                <div
                                                    {...props}
                                                    className="px-1.5 pt-2 pb-1 text-[11px] font-medium text-muted-foreground bg-popover sticky top-0 z-20"
                                                >
                                                    {category.label}
                                                </div>
                                            ),
                                            Emoji: ({ emoji, ...props }) => (
                                                <button
                                                    {...props}
                                                    title={emoji.label}
                                                    className="flex items-center justify-center h-9 w-9 rounded-md text-[22px] leading-none hover:bg-muted data-[active]:bg-muted transition-colors cursor-pointer"
                                                >
                                                    {emoji.emoji}
                                                </button>
                                            ),
                                        }}
                                    />
                                </EmojiPicker.Viewport>
                            </EmojiPicker.Root>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
