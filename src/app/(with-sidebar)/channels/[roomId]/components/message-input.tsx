// src/app/(with-sidebar)/channels/[roomId]/components/message-input.tsx
"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useIsImpersonating } from "@/hooks/use-impersonation";
import { createMessage, uploadFileAction } from "../messages.action";
import { createId } from "@paralleldrive/cuid2";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { debounce } from "@/lib/debounce";
import { hapticMedium } from "@/lib/native/haptics";
import { setTypingStatusAction } from "../messages.action";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { RoomRecord, RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { ArrowBendUpLeft, X, Paperclip, File, Plus, PaperPlaneRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { registerRetry, clearRetry } from "@/lib/chat/pending-sends";
import dynamic from "next/dynamic";

// The picker carries the whole `frimousse` emoji dataset and is only reachable
// after the user opens it, so it is kept out of the eager chat chunk.
const EmojiPickerComponent = dynamic(
  () =>
    import("@/components/emoji-picker/emoji-picker").then(
      (m) => m.EmojiPickerComponent,
    ),
  { ssr: false },
);

interface Props {
  userId: string;
  roomData: RoomWithParticipantsDTO;
  replyingTo: MessageWithUserDTO | null;
  onCancelReply: () => void;
  inputRef: React.RefObject<HTMLDivElement | null>;
  onNewMessage: (message: MessageWithUserDTO) => void;
  onStartEditLast: () => void;
  /** Called when a send fails; the row should offer "Coba lagi". */
  onSendFailed: (optimisticId: string) => void;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
  };
}

export function MessageInput({
  userId,
  roomData,
  replyingTo,
  onCancelReply,
  inputRef,
  onNewMessage,
  onStartEditLast,
  onSendFailed,
  user,
}: Props) {
  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ file: File; preview: string | null }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isImpersonating, impersonatedUser } = useIsImpersonating();

  const { displayNames } = useTypingIndicator(roomData.id, userId);

  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for video support

  const sendTypingEvent = useRef(
    debounce(() => {
      setTypingStatusAction(userId, roomData.id, true);
    }, 300),
  ).current;

  const sendStopTypingEvent = useRef(
    debounce(() => {
      setTypingStatusAction(userId, roomData.id, false);
    }, 5000),
  ).current;

  const handleTyping = useCallback(() => {
    if (!userId) return;
    sendTypingEvent();
    sendStopTypingEvent();
  }, [sendTypingEvent, sendStopTypingEvent, userId]);

  const generatePreview = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      } else if (file.type.startsWith("video/")) {
        // For video, we could generate a thumbnail, but for now we'll just indicate it's a video
        // or let the browser handle it if we used a <video> element.
        // For preview, we'll return a special string 'video-preview' or similar
        // to be handled in the UI.
        const url = URL.createObjectURL(file);
        resolve(url);
      } else {
        resolve(null);
      }
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedFiles.length + files.length > MAX_FILES) {
      toast.error(`Maksimal ${MAX_FILES} file per pesan`);
      return;
    }

    const validFiles: File[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" terlalu besar. Maksimal 50 MB`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const newPreviews = await Promise.all(
      validFiles.map(async (file) => ({
        file,
        preview: await generatePreview(file),
      }))
    );

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setFilePreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };



  type SendJob = {
    optimisticId: string;
    content: string;
    replyTo?: string;
    files: File[];
    attachments?: { url: string; key: string; fileType: string; size?: number }[];
  };

  /**
   * Upload (if needed) and create the message for an optimistic row that is
   * already on screen. On failure the row is flagged and a retry is registered,
   * so nothing the user typed is ever lost to a flaky connection.
   */
  const deliver = useCallback(
    async (job: SendJob) => {
      try {
        if (job.files.length > 0 && !job.attachments) {
          job.attachments = await Promise.all(
            job.files.map(async (file) => {
              const formData = new FormData();
              formData.append("file", file);
              const res = await uploadFileAction(formData, `channels/${roomData.id}`);
              if (res.status === "success" && res.data) {
                return {
                  url: res.data.fileurl,
                  key: res.data.filename,
                  fileType: res.data.mimetype,
                  size: res.data.size,
                };
              }
              throw new Error(res.error?.message || `Gagal mengunggah ${file.name}`);
            }),
          );
        }

        const response = await createMessage(
          userId,
          job.content,
          roomData.id,
          job.replyTo,
          job.attachments,
          job.optimisticId,
        );

        if (response.status === "success" && response.data) {
          clearRetry(job.optimisticId);
          onNewMessage(response.data);
        } else {
          throw new Error(response.error?.message || "Gagal mengirim pesan");
        }
      } catch (err: any) {
        console.error("Gagal mengirim pesan:", err);
        registerRetry(job.optimisticId, () => {
          void deliver(job);
        });
        onSendFailed(job.optimisticId);
      }
    },
    [userId, roomData.id, onNewMessage, onSendFailed],
  );

  const handleSend = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      if ((!content.trim() && selectedFiles.length === 0) || !userId) return;

      sendStopTypingEvent.cancel();
      setTypingStatusAction(userId, roomData.id, false);

      const parsedContent = content.replace(/(?<!<)@([a-zA-Z0-9_-]+)/g, (match, username) => {
        if (username.toLowerCase() === "everyone") return "<@everyone>";
        const participant = roomData.participants?.find(
          (p) => p.user.username.toLowerCase() === username.toLowerCase(),
        );
        return participant ? `<@${participant.user.id}>` : match;
      });

      // The message goes on screen immediately — before any upload — and the
      // composer clears, so the user can keep typing (Telegram-style). Upload
      // and delivery continue in the background via `deliver`.
      const optimisticId = createId();
      const optimisticMessage = {
        id: `optimistic-${optimisticId}`,
        content: parsedContent,
        userId,
        roomId: roomData.id,
        attachments: selectedFiles.map((file, index) => ({
          id: `temp-${optimisticId}-${index}`,
          url: filePreviews[index]?.preview || "",
          key: file.name,
          fileType: file.type,
          size: file.size,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        replyTo: replyingTo?.id || null,
        // Lets the quoted line render immediately instead of popping in
        // when the server copy replaces the optimistic one.
        replyToMessage: replyingTo
          ? {
              id: replyingTo.id,
              content: replyingTo.content,
              user: { username: replyingTo.user?.username, name: replyingTo.user?.name },
            }
          : null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOptimistic: true,
        optimisticId,
        user: {
          username: user.username,
          name: user.name,
          avatar: user.avatar,
        },
      } as unknown as MessageWithUserDTO;

      const job: SendJob = {
        optimisticId,
        content: parsedContent,
        replyTo: replyingTo?.id,
        files: [...selectedFiles],
      };

      hapticMedium();
      onNewMessage(optimisticMessage);
      setContent("");
      clearAllFiles();
      onCancelReply();

      void deliver(job);
    },
    [
      content,
      selectedFiles,
      filePreviews,
      userId,
      roomData.id,
      roomData.participants,
      replyingTo,
      onCancelReply,
      sendStopTypingEvent,
      onNewMessage,
      deliver,
      user.username,
      user.name,
      user.avatar,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      if (replyingTo) onCancelReply();
    }
    // Slack/Discord habit: ↑ in an empty composer edits your last message.
    if (e.key === "ArrowUp" && !content.trim() && selectedFiles.length === 0) {
      e.preventDefault();
      onStartEditLast();
    }
  };

  // Stable identities: MentionTextarea's OnChange and command plugins are keyed
  // on these props, so inline arrows at the call site re-register them on every
  // keystroke.
  const handleEditorChange = useCallback((newContent: string) => {
    setContent(newContent);
    handleTyping();
  }, [handleTyping]);

  const handleEditorSubmit = useCallback(() => {
    handleSend();
  }, [handleSend]);

  const handleEditorBlur = useCallback(() => {
    sendStopTypingEvent();
  }, [sendStopTypingEvent]);

  useEffect(() => {
    return () => {
      sendTypingEvent.cancel();
      sendStopTypingEvent.cancel();
    };
  }, [sendTypingEvent, sendStopTypingEvent]);

  // Support paste image
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter(item => item.type.startsWith("image/"));

      if (imageItems.length === 0) return;

      if (selectedFiles.length + imageItems.length > MAX_FILES) {
        toast.error(`Maksimal ${MAX_FILES} file per pesan`);
        return;
      }

      const newFiles: File[] = [];
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          if (file.size > MAX_FILE_SIZE) {
            toast.error(`Gambar "${file.name}" terlalu besar. Maksimal 50 MB`);
            continue;
          }
          newFiles.push(file);
        }
      }

      if (newFiles.length > 0) {
        const newPreviews = await Promise.all(
          newFiles.map(async (file) => ({
            file,
            preview: await generatePreview(file),
          }))
        );

        setSelectedFiles((prev) => [...prev, ...newFiles]);
        setFilePreviews((prev) => [...prev, ...newPreviews]);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [selectedFiles.length]);

  const replyExcerpt = replyingTo?.content
    ? replyingTo.content
        .replace(/<@([a-zA-Z0-9_-]+)>/g, (match, uid) => {
          if (uid === "everyone") return "@everyone";
          const participant = roomData?.participants?.find((p: any) => p.user.id === uid);
          return participant ? `@${participant.user.username}` : "@pengguna";
        })
        .replace(/```[\s\S]*?```/g, "[kode]")
        .replace(/[*_~`]/g, "")
        .replace(/\n+/g, " ")
    : "Lampiran";

  const hasTray = !!replyingTo || selectedFiles.length > 0;
  const canSend = !!content.trim() || selectedFiles.length > 0;

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="flex flex-col px-3 sm:px-4 pb-2 sm:pb-3">
      {isImpersonating ? (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          <span className="font-medium text-destructive">Mode impersonasi</span>
          <span>— hanya bisa membaca{impersonatedUser && ` sebagai @${impersonatedUser.username}`}</span>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background transition-[border-color,box-shadow] focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/15">
          {replyingTo && (
            <div className="flex items-center gap-2 h-8 pl-3 pr-1 border-b border-border bg-muted/40 rounded-t-lg text-xs">
              <ArrowBendUpLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="flex-1 min-w-0 truncate text-muted-foreground">
                Membalas{" "}
                <span className="font-medium text-foreground">
                  {replyingTo.user?.name || replyingTo.user?.username}
                </span>
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                {replyExcerpt}
              </p>
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                onClick={onCancelReply}
                aria-label="Batal membalas"
              >
                <X weight="bold" className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className={cn("flex gap-2 overflow-x-auto px-3 pt-3 pb-1", !replyingTo && "rounded-t-lg")}>
              {filePreviews.map((item, index) => (
                <div key={index} className="group/file relative shrink-0">
                  <div className="h-20 w-20 overflow-hidden rounded-md border border-border bg-muted">
                    {item.preview ? (
                      item.file.type.startsWith("video/") ? (
                        <div className="relative h-full w-full">
                          <video src={item.preview} className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                              <svg className="w-3.5 h-3.5 ml-px" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z" />
                              </svg>
                            </span>
                          </span>
                        </div>
                      ) : (
                        <img src={item.preview} alt={item.file.name} className="h-full w-full object-cover" />
                      )
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1.5 text-center text-muted-foreground">
                        <File className="h-5 w-5" />
                        <span className="w-full truncate text-[10px]">{item.file.name}</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-0.5 w-20 truncate text-[10px] text-muted-foreground tabular-nums">
                    {formatSize(item.file.size)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground shadow-sm hover:text-destructive transition-colors"
                    aria-label={`Hapus ${item.file.name}`}
                  >
                    <X weight="bold" className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {selectedFiles.length < MAX_FILES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 w-20 shrink-0 rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-[10px]">Tambah</span>
                </button>
              )}
            </div>
          )}

          <div className={cn("flex items-end gap-0.5 px-1.5 py-0.5", hasTray && "pt-1")}>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 w-8 mb-1 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Lampirkan file"
              title="Lampirkan file"
            >
              <Paperclip className="h-[18px] w-[18px]" />
            </Button>

            <MentionTextarea
              value={content}
              onChange={handleEditorChange}
              onSubmit={handleEditorSubmit}
              onKeyDown={handleKeyDown}
              onBlur={handleEditorBlur}
              placeholder={(() => {
                if (roomData.isDirect) {
                  const partner = roomData.participants?.find((p) => p.user.id !== userId)?.user;
                  return partner ? `Pesan untuk ${partner.name || "@" + partner.username}` : `Tulis pesan`;
                }
                return `Pesan ke #${roomData.name}`;
              })()}
              className="flex-1 min-w-0"
              maxHeight={200}
              roomData={roomData}
              currentUserId={userId}
              inputRef={inputRef}
              autoFocus={false}
              draftKey={`chat-${roomData.id}`}
            />

            <EmojiPickerComponent
              onEmojiSelect={(emoji) => {
                setContent((prev) => prev + emoji);
              }}
              triggerClassName="h-8 w-8 mb-1 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
            />

            <Button
              onClick={() => handleSend()}
              disabled={!canSend}
              className={cn(
                "h-8 w-8 mb-1 p-0 shrink-0 rounded-md transition-colors",
                canSend
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-transparent text-muted-foreground/50 shadow-none"
              )}
              aria-label="Kirim pesan"
              title="Kirim (Enter)"
            >
              <PaperPlaneRight weight="fill" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="h-5 flex items-center px-1 text-[11px] text-muted-foreground" aria-live="polite">
        {displayNames.length > 0 ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="inline-flex gap-[3px] items-center shrink-0" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </span>
            <span className="truncate">
              <span className="font-medium text-foreground/80">
                {displayNames.length > 2
                  ? `${displayNames.slice(0, 2).join(", ")} dan ${displayNames.length - 2} lainnya`
                  : displayNames.join(" dan ")}
              </span>{" "}
              sedang mengetik…
            </span>
          </div>
        ) : (
          <span className="hidden md:inline text-muted-foreground/70">
            <kbd className="font-sans font-medium">Enter</kbd> kirim
            <span className="mx-1.5">·</span>
            <kbd className="font-sans font-medium">Shift + Enter</kbd> baris baru
            <span className="mx-1.5">·</span>
            <kbd className="font-sans font-medium">↑</kbd> edit pesan terakhir
          </span>
        )}
      </div>
    </div>
  );
}
