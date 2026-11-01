"use client";

import { Bell, CaretUpDown, CreditCard, SealCheck, SignOut, Sparkle, UserCircle, X } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { clientChatCache } from "@/lib/infrastructure/cache/client-cache";
import { signOutUserAction } from "../auth.action";
import { stopImpersonation } from "../impersonate.action";
import { useIsImpersonating } from "@/hooks/use-impersonation";
import { useRouter } from "next/navigation";
import UserPage from "../admin/(with-sidebar)/log/page";
import { UserSettingsDialog } from "./user-settings-dialog";
import { ModeToggleItem } from "@/components/landingpage/mode-toggle-nav-user";

export function NavUser({
  user,
  checkRole,
  isMobileHeader,
}: {
  user: {
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
  };
  checkRole: {
    id: string;
    username: string;
    roles: {
      id: string;
      name: string;
    }[];
  } | null;
  isMobileHeader?: boolean;
}) {
  const { isMobile } = useSidebar();
  const { isImpersonating, impersonatedUser } = useIsImpersonating();
  const isAdmin = checkRole?.roles.some(
    (role) => role.name.toLowerCase() === "admin"
  );
  const router = useRouter();

  const handleStopImpersonation = async () => {
    await stopImpersonation();
    window.location.reload();
  };

  const handleLogout = async () => {
    await clientChatCache.clearAll();
    await signOutUserAction();
  };

  const handleAdminRedirect = () => {
    router.push("/admin");
  };

  return (
    <SidebarMenu className={cn(isMobileHeader && "w-auto m-0")}>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size={isMobileHeader ? "sm" : "lg"}
              className={cn(
                "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                isMobileHeader && "w-10 h-10 p-0 rounded-full flex items-center justify-center m-0 bg-transparent hover:bg-transparent"
              )}
            >
              <UserAvatar
                src={user.avatar}
                alt={user.name}
                className={cn("h-8 w-8 rounded-lg", isMobileHeader && "h-10 w-10 min-w-10 rounded-full shadow-sm ring-1 ring-border/20 object-cover")}
              />
              {!isMobileHeader && (
                <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    {isImpersonating ? (
                      <span className="truncate font-semibold text-destructive">
                        Impersonasi: @{impersonatedUser?.username}
                      </span>
                    ) : (
                      <span className="truncate font-semibold text-foreground">
                        {user.name}
                      </span>
                    )}
                    <span className="truncate text-xs text-muted-foreground">
                      {isImpersonating ? "Klik untuk stop" : user.role}
                    </span>
                  </div>
                  <CaretUpDown weight="duotone" className="ml-auto size-4 text-muted-foreground" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar
                  src={user.avatar}
                  alt={user.name}
                  className="h-8 w-8 rounded-lg"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  {isImpersonating ? (
                    <span className="truncate font-semibold text-destructive">
                      @{impersonatedUser?.username}
                    </span>
                  ) : (
                    <span className="truncate font-semibold text-foreground">
                      {user.name}
                    </span>
                  )}
                  <span className="truncate text-xs text-muted-foreground">
                    {isImpersonating ? "Impersonasi" : user.role}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <UserSettingsDialog user={user} />
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleAdminRedirect}>
                    <SealCheck />
                    Admin
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            )}
            <DropdownMenuItem asChild>
              <ModeToggleItem />
            </DropdownMenuItem>
            {isImpersonating && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleStopImpersonation} className="text-destructive focus:text-destructive">
                  <X weight="duotone" />
                  Stop Impersonasi
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <SignOut weight="duotone" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
