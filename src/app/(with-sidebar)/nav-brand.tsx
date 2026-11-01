"use client";

import * as React from "react";
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import Link from "next/link";

type Brand = {
  name: string;
  /** BrandLogo, or any component taking a numeric `size` prop. */
  logo: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
};

export function NavBrand({ brand }: { brand: Brand }) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarMenu>
      <SidebarMenuItem
        className={`flex items-center ${
          isCollapsed ? "justify-center" : "justify-between"
        }`}
      >
        {isCollapsed ? (
          <div className="relative group flex items-center justify-center size-10">
            <Link
              href="/channels/default"
              className="flex items-center justify-center rounded-lg p-1.5 hover:bg-sidebar-accent/60 transition-colors"
              title="Komunikasi"
            >
              <brand.logo size={26} />
            </Link>
          </div>
        ) : (
          <Link href="/channels/default" className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl group transition-all duration-150 hover:bg-sidebar-accent/50">
              <div className="flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                <brand.logo size={28} />
              </div>

              <div className="flex flex-col min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[15px] tracking-tight text-foreground group-hover:text-primary transition-colors leading-tight truncate">
                    komunikasi
                  </span>
                  <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.2 rounded-full bg-primary/10 text-primary shrink-0">
                    chat
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground/75 font-normal leading-tight truncate mt-0.5">
                  {brand.description || "webchat sederhana"}
                </span>
              </div>
            </div>
          </Link>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

