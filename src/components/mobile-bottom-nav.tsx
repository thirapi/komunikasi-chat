"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { UserIcon, UsersThreeIcon, ChatCircleIcon, GearSixIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

interface MobileBottomNavProps {
  user: { username: string } | null;
}

const tabs = [
  { id: "channels" as const, href: "/channels/default?tab=channels", icon: UsersThreeIcon, label: "Channel" },
  { id: "dms" as const, href: "/channels/default?tab=dms", icon: ChatCircleIcon, label: "Pesan" },
  { id: "settings" as const, href: "/settings", icon: GearSixIcon, label: "Pengaturan" },
];

export function MobileBottomNav({ user }: MobileBottomNavProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isDefaultRoute = pathname === "/channels/default" || pathname === "/channels";
  const isProfile = pathname.startsWith("/profile/");
  const isSettings = pathname.startsWith("/settings");
  const tabFromUrl = searchParams.get("tab");
  const activeTab = isProfile ? "profile" : (isSettings ? "settings" : (tabFromUrl || (isDefaultRoute ? "channels" : "")));

  const isInRoom = !isDefaultRoute && !isProfile && !isSettings;

  if (!isMobile || isInRoom) return null;

  const items = [
    ...tabs,
    {
      id: "profile" as const,
      href: user ? `/profile/${user.username}` : "/",
      icon: UserIcon,
      label: user ? "Profil" : "Masuk",
    },
  ];

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="grid h-14 grid-cols-4">
        {items.map(({ id, href, icon: Icon, label }) => {
          const isActive = activeTab === id;
          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex select-none flex-col items-center justify-center gap-1 transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground active:text-foreground"
              )}
            >
              <Icon className="size-[22px]" weight={isActive ? "fill" : "regular"} />
              <span className={cn("text-[10px] leading-none", isActive && "font-medium")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
