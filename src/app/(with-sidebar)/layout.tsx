"use server";

import { AppSidebar } from "@/app/(with-sidebar)/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  getUserSession,
  getUserWithRolesFromSession,
  sidaBarUserInfo,
} from "@/app/auth.action";
import { RealtimeNotificationListener } from "@/components/realtime-notification-listener";
import { getSidebarData } from "@/app/(with-sidebar)/channels/[roomId]/room.action";
import { PresenceProvider } from "@/components/presence-provider";
import { UnreadProvider } from "@/components/unread-provider";
import { EmojiProvider } from "@/components/emoji-provider";
import { getInitials } from "@/lib/get-initials";
import { MobileStackContent } from "@/app/(with-sidebar)/mobile-stack-content";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getEffectiveUserId } from "@/lib/impersonate.guard";
import { CurrentUserProvider } from "@/components/current-user-provider";

export default async function layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionData = await getUserSession();
  const userId = sessionData?.user?.id;

  // getEffectiveUserId, the profile lookup and the role lookup all depend only
  // on the session, so they run concurrently. Only the sidebar data needs the
  // resolved effective user id, so it stays one level deeper.
  const [effectiveUserId, userInfo, userRoles] = await Promise.all([
    getEffectiveUserId(userId || ""),
    sidaBarUserInfo(),
    getUserWithRolesFromSession(),
  ]);

  const sidebarData = effectiveUserId
    ? await getSidebarData(effectiveUserId)
    : { data: { channels: [], directMessages: [] } };
  const directRooms = sidebarData.data?.directMessages ?? [];
  const groupRooms = sidebarData.data?.channels ?? [];

  const user = userId ? {
    id: userId,
    name: userInfo.name,
    username: userInfo.username,
    initial: getInitials(userInfo.name),
    role: userInfo.role,
    email: userInfo.email,
    avatar: userInfo.avatar,
    bio: userInfo.bio,
    banner: userInfo.banner,
    customStatus: userInfo.customStatus,
  } : null;

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <SidebarProvider>
        <EmojiProvider>
        {user ? (
          <PresenceProvider userId={user.id}>
            <CurrentUserProvider
              user={{ id: user.id, name: user.name, username: user.username, avatar: user.avatar }}
            >
            <UnreadProvider>
              <RealtimeNotificationListener
                user={{ id: user.id, username: user.username }}
              />
              <AppSidebar
                user={user}
                checkRole={userRoles}
                directRooms={directRooms}
                groupRooms={groupRooms}
              />

              <MobileStackContent>
                <SidebarInset className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
                  <main className="flex-1 min-h-0 overflow-hidden w-full">
                    <div className="h-full w-full rounded-xl overflow-hidden">
                      <div className="h-full w-full overflow-y-auto">{children}</div>
                    </div>
                  </main>
                </SidebarInset>
              </MobileStackContent>
            </UnreadProvider>
            </CurrentUserProvider>
          </PresenceProvider>
        ) : (
          <UnreadProvider>
            <AppSidebar
              user={null}
              checkRole={null}
              directRooms={[]}
              groupRooms={[]}
            />
            <SidebarInset className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
              <main className="flex-1 min-h-0 overflow-hidden w-full">
                <div className="h-full w-full rounded-xl overflow-hidden">
                  <div className="h-full w-full overflow-y-auto">{children}</div>
                </div>
              </main>
            </SidebarInset>
          </UnreadProvider>
        )}
        </EmojiProvider>
      </SidebarProvider>
      <MobileBottomNav user={user ? { username: user.username } : null} />
    </div>
  );
}
