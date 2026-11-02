// src/app/(with-sidebar)/channels/[roomId]/components/message-input.tsx
"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useIsImpersonating } from "@/hooks/use-impersonation";
import { createMessage } from "../messages.action";
import { createId } from "@paralleldrive/cuid2";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { debounce } from "@/lib/debounce";
import { hapticMedium } from "@/lib/native/haptics";
import { setTypingStatusAction } from "../messages.action";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { RoomRecord, RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { ArrowBendUpLeft, X, Paperclip, File, Plus, PaperPlaneRight, ImageSquare, FileText, Microphone, Trash } from "@phosphor-icons/react/dist/ssr";
import { useVoiceRecorder, formatDuration } from "./hooks/use-voice-recorder";
import { cn } from "@/lib/utils";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { registerRetry, clearRetry } from "@/lib/chat/pending-sends";
import { uploadFile } from "@/lib/chat/upload";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MEDIA_ACCEPT = "image/*,video/*";
const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.txt";
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
  /** Upload progress (0–100) for an optimistic message with attachments. */
  onUploadProgress?: (optimisticId: string, pct: number) => void;
  /** Filled with this composer's addFiles, so the room can forward dropped files. */
  fileDropRef?: React.MutableRefObject<((files: File[]) => void) | null>;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
  };
  /** Replaces the composer (e.g. a DM closed by a block). */
  blockedNotice?: string | null;
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
  onUploadProgress,
  fileDropRef,
  user,
  blockedNotice,
}: Props) {
  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ file: File; preview: string | null }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
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

  const selectedCountRef = useRef(0);
  selectedCountRef.current = selectedFiles.length;

  /**
   * Single entry point for attachments from the picker, clipboard paste and
   * drag-and-drop, so the limits and messages are the same everywhere.
   */
  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const room = MAX_FILES - selectedCountRef.current;
    if (room <= 0) {
      toast.error(`Maksimal ${MAX_FILES} file per pesan`);
      return;
    }
    if (files.length > room) {
      toast.error(`Maksimal ${MAX_FILES} file per pesan — ${files.length - room} file tidak ditambahkan`);
    }

    const validFiles: File[] = [];
    for (const file of files.slice(0, room)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" terlalu besar. Maksimal 50 MB`);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    const newPreviews = await Promise.all(
      validFiles.map(async (file) => ({ file, preview: await generatePreview(file) })),
    );
    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setFilePreviews((prev) => [...prev, ...newPreviews]);
    inputRef.current?.focus();
  }, []);

  // ChatRoom forwards files dropped anywhere on the conversation here.
  useEffect(() => {
    if (!fileDropRef) return;
    fileDropRef.current = (files) => void addFiles(files);
    return () => {
      fileDropRef.current = null;
    };
  }, [fileDropRef, addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    void addFiles(files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
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
          // Direct-to-R2 uploads; overall progress is weighted by file size.
          const total = job.files.reduce((n, f) => n + f.size, 0) || 1;
          const loaded = job.files.map(() => 0);
          const report = () =>
            onUploadProgress?.(
              job.optimisticId,
              Math.round(job.files.reduce((n, f, i) => n + (loaded[i] / 100) * f.size, 0) / total * 100),
            );
          job.attachments = await Promise.all(
            job.files.map((file, i) =>
              uploadFile(file, `channels/${roomData.id}`, (pct) => {
                loaded[i] = pct;
                report();
              }),
            ),
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
    [userId, roomData.id, onNewMessage, onSendFailed, onUploadProgress],
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

  // Voice notes: tap the mic (shown while the composer is empty, as in
  // WhatsApp/Telegram), then send or discard. Sent like any attachment: on
  // screen at once, uploaded and delivered in the background, retryable.
  const voice = useVoiceRecorder();
  const sendVoiceNote = useCallback(
    (file: File) => {
      if (!userId) return;
      const optimisticId = createId();
      const optimisticMessage = {
        id: `optimistic-${optimisticId}`,
        content: "",
        userId,
        roomId: roomData.id,
        attachments: [
          {
            id: `temp-${optimisticId}-0`,
            url: URL.createObjectURL(file),
            key: file.name,
            fileType: file.type,
            size: file.size,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        replyTo: replyingTo?.id || null,
        replyToMessage: replyingTo
          ? { id: replyingTo.id, content: replyingTo.content, user: { username: replyingTo.user?.username, name: replyingTo.user?.name } }
          : null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOptimistic: true,
        optimisticId,
        user: { username: user.username, name: user.name, avatar: user.avatar },
      } as unknown as MessageWithUserDTO;
      hapticMedium();
      onNewMessage(optimisticMessage);
      onCancelReply();
      void deliver({ optimisticId, content: "", replyTo: replyingTo?.id, files: [file] });
    },
    [userId, roomData.id, replyingTo, user.username, user.name, user.avatar, onNewMessage, onCancelReply, deliver],
  );
  const finishRecording = useCallback(async () => {
    const result = await voice.stop();
    if (result) sendVoiceNote(result.file);
  }, [voice, sendVoiceNote]);
  voice.autoStop.current = () => void finishRecording();
  const startRecording = useCallback(async () => {
    try {
      await voice.start();
      hapticMedium();
    } catch (err) {
      const name = (err as Error)?.name;
      toast.error(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Izinkan akses mikrofon untuk mengirim pesan suara"
          : (err as Error)?.message || "Tidak bisa mulai merekam",
      );
    }
  }, [voice]);

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

  // Support pasting images (e.g. screenshots) straight into the composer.
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.items || [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => !!f);
      if (images.length > 0) void addFiles(images);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addFiles]);

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
      {blockedNotice ? (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          {blockedNotice}
        </div>
      ) : isImpersonating ? (
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
                  onClick={() => mediaInputRef.current?.click()}
                  className="h-20 w-20 shrink-0 rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-[10px]">Tambah</span>
                </button>
              )}
            </div>
          )}

          {voice.state === "recording" ? (
            <div className="flex h-11 items-center gap-2 px-2" role="status" aria-live="polite">
              <button
                type="button"
                onClick={voice.cancel}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Batalkan rekaman"
                title="Batalkan"
              >
                <Trash className="h-4 w-4" />
              </button>
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden />
              <span className="text-sm tabular-nums text-foreground">{formatDuration(voice.seconds)}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Merekam pesan suara…</span>
              <Button
                type="button"
                onClick={() => void finishRecording()}
                className="h-8 w-8 shrink-0 rounded-md bg-primary p-0 text-primary-foreground hover:bg-primary/90"
                aria-label="Kirim pesan suara"
                title="Kirim"
              >
                <PaperPlaneRight weight="fill" className="h-4 w-4" />
              </Button>
            </div>
          ) : (
          <div className={cn("flex items-end gap-0.5 px-1.5 py-0.5", hasTray && "pt-1")}>
            <input type="file" multiple ref={mediaInputRef} onChange={handleFileSelect} className="hidden" accept={MEDIA_ACCEPT} />
            <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept={DOCUMENT_ACCEPT} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 mb-1 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground"
                  aria-label="Lampirkan"
                  title="Lampirkan"
                >
                  <Paperclip className="h-[18px] w-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56 p-1">
                <DropdownMenuItem onSelect={() => mediaInputRef.current?.click()} className="gap-3 py-2">
                  <ImageSquare className="h-[18px] w-[18px] text-muted-foreground" />
                  <span className="flex flex-col">
                    <span className="text-sm">Foto & video</span>
                    <span className="text-[11px] text-muted-foreground">Dari galeri atau kamera</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()} className="gap-3 py-2">
                  <FileText className="h-[18px] w-[18px] text-muted-foreground" />
                  <span className="flex flex-col">
                    <span className="text-sm">Dokumen</span>
                    <span className="text-[11px] text-muted-foreground">PDF, Word, teks</span>
                  </span>
                </DropdownMenuItem>
                <div className="mt-1 border-t border-border px-2 pt-1.5 pb-1 text-[11px] text-muted-foreground">
                  Bisa juga seret file ke chat atau tempel gambar
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

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

            {!canSend && voice.supported ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void startRecording()}
                className="h-8 w-8 mb-1 p-0 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Rekam pesan suara"
                title="Rekam pesan suara"
              >
                <Microphone className="h-[18px] w-[18px]" />
              </Button>
            ) : (
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
            )}
          </div>
          )}
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
