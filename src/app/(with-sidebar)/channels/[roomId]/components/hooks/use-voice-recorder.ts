import { useCallback, useEffect, useRef, useState } from "react";

/** Voice notes stop on their own after this long. */
export const MAX_VOICE_SECONDS = 10 * 60;

/** First container/codec the browser can record: Opus in WebM, else AAC in MP4 (Safari). */
function pickMime(): { mime: string; ext: string; type: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    { mime: "audio/webm;codecs=opus", ext: "weba", type: "audio/webm" },
    { mime: "audio/webm", ext: "weba", type: "audio/webm" },
    { mime: "audio/mp4", ext: "m4a", type: "audio/mp4" },
    { mime: "audio/ogg;codecs=opus", ext: "oga", type: "audio/ogg" },
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? null;
}

export type VoiceRecorderState = "idle" | "recording";

/**
 * Record a voice note with MediaRecorder. `stop()` resolves to the file to
 * send (named .weba/.m4a so it is not mistaken for a video), `cancel()`
 * throws the recording away. The microphone is released either way.
 */
export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const format = useRef<ReturnType<typeof pickMime>>(null);
  const autoStop = useRef<(() => void) | null>(null);

  const release = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
    chunks.current = [];
    setState("idle");
    setSeconds(0);
  }, []);

  useEffect(() => release, [release]);

  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && pickMime() !== null;

  const start = useCallback(async () => {
    if (recorder.current) return;
    format.current = pickMime();
    if (!format.current) throw new Error("Browser ini tidak bisa merekam suara");
    // Throws NotAllowedError when the user denies the microphone.
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    stream.current = media;
    const rec = new MediaRecorder(media, { mimeType: format.current.mime, audioBitsPerSecond: 32_000 });
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.start(250);
    recorder.current = rec;
    startedAt.current = Date.now();
    setSeconds(0);
    setState("recording");
    ticker.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setSeconds(s);
      if (s >= MAX_VOICE_SECONDS) autoStop.current?.();
    }, 250);
  }, []);

  const stop = useCallback((): Promise<{ file: File; seconds: number } | null> => {
    const rec = recorder.current;
    if (!rec) return Promise.resolve(null);
    const duration = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    return new Promise((resolve) => {
      rec.onstop = () => {
        const fmt = format.current!;
        const blob = new Blob(chunks.current, { type: fmt.type });
        release();
        if (blob.size === 0) return resolve(null);
        const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
        resolve({ file: new File([blob], `pesan-suara-${stamp}.${fmt.ext}`, { type: fmt.type }), seconds: duration });
      };
      rec.stop();
    });
  }, [release]);

  const cancel = useCallback(() => {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    release();
  }, [release]);

  return { state, seconds, supported, start, stop, cancel, autoStop };
}

export function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
