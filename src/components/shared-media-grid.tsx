"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { getSharedMediaAction } from "@/app/(with-sidebar)/user.action";
import { File } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { ImageLightbox, type ImageSource } from "@/components/ui/image-lightbox";

interface SharedMediaGridProps {
  currentUserId: string;
  profileUsername: string;
}

export function SharedMediaGrid({ currentUserId, profileUsername }: SharedMediaGridProps) {
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["shared-media", profileUsername],
    queryFn: () => getSharedMediaAction(currentUserId, profileUsername).then(r => r.data ?? []),
    staleTime: 60_000,
  });

  const media = data ?? [];

  const images: ImageSource[] = React.useMemo(() =>
    media.map((a) => ({
      url: a.url,
      filename: a.description || a.url.split("/").pop() || "media",
      type: a.fileType.startsWith("video/") ? "video" as const : "image" as const,
    })),
    [media],
  );

  if (isLoading) {
    return (
      <div className="px-4 pb-8 md:px-6">
        <h3 className="mb-3 text-sm font-medium">Media</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-sm animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (media.length === 0) return null;

  return (
    <>
      <div className="px-4 pb-8 md:px-6">
        <h3 className="mb-3 text-sm font-medium">
          Media <span className="font-normal text-muted-foreground tabular-nums">{media.length}</span>
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1">
          {media.map((attachment, idx) => {
            const isVideo = attachment.fileType.startsWith("video/");
            return (
              <button
                key={attachment.id}
                onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                className={cn(
                  "aspect-square relative overflow-hidden bg-muted rounded-sm group w-full text-left",
                  "hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer",
                )}
              >
                {isVideo ? (
                  <div className="flex items-center justify-center h-full bg-black/5">
                    <File weight="duotone" className="h-8 w-8 text-muted-foreground" />
                  </div>
                ) : (
                  <Image
                    src={attachment.url}
                    alt={attachment.description ?? ""}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw"
                    unoptimized
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ImageLightbox
        images={images}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}
