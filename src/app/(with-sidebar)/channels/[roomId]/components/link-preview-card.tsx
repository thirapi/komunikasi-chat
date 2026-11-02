"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLinkPreviewAction } from "@/app/(with-sidebar)/link-preview.action";

/**
 * Preview card for the first link in a message (WhatsApp, Telegram and Teams
 * all preview one link). The server fetches and caches it; the image goes
 * through the media proxy so the viewer's IP never reaches the linked site.
 * Renders nothing until there is something to show.
 */
export function LinkPreviewCard({ url }: { url: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { data } = useQuery({
    queryKey: ["link-preview", url],
    queryFn: () => getLinkPreviewAction(url),
    staleTime: 60 * 60 * 1000,
    gcTime: 6 * 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!data || (!data.title && !data.description)) return null;
  const image = data.image && !imageFailed ? `/api/media-proxy?url=${encodeURIComponent(data.image)}` : null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(e) => e.stopPropagation()}
      className="mt-1 mb-0.5 flex max-w-[480px] gap-3 overflow-hidden rounded-md border-l-2 border-primary/60 bg-muted/40 py-2 pl-3 pr-2 transition-colors hover:bg-muted/70"
    >
      <span className="min-w-0 flex-1">
        {data.siteName && (
          <span className="block truncate text-[11px] font-medium text-muted-foreground">{data.siteName}</span>
        )}
        {data.title && (
          <span className="mt-0.5 line-clamp-2 block text-[13px] font-semibold leading-snug text-primary">
            {data.title}
          </span>
        )}
        {data.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-foreground/75">{data.description}</span>
        )}
      </span>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-16 w-16 shrink-0 rounded object-cover sm:h-20 sm:w-20"
        />
      )}
    </a>
  );
}
