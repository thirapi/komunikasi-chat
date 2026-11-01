import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

/**
 * The hero on the landing page: the brand mark above the wordmark.
 *
 * This replaces a client component that rendered the word four times — glow,
 * secondary shadow, main and reflection — and tracked the pointer with springs
 * to offset each layer by a different fraction. The depth was an illusion over
 * a flat background, and it cost a hydration pass plus a repaint per layer on
 * every mouse move.
 *
 * As a server component it ships no JavaScript. The colour shift on hover is
 * plain CSS on the group, which is what the per-letter scale animation was
 * reaching for anyway.
 */
export function HeroWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-6", className)}>
      <BrandLogo size={64} />

      {/*
        tracking-tight rather than tracking-tighter: the word is long enough
        that tightening further starts pulling the double letters apart at
        large sizes.
      */}
      <h1 className="text-5xl font-bold leading-none tracking-tight sm:text-6xl lg:text-7xl">
        Komunikasi
      </h1>
    </div>
  );
}

export default HeroWordmark;
