"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "@phosphor-icons/react/dist/ssr";
import { formatDuration } from "./hooks/use-voice-recorder";

/**
 * Compact player for a voice note: play/pause, a seekable progress bar and
 * the time. Chrome's MediaRecorder writes WebM without a duration, so for
 * those the duration is found by seeking to the end once metadata loads.
 */
export function VoiceNotePlayer({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const probing = useRef(false);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const onMeta = () => {
      if (el.duration === Infinity || Number.isNaN(el.duration)) {
        probing.current = true;
        el.currentTime = 1e101;
      } else {
        setDuration(el.duration);
      }
    };
    const onTime = () => {
      if (probing.current) {
        probing.current = false;
        setDuration(el.duration);
        el.currentTime = 0;
        return;
      }
      setCurrent(el.currentTime);
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    el.addEventListener("pause", onPause);
    el.addEventListener("play", onPlay);
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("play", onPlay);
    };
  }, []);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      // One voice note at a time, like every chat app.
      document.querySelectorAll<HTMLAudioElement>("audio[data-voice-note]").forEach((other) => {
        if (other !== el) other.pause();
      });
      void el.play();
    } else {
      el.pause();
    }
  };

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div
      className="flex w-full max-w-xs items-center gap-3 rounded-full border border-border bg-background py-1.5 pl-1.5 pr-4"
      onClick={(e) => e.stopPropagation()}
    >
      <audio ref={audio} src={src} preload="metadata" data-voice-note />
      <button
        type="button"
        onClick={toggle}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        aria-label={playing ? "Jeda pesan suara" : "Putar pesan suara"}
      >
        {playing ? <Pause weight="fill" className="h-4 w-4" /> : <Play weight="fill" className="h-4 w-4 translate-x-px" />}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        onChange={(e) => {
          const el = audio.current;
          if (!el || !duration) return;
          el.currentTime = Number(e.target.value);
          setCurrent(el.currentTime);
        }}
        aria-label="Posisi pemutaran"
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        style={{ background: `linear-gradient(to right, var(--primary) ${pct}%, var(--muted) ${pct}%)` }}
      />
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {formatDuration(playing || current > 0 ? current : duration)}
      </span>
    </div>
  );
}
