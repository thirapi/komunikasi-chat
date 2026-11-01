"use client"
import { Moon, Sun } from "@phosphor-icons/react/dist/ssr"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  // resolvedTheme is unknown on the server, so the label is only derived from
  // it after mount; otherwise server and client disagree (hydration mismatch).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // resolvedTheme is the theme actually applied, so "system" toggles to the
  // opposite of what the user is looking at rather than to "dark" every time.
  const isDark = resolvedTheme === "dark"
  const label = !mounted ? "Ganti tema" : isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {/*
        Both icons are always rendered and swapped with `dark:`, so the button
        is correct on the very first paint. Reading resolvedTheme to decide
        which one to render would produce a different tree on the server than
        on the client and log a hydration mismatch.
      */}
      <Sun
        aria-hidden
        className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0"
      />
      <Moon
        aria-hidden
        className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100"
      />
    </Button>
  )
}
