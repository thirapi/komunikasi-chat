import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ModeToggle } from "@/components/landingpage/mode-toggle";
import { AsciiArt } from "@/components/ui/maomao";

/**
 * Split-screen frame for the auth pages (`/`, `/signin`, `/signup`): the
 * "maomao" ASCII art on the left, the form on the right. Below `lg` the art
 * collapses into a band above the form.
 */
export function AuthShell({
  children,
  switchTo,
}: {
  children: React.ReactNode;
  /** The header link to the other auth page, e.g. "Daftar" on login. */
  switchTo: { href: string; label: string };
}) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[1.15fr_1fr] lg:grid-rows-1">
      <div className="relative h-56 overflow-hidden bg-black sm:h-72 lg:h-auto">
        {/* Slight scale hides a dark 1px seam baked into the video's right
            edge; on the short mobile band, bias the crop towards the face. */}
        <AsciiArt className="absolute inset-0 scale-[1.02] object-[50%_18%] lg:object-center" />
      </div>

      <div className="flex flex-col bg-background">
        <header className="flex h-16 items-center justify-between px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo size={22} />
            <span className="text-sm font-semibold tracking-tight">Komunikasi</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href={switchTo.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {switchTo.label}
            </Link>
            <ModeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-sm">
            {/* The forms read useSearchParams, which needs a Suspense boundary. */}
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </main>

        <footer className="px-6 py-5 text-xs text-muted-foreground lg:px-10">
          © {new Date().getFullYear()} Komunikasi
        </footer>
      </div>
    </div>
  );
}
