import React, { useState, useEffect } from "react";
import { ChatTeardropText, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getPublicProfileAction } from "@/app/(with-sidebar)/user.action";

interface ProfileData {
  id: string;
  username: string;
  name?: string | null;
  avatar: string;
  banner?: string | null;
  bio?: string | null;
  customStatus?: string | null;
}

interface ProfileHoverCardProps {
  user: ProfileData;
  isOnline?: boolean;
  currentUserId: string;
  onStartDM: (userId: string) => void;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

export function ProfileHoverCard({
  user,
  isOnline,
  currentUserId,
  onStartDM,
  children,
  side = "right",
}: ProfileHoverCardProps) {
  const [profile, setProfile] = useState<ProfileData>(user);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchFullProfile = async () => {
    if (hasFetched || isLoading) return;
    setIsLoading(true);
    try {
      const response = await getPublicProfileAction(user.username);
      if (response.status === "success" && response.data) {
        setProfile((prev) => ({ ...prev, ...response.data }));
      }
    } catch (e) {
      console.error("Failed to fetch full profile", e);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  };

  const displayName = profile.name || profile.username;
  const hasImageBanner =
    !!profile.banner && (profile.banner.startsWith("http") || profile.banner.startsWith("/"));

  const ProfileContent = (
    <div className="flex flex-col w-full">
      <div
        className="h-16 w-full shrink-0 bg-muted"
        style={
          profile.banner
            ? { background: hasImageBanner ? `url(${profile.banner}) center/cover no-repeat` : profile.banner }
            : undefined
        }
      />

      <div className="relative px-4 pb-4">
        <div className="-mt-9 mb-2 flex items-end justify-between">
          <div className="relative">
            <UserAvatar
              src={profile.avatar || "/avatars/avatar1.png"}
              className="h-[72px] w-[72px] rounded-full ring-4 ring-popover"
            />
            <span
              className={cn(
                "absolute bottom-1 right-1 h-4 w-4 rounded-full ring-[3px] ring-popover",
                isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
              )}
              aria-label={isOnline ? "Online" : "Offline"}
            />
          </div>
          {isLoading && (
            <CircleNotch className="mb-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        <h3 className="text-base font-semibold leading-tight text-foreground truncate">{displayName}</h3>
        <p className="text-[13px] text-muted-foreground truncate">
          @{profile.username}
          <span className="mx-1.5 text-muted-foreground/50">·</span>
          <span className={isOnline ? "text-emerald-600 dark:text-emerald-400" : undefined}>
            {isOnline ? "Online" : "Offline"}
          </span>
        </p>

        {profile.customStatus && (
          <p className="mt-2 text-[13px] text-foreground/90 rounded-md bg-muted/60 px-2.5 py-1.5 break-words">
            {profile.customStatus}
          </p>
        )}

        {profile.bio && (
          <div className="mt-3">
            <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Tentang</p>
            <p className="text-[13px] leading-snug text-foreground/90 whitespace-pre-line line-clamp-4 break-words">
              {profile.bio}
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {profile.id !== currentUserId && (
            <Button
              size="sm"
              className="flex-1 h-8 gap-1.5 text-xs"
              onClick={() => onStartDM(profile.id)}
            >
              <ChatTeardropText className="h-3.5 w-3.5" />
              Kirim pesan
            </Button>
          )}
          <Button variant="outline" size="sm" asChild className="flex-1 h-8 text-xs">
            <Link href={`/profile/${profile.username}`}>Lihat profil</Link>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: Popover */}
      <span className="hidden md:inline-block">
        <Popover onOpenChange={(open) => open && fetchFullProfile()}>
          <PopoverTrigger asChild>{children}</PopoverTrigger>
          <PopoverContent className="w-72 p-0 overflow-hidden rounded-lg shadow-lg" side={side} align="start" sideOffset={8} collisionPadding={12}>
            {ProfileContent}
          </PopoverContent>
        </Popover>
      </span><span className="inline-block md:hidden">
        <Dialog onOpenChange={(open) => open && fetchFullProfile()}>
          <DialogTrigger asChild>{children}</DialogTrigger>
          <DialogContent className="p-0 w-[90vw] max-w-xs overflow-hidden gap-0 bg-popover [&>button]:hidden">
            <DialogTitle className="sr-only">Profil {profile.username}</DialogTitle>
            {ProfileContent}
          </DialogContent>
        </Dialog>
      </span>
    </>
  );
}
