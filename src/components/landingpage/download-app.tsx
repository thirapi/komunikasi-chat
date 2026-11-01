import * as React from "react";
import Image from "next/image";
import { DownloadSimple, ShieldCheck, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { getLatestAndroidRelease } from "@/lib/latest-release";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

/**
 * Download card for the Android build.
 *
 * Rendered server-side so the version and size come from the release that
 * actually exists. The link points straight at the GitHub release asset rather
 * than a store: the APK is served over HTTPS, its SHA-256 is published beside
 * it, and the signing key is the one the project has always used, so a sideload
 * is verifiable rather than a leap of faith.
 *
 * Bordered rather than elevated. The card sits directly below the sign-in form
 * on the same background, so a shadow would imply it floats above something it
 * is not floating above.
 */
export async function DownloadApp() {
  const release = await getLatestAndroidRelease();

  // No card rather than a broken one. Nothing here is worth failing a page
  // load over.
  if (!release) return null;

  return (
    <section
      aria-labelledby="download-app-heading"
      className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border p-5"
    >
      <div className="flex items-center gap-3">
        {/*
          next/image rather than a plain <img>: the source is a 512px PNG and it
          renders at 40px, so the loader is doing real work. `sizes` keeps it
          from fetching a larger variant than the slot needs.
        */}
        <Image
          src="/icons/maskable_icon.png"
          alt=""
          aria-hidden
          width={512}
          height={512}
          sizes="40px"
          className="size-10 shrink-0 rounded-lg"
        />

        <div className="min-w-0 flex-1">
          <h2
            id="download-app-heading"
            className="text-sm font-semibold tracking-tight"
          >
            Aplikasi Android
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Versi {release.version}
            {release.size && ` · ${release.size}`}
            {release.publishedAt && ` · ${formatDate(release.publishedAt)}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" className="gap-2">
          <a href={release.downloadUrl} rel="noopener noreferrer">
            <DownloadSimple weight="bold" aria-hidden className="h-4 w-4" />
            Unduh APK
          </a>
        </Button>
        <Button asChild size="sm" variant="ghost" className="gap-2">
          <a href={release.releaseUrl} rel="noopener noreferrer" target="_blank">
            <ArrowSquareOut aria-hidden className="h-4 w-4" />
            Rilis
          </a>
        </Button>
      </div>

      {release.checksum && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            SHA-256{" "}
            <code className="font-mono break-all">{release.checksum.slice(0, 32)}…</code>
          </span>
        </p>
      )}
    </section>
  );
}

export default DownloadApp;
