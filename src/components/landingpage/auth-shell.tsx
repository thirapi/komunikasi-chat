import Link from "next/link";
import { Suspense } from "react";
import { ModeToggle } from "@/components/landingpage/mode-toggle";
import { AsciiArt } from "@/components/ui/maomao";

/**
 * Split-screen frame for the auth pages (`/`, `/signin`, `/signup`): the
 * "maomao" ASCII art on the left, the form on the right. Below `lg` the art
 * collapses into a band above the form.
 *
 * The art sits in an inset, rounded panel with faint scanlines and a
 * dot-matrix wordmark (Doto) to match the ASCII piece. That wordmark is the
 * only brand on the page: a second logo + name in the form header repeated
 * it, and on mobile the two ended up stacked right on top of each other.
 * The form side stays calm: a faint dot grid and generous type.
 */
export function AuthShell({
  children,
  switchTo,
}: {
  children: React.ReactNode;
  /** The header link to the other auth page, e.g. "Daftar" on login. */
  switchTo: { href: string; label: string; hint?: string };
}) {
  return (
    // shrink-0: <body> is a full-height flex column, so without it this grid
    // was squeezed to exactly the viewport and the form column (overflow
    // hidden) clipped the sign-up form on short phones with no way to scroll.
    // Now it grows with its content and the page scrolls normally.
    <div className="grid min-h-dvh shrink-0 grid-rows-[auto_1fr] lg:grid-cols-[1.15fr_1fr] lg:grid-rows-1">
      {/* The art is portrait and taller than this panel at every size, so it
          pans top → bottom → top instead of being cropped. See .ascii-pan in
          globals.css. fill={false} lets that class size the video by its own
          aspect ratio instead of stretching it to the panel. */}
      {/* Inset, rounded panel: a thin frame of page background around the art
          reads calmer than a hard black block running to the screen edge. */}
      <div className="bg-background p-2 pb-0 sm:p-3 sm:pb-0 lg:p-3 lg:pr-0">
        <div className="ascii-pan-frame relative h-[clamp(9.5rem,30dvh,14rem)] overflow-hidden rounded-2xl bg-black ring-1 ring-black/5 sm:h-72 lg:h-full dark:ring-white/10">
          <AsciiArt className="ascii-pan" fill={false} />
          <div aria-hidden className="auth-art-overlay pointer-events-none absolute inset-0" />

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pt-16 pb-5 sm:px-8 sm:pb-7 lg:px-10 lg:pb-10">
            <p className="font-doto auth-caret text-[2.6rem] font-bold leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
              komunikasi
            </p>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-white/70 sm:mt-3 sm:text-sm">
              Channel buat ramai-ramai, DM buat yang pribadi.
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex flex-col overflow-hidden bg-background">
        <div aria-hidden className="auth-grid pointer-events-none absolute inset-0 opacity-70" />

        {/* Below lg the forms carry their own "Belum punya akun? Daftar" line
            under the button, so the header link would only repeat it and cost
            a whole row on short phones: the theme toggle floats in the corner. */}
        <header className="absolute right-2 top-2 z-10 flex items-center lg:relative lg:right-auto lg:top-auto lg:h-16 lg:justify-end lg:px-10">
          <div className="flex items-center gap-1">
            {switchTo.hint && (
              <span className="hidden text-sm text-muted-foreground lg:inline">{switchTo.hint}</span>
            )}
            <Link
              href={switchTo.href}
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted lg:inline-flex"
            >
              {switchTo.label}
            </Link>
            <ModeToggle />
          </div>
        </header>

        <main className="relative flex flex-1 items-center justify-center px-6 pt-6 pb-6 sm:py-10 lg:px-10">
          <div className="w-full max-w-[22rem]">
            {/* The forms read useSearchParams, which needs a Suspense boundary. */}
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </main>

        <footer className="relative flex items-center justify-between px-6 pt-2 pb-5 sm:py-5 max-lg:[@media(max-height:700px)]:hidden font-mono text-[11px] text-muted-foreground lg:px-10">
          <span>© {new Date().getFullYear()} Komunikasi</span>
        </footer>
      </div>
    </div>
  );
}
