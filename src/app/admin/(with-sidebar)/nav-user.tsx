"use client";

import { SealCheck, Bell, CaretUpDown, CreditCard, SignOut, Sparkle } from "@phosphor-icons/react/dist/ssr";

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
import { signOutUserAction } from "@/app/auth.action";
import { useRouter } from "next/navigation";

export function NavUser({
  user,
  checkRole
}: {
  user: {
    name: string;
    initial: string;
    role: string;
    email: string;
    avatar: string;
  };
  checkRole: {
    id: string;
    username: string;
    roles: {
      id: string;
      name: string;
    }[];
  } | null;
}) {
  const { isMobile } = useSidebar();
  const isAdmin = checkRole?.roles.some((role) => role.name.toLowerCase() === "admin");
  const router = useRouter() ;

  const handleLogout = async () => {
    await clientChatCache.clearAll();
    await signOutUserAction();
  };

  const handleAdminRedirect = () => {
    router.push('/admin');
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar 
                src={user.avatar} 
                alt={user.name}
                className="h-8 w-8 rounded-lg"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-prime">
                  {user.name}
                </span>
                <span className="truncate text-xs dark:text-slate-500">
                  {user.role}
                </span>
              </div>
              <CaretUpDown weight="duotone" className="ml-auto size-4" />
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
                  <span className="truncate font-semibold text-prime">
                    {user.name}
                  </span>
                  <span className="truncate text-xs dark:text-slate-500">
                    {user.role}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
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
