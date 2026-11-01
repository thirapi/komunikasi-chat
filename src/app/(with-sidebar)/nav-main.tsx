"use client";

import { useState } from "react";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useCustomEmojis } from "@/components/emoji-provider";
import { stripMarkdown } from "@/lib/strip-markdown";
import { Button } from "@/components/ui/button";
import { Plus, Compass, Hash, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Groups = {
  id: string;
  name: string;
  url: string;
  avatar: string;
  icon: React.ElementType;
  hasUnread: boolean;
  hasMention: boolean;
  lastMessage?: string;
  lastMessageTime?: Date;
};

export function NavMain({
  groups,
  type,
  onCreate,
  onExplore,
}: {
  groups: Groups[];
  type: string;
  onCreate?: () => void;
  onExplore?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const customEmojis = useCustomEmojis();
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  const renderLastMessage = (text: string) => {
    const stripped = stripMarkdown(text);
    if (!stripped) return null;
    const html = stripped.replace(/:([a-zA-Z0-9_-]+):/g, (match, name) => {
      const emoji = customEmojis.find(e => e.shortcode === name);
      return emoji ? `<img src="${emoji.url}" alt="${match}" class="inline-block h-[1.1em] w-[1.1em] align-text-bottom" />` : match;
    });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const formatTime = (date?: Date) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const dayDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (dayDiff === 1) {
      return "Kemarin";
    } else if (dayDiff < 7) {
      return d.toLocaleDateString([], { weekday: "short" });
    } else {
      return d.toLocaleDateString([], { day: "numeric", month: "short" });
    }
  };

  return (
    <SidebarGroup className="p-0">
      {/* Desktop Section Header with Collapsible Toggle and Actions */}
      {!isMobile && (
        <div className="px-2 py-1.5 flex items-center justify-between group/header">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75 hover:text-foreground transition-colors select-none"
          >
            <CaretDown
              weight="bold"
              className={cn("size-3 transition-transform duration-200", !isOpen && "-rotate-90")}
            />
            <span className="flex items-center gap-1.5">
              <Hash weight="bold" className="size-3 text-primary" />
              {type}
              <span className="text-[10px] font-medium text-muted-foreground/60">
                ({groups.length})
              </span>
            </span>
          </button>

          <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
            <TooltipProvider>
              {onExplore && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors rounded-md"
                      onClick={onExplore}
                    >
                      <Compass weight="duotone" className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Jelajahi Channel</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {onCreate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors rounded-md"
                      onClick={onCreate}
                    >
                      <Plus weight="bold" className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Buat Channel</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>
      )}

      {/* Menu items rendered when open (always visible on mobile) */}
      {(isMobile || isOpen) && (
        <SidebarMenu className="gap-0.5 px-1">
          {groups.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground/60 mb-2">Belum ada channel</p>
              {onCreate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCreate}
                  className="h-7 text-xs rounded-lg gap-1.5"
                >
                  <Plus weight="bold" className="size-3" />
                  Buat Channel
                </Button>
              )}
            </div>
          ) : (
            [...groups].map((item) => {
              const isActive = pathname.startsWith(item.url);

              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.name}
                    isActive={isActive}
                    className={cn(
                      "transition-all duration-150 ease-in-out relative group/btn rounded-md px-2",
                      isCollapsed ? "h-10 justify-center" : "h-12",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Link
                      href={item.url}
                      onClick={() => isMobile && setOpenMobile(false)}
                      className={cn(
                        "flex items-center w-full",
                        isCollapsed ? "justify-center p-0" : "gap-3",
                      )}
                    >
                      <div className="relative shrink-0">
                        <UserAvatar
                          src={item.avatar}
                          alt={item.name}
                          className="h-8 w-8 rounded-lg shrink-0"
                        />
                        {isCollapsed && item.hasUnread && (
                            <span
                              className={cn(
                                "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-sidebar pointer-events-none",
                                item.hasMention ? "bg-rose-500" : "bg-foreground"
                              )}
                            />
                          )}
                      </div>
                      {!isCollapsed && (
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={cn(
                                "truncate text-[13px] leading-tight",
                                item.hasUnread ? "text-foreground font-semibold" : "font-medium text-sidebar-foreground/90",
                              )}
                            >
                              {item.name}
                            </span>
                            {item.lastMessageTime && (
                              <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                                {formatTime(item.lastMessageTime)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 min-w-0">
                              <span
                                className={cn(
                                  "flex-1 text-xs truncate leading-tight",
                                  item.hasUnread ? "text-foreground/90" : "text-muted-foreground"
                                )}
                              >
                                {item.lastMessage ? renderLastMessage(item.lastMessage) : null}
                              </span>
                              {item.hasMention ? (
                                <span className="shrink-0 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold leading-4 text-center" aria-label="Kamu disebut">
                                  @
                                </span>
                              ) : item.hasUnread ? (
                                <span className="shrink-0 h-2 w-2 rounded-full bg-foreground/80" aria-label="Belum dibaca" />
                              ) : null}
                            </div>
                        </div>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })
          )}
        </SidebarMenu>
      )}
    </SidebarGroup>
  );
}
