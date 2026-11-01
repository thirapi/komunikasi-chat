"use client";

import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Plus, User, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { usePresence } from "@/components/presence-provider";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { DirectMessageDialog } from "./direct-message-dialog";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCustomEmojis } from "@/components/emoji-provider";
import { stripMarkdown } from "@/lib/strip-markdown";

type Groups = {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  url: string;
  icon: React.ElementType;
  hasUnread: boolean;
  hasMention: boolean;
  lastMessage?: string;
  lastMessageTime?: Date;
};

type User = {
  id: string;
  name: string;
  initial: string;
  role: string;
  email: string;
  avatar: string;
};

export function NavMainDirectMessage({
  groups,
  type,
  user,
  onCreateDirectMessage,
  openDMDialog: openDMDialogProp,
  onOpenDMDialogChange: setOpenDMDialogProp,
}: {
  groups: Groups[];
  type: string;
  user: User;
  onCreateDirectMessage: (userId: string) => Promise<void>;
  openDMDialog?: boolean;
  onOpenDMDialogChange?: (open: boolean) => void;
}) {
  const [internalOpenDMDialog, setInternalOpenDMDialog] = useState(false);
  const openDMDialog = openDMDialogProp ?? internalOpenDMDialog;
  const setOpenDMDialog = setOpenDMDialogProp ?? setInternalOpenDMDialog;
  const [isOpen, setIsOpen] = useState(true);

  const router = useRouter();
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const customEmojis = useCustomEmojis();
  const { onlineUserIds } = usePresence();
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
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (dayDiff === 1) {
      return "Kemarin";
    } else if (dayDiff < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    } else {
      return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }
  };

  return (
    <>
      <SidebarGroup className="p-0">
        {/* Desktop Section Header with Collapsible Toggle and Action */}
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
                <User weight="bold" className="size-3 text-primary" />
                {type}
                <span className="text-[10px] font-medium text-muted-foreground/60">
                  ({groups.length})
                </span>
              </span>
            </button>

            <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors rounded-md"
                      onClick={() => setOpenDMDialog(true)}
                    >
                      <Plus weight="bold" className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Mulai Percakapan</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}

        {/* Menu items rendered when open (always visible on mobile) */}
        {(isMobile || isOpen) && (
          <SidebarMenu className="gap-0.5 px-1">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-3 py-6 text-xs text-muted-foreground/60 text-center">
                <p className="mb-2">Belum ada percakapan langsung</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenDMDialog(true)}
                  className="h-7 text-xs rounded-lg gap-1.5"
                >
                  <Plus weight="bold" className="size-3" />
                  Mulai Percakapan
                </Button>
              </div>
            ) : (
              groups.map((item) => {
                const isActive = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "flex items-center transition-all duration-150 ease-in-out relative group/btn rounded-md px-2",
                        isCollapsed ? "h-10 justify-center" : "h-12",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-accent-foreground",
                      )}
                      tooltip={item.name}
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
                            className="h-8 w-8 rounded-full shrink-0"
                          />
                          {onlineUserIds.includes(item.userId) && (
                            <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
                          )}
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
                                  item.hasUnread ? "text-foreground font-semibold" : "font-medium text-sidebar-foreground/90"
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
      <DirectMessageDialog
        open={openDMDialog}
        onOpenChange={setOpenDMDialog}
        onSelectUser={async (userId) => {
          await onCreateDirectMessage(userId);
          router.refresh();
          setOpenDMDialog(false);
          if (isMobile) setOpenMobile(false);
        }}
        user={user}
      />
    </>
  );
}
