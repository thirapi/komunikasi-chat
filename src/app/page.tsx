import { ModeToggle } from "@/components/landingpage/mode-toggle";
import { AnimateInView } from "@/components/landingpage/animate-in-view";
import { BrandLogo } from "@/components/brand-logo";
import { getUserSession } from "@/app/auth.action";
import { redirect } from "next/navigation";
import { HeroWordmark } from "@/components/landingpage/hero-wordmark";
import { AuthContainer } from "@/components/landingpage/auth-container";
import { Suspense } from "react";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Komunikasi",
  description: "Komunikasi adalah platform pesan instan modern yang dirancang untuk kecepatan, keamanan, dan produktivitas. Hubungkan tim Anda dan berbagi ide dengan lancar.",
  keywords: ["chat", "real-time", "komunikasi", "pesan instan", "kolaborasi", "platform chat", "aman"],
  authors: [{ name: "Thirafi" }],
  openGraph: {
    title: "Komunikasi",
    description: "Hubungkan tim Anda dan berbagi ide dengan lancar di platform komunikasi masa depan.",
    url: "https://komunikasi.qzz.io",
    siteName: "Komunikasi",
    locale: "id_ID",
    type: "website",
  },
};

export default async function House() {
  const session = await getUserSession();

  // If user is already logged in, redirect to the app immediately
  if (session) {
    redirect("/channels/default");
  }

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row overflow-hidden">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Komunikasi",
            url: "https://komunikasi.qzz.io",
            description: "Platform pesan instan modern untuk kolaborasi tim.",
            applicationCategory: "CommunicationApplication",
          }),
        }}
      />

      {/*
        Left side: the wordmark and a short description of what the product is.
        The mark is the hero rather than an effect layered on top of a word —
        the previous parallax stack duplicated the glyph four times just to
        fake depth, which cost a client component and a paint per layer.
      */}
      <div className="flex flex-col justify-center gap-10 px-6 py-16 lg:w-1/2 lg:border-r lg:border-border lg:px-12 lg:py-24">
        <AnimateInView direction="up" className="flex flex-col gap-8">
          <HeroWordmark />

          <div className="flex max-w-sm flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Platform pesan instan untuk tim. Cepat, tanpa iklan, dan data
              Anda tidak ditulis ke server mana pun kecuali milik Anda sendiri.
            </p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {[
                "Pesan real-time dan channel",
                "Sinkron antrean tanpa internet",
                "Akses langsung dari browser",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full bg-primary"
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </AnimateInView>
      </div>

      {/*
        Right side: the sign-in form is the page's actual job, so it is the only
        thing on this side competing for attention. Separated from the left by a
        border rather than a shadow — the two halves read as two panels of one
        surface instead of a card floating above a photo.
      */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-6 lg:px-12">
          <div className="flex items-center gap-2">
            <BrandLogo size={22} />
            <span className="text-sm font-semibold tracking-tight">
              Komunikasi
            </span>
          </div>
          <ModeToggle />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-20">
          <AnimateInView
            direction="up"
            delay={0.1}
            className="flex w-full max-w-md flex-col gap-8"
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-12">
                  <CircleNotch
                    weight="duotone"
                    className="h-8 w-8 animate-spin text-primary"
                  />
                </div>
              }
            >
              <AuthContainer />
            </Suspense>

            {/* Android download (DownloadApp) is hidden for now — re-add it
                here when the APK distribution is ready to be promoted. */}
          </AnimateInView>
        </main>

        <footer className="flex items-center justify-between border-t border-border px-6 py-5 text-xs text-muted-foreground lg:px-12">
          <span>© {new Date().getFullYear()} Komunikasi</span>
          <a
            href="/privacy"
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Privasi
          </a>
        </footer>
      </div>
    </div>
  );
}
