"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { usePresence } from "@/components/presence-provider";
import { ChatText, LinkSimple, CalendarBlank, CircleNotch, CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { createRoom } from "../../channels/[roomId]/room.action";
import { getPublicProfileAction } from "../../user.action";
import { toast } from "sonner";
import { UserSettingsDialog } from "../../user-settings-dialog";
import { SharedMediaGrid } from "@/components/shared-media-grid";
import { cn } from "@/lib/utils";

interface ProfileViewProps {
    user: {
        id: string;
        username: string;
        displayName?: string;
        avatar: string;
        bio?: string | null;
        banner?: string | null;
        customStatus?: string | null;
        roles: { id: string; name: string }[];
        createdAt: string | Date;
        isOwnProfile?: boolean;
    };
    currentUser: {
        id: string;
        name: string;
        username: string;
        initial: string;
        role: string;
        email: string;
        avatar: string;
        bio?: string | null;
        banner?: string | null;
        customStatus?: string | null;
    } | null;
}

export default function ProfileView({ user: initialUser, currentUser }: ProfileViewProps) {
    const { onlineUserIds } = usePresence();
    const router = useRouter();
    const [isRedirecting, setIsRedirecting] = React.useState(false);

    const { data: user } = useQuery({
        queryKey: ["profile", initialUser.username],
        queryFn: () => getPublicProfileAction(initialUser.username, currentUser?.id).then(r => r.data ?? initialUser),
        initialData: initialUser,
        staleTime: 60_000,
    });

    const isOwnProfile = currentUser?.id === user.id;
    const isUserOnline = onlineUserIds.includes(user.id);

    const handleStartDM = async () => {
        if (!currentUser) {
            toast.error("Anda harus login untuk mengirim pesan");
            return;
        }
        setIsRedirecting(true);
        try {
            const response = await createRoom(currentUser.id, user.id);
            if (response.status === "success" && response.data) {
                router.push(`/channels/${response.data.id}`);
            } else {
                toast.error(response.error?.message || "Gagal membuat percakapan");
            }
        } finally {
            setIsRedirecting(false);
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Tautan profil disalin");
    };

    const formattedJoinDate = useMemo(() => {
        try {
            const date = new Date(user.createdAt);
            if (isNaN(date.getTime())) return "";
            return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
        } catch {
            return "";
        }
    }, [user.createdAt]);

    const displayName = user.displayName || user.username;
    const handle = user.username.toLowerCase();

    return (
        <div className="h-full overflow-y-auto bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
            <header className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-border bg-background px-2 md:px-6">
                {/* Someone else's profile is reached from a chat; give a way back. */}
                {!isOwnProfile && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={() => (window.history.length > 1 ? router.back() : router.push("/channels"))}
                        aria-label="Kembali"
                    >
                        <CaretLeft className="h-5 w-5" />
                    </Button>
                )}
                <h1 className={cn("text-[15px] font-semibold tracking-tight", isOwnProfile && "px-2 md:px-0")}>Profil</h1>
            </header>

            <div className="mx-auto max-w-2xl">
                {user.banner && (
                    <div
                        className="mx-4 mt-4 h-28 rounded-lg bg-muted md:mx-6 md:h-36"
                        style={{
                            background: (user.banner.startsWith("http") || user.banner.startsWith("/"))
                                ? `url(${user.banner}) center/cover no-repeat`
                                : user.banner,
                        }}
                    />
                )}

                <section className="px-4 pb-6 md:px-6">
                    <div className={cn("flex items-end justify-between gap-4", user.banner ? "-mt-10 pl-3" : "pt-6")}>
                        <div className="relative shrink-0">
                            <UserAvatar
                                src={user.avatar}
                                alt={displayName}
                                className={cn("size-20 rounded-full md:size-24", user.banner && "ring-4 ring-background")}
                            />
                            {isUserOnline && (
                                <span
                                    className="absolute bottom-1 right-1 size-3.5 rounded-full bg-emerald-500 ring-[3px] ring-background"
                                    aria-label="Online"
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleCopyLink}
                                className="size-9"
                                title="Salin tautan profil"
                                aria-label="Salin tautan profil"
                            >
                                <LinkSimple className="size-4" />
                            </Button>
                            {isOwnProfile ? (
                                <UserSettingsDialog
                                    user={currentUser as any}
                                    trigger={
                                        <Button variant="outline" className="h-9">
                                            Edit profil
                                        </Button>
                                    }
                                />
                            ) : currentUser ? (
                                <Button onClick={handleStartDM} disabled={isRedirecting} className="h-9">
                                    {isRedirecting ? <CircleNotch className="size-4 animate-spin" /> : <ChatText className="size-4" />}
                                    Kirim pesan
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-4">
                        <h2 className="text-xl font-semibold tracking-tight">{displayName}</h2>
                        <p className="text-sm text-muted-foreground">
                            @{handle}
                            {isUserOnline && <span className="text-emerald-600 dark:text-emerald-500"> · online</span>}
                        </p>
                    </div>

                    {user.customStatus && (
                        <p className="mt-3 text-sm text-foreground/80">{user.customStatus}</p>
                    )}

                    {user.bio && (
                        <p className="mt-3 max-w-prose whitespace-pre-wrap text-sm leading-relaxed">{user.bio}</p>
                    )}

                    {formattedJoinDate && (
                        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarBlank className="size-3.5" />
                            Bergabung {formattedJoinDate}
                        </p>
                    )}
                </section>

                {currentUser && (
                    <div className="border-t border-border pt-5">
                        <SharedMediaGrid currentUserId={currentUser.id} profileUsername={user.username} />
                    </div>
                )}
            </div>
        </div>
    );
}
