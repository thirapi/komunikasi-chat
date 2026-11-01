import { useEffect, useRef } from "react";
import { MessageWithUserDTO } from "@/lib/entities/models/message.model";

export function useScrollToInitial(
  messages: MessageWithUserDTO[],
  unreadRef: React.RefObject<HTMLDivElement | null>,
  bottomRef: React.RefObject<HTMLDivElement | null>,
  /** When true the room restored a saved position, so leave scroll alone. */
  skipRef?: React.RefObject<boolean>
) {
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (hasScrolled.current || !messages || messages.length === 0) return;

    // requestAnimationFrame ganda memastikan React selesai menempel DOM
    // dan browser selesai melakukan kalkulasi letak (layout & paint).
    // Ini mengeliminasi race-condition dengan render IndexedDB tanpa delay tebak-tebakan.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const hasUnread = unreadRef.current !== null;
        if (hasUnread && !skipRef?.current) {
          unreadRef.current?.scrollIntoView({
            behavior: "auto",
            block: "center",
          });
        }
        // CSS flex-col-reverse secara inheren memulai scroll dari bawah.
        // Jika tidak ada pesan Unread, kita membiarkan browser istirahat tanpa manipulasi JS (0 flicker!).

        hasScrolled.current = true;
      });
    });
  }, [messages, unreadRef, bottomRef]);
}
