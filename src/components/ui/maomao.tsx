"use client"

import { useEffect, useRef } from "react"

// AsciiArt — "maomao", made with the 21st.dev ASCII editor and baked
// to its exact rendered output (looping video + poster). Zero dependencies:
// one <video> that fills its parent. Drop it behind or inside your content:
// <div className="relative h-96"><AsciiArt className="absolute inset-0" /></div>
// Remix the source recipe (styles, animation, palette) in the editor:
// https://21st.dev/community/ascii/editor?from=7900cfcd-fc8f-4eeb-92c8-2d84b7215670
//
// The video and poster are self-hosted under /public/ascii rather than
// hotlinked from assets.21st.dev, so the login page does not depend on a third
// party staying up or keeping the URL. With prefers-reduced-motion the video
// stays paused on the poster frame.
export function AsciiArt({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => {
      if (query.matches) video.pause()
      else video.play().catch(() => {})
    }
    apply()
    query.addEventListener("change", apply)
    return () => query.removeEventListener("change", apply)
  }, [])

  return (
    <video
      ref={ref}
      className={className}
      src="/ascii/maomao.mp4"
      poster="/ascii/maomao-poster.webp"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-label="maomao — animated ASCII art"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  )
}
