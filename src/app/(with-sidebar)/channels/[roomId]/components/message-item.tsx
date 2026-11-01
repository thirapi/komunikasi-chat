import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { CHAT_SANITIZE_SCHEMA, escapeUserHtml } from "@/lib/chat/markdown-sanitize";
import { MessageWithUserDTO } from "@/lib/entities/models/message.model";
import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { YouTubeEmbed } from "@/components/ui/youtube-embed";
import { XEmbed } from "@/components/ui/x-embed";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useCustomEmojis } from "@/components/emoji-provider";
import { parseFediverseContent } from "@/lib/fediverse-content-parser";
import dynamic from "next/dynamic";

// The emoji picker pulls in the `frimousse` dataset and the inline editor pulls
// in the whole Lexical runtime. Neither is needed to render a message, so both
// are split out of the eager chat chunk and fetched on first interaction.
const EmojiPickerComponent = dynamic(
  () =>
    import("@/components/emoji-picker/emoji-picker").then(
      (m) => m.EmojiPickerComponent,
    ),
  { ssr: false },
);
const MentionTextarea = dynamic(
  () =>
    import("@/components/ui/mention-textarea").then((m) => m.MentionTextarea),
  { ssr: false },
);

// Module-level constants — compiled once, not on every render
import { extractUrls } from "@/lib/extract-urls";
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const X_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/;
const IMAGE_REGEX = /\.(jpg|jpeg|png|webp|gif|svg)$/i;
const VIDEO_REGEX = /\.(mp4|webm|ogg)$/i;
const LEADING_DIGITS_REGEX = /^\d+-/;
const WHITESPACE_REGEX = /\s/g;
const CUSTOM_EMOJI_ONLY_REGEX = /^(:[a-zA-Z0-9_-]+:)+$/;
const EXTENDED_PICTOGRAPHIC_REGEX = /\p{Extended_Pictographic}/u;

const QUICK_REACTIONS = ["👍", "😂", "❤️"];

const REMARK_PLUGINS = [remarkGfm, remarkBreaks];
// Raw HTML is parsed only for the spans/imgs we inject (greentext, custom
// emoji); everything is then run through an allow-list. See markdown-sanitize.
const REHYPE_PLUGINS: any[] = [rehypeRaw, [rehypeSanitize, CHAT_SANITIZE_SCHEMA]];

function CodeBlock({ children }: { children: any }) {
  const [copied, setCopied] = useState(false);
  const codeElement = React.Children.only(children) as React.ReactElement<any>;
  const codeContent = String(codeElement.props.children).replace(/\n$/, "");
  const language = /language-([\w+#-]+)/.exec(codeElement.props.className || "")?.[1];

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="group/code relative my-1.5 w-full max-w-full min-w-0 overflow-hidden rounded-md border border-border bg-muted/50">
      <div className="flex items-center justify-between h-7 pl-3 pr-1 border-b border-border/70 text-[11px] text-muted-foreground">
        <span className="font-mono lowercase">{language || "kode"}</span>
        <button
          type="button"
          className="flex items-center gap-1 h-5 px-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(codeContent);
            setCopied(true);
          }}
        >
          {copied ? <Check weight="bold" className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Disalin" : "Salin"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 min-w-0">{children}</pre>
    </div>
  );
}

const MARKDOWN_CODE_COMPONENTS = {
  pre: ({ children }: any) => <CodeBlock>{children}</CodeBlock>,
  code: ({ node, className, children, ...props }: any) => {
    const isBlock = !!className || (typeof children === "string" && children.includes("\n"));

    // Block code
    if (isBlock) {
      return (
        <code
          className={cn(
            "block whitespace-pre-wrap break-all md:whitespace-pre md:break-normal font-mono text-[12.5px] leading-[1.6] text-foreground/90",
            className
          )}
          {...props}
        >
          {children}
        </code>
      );
    }

    // Inline code
    // Restore our multiline \n placeholder
    let inlineContent = children;
    if (typeof inlineContent === "string") {
      inlineContent = inlineContent.replace(/\uE000/g, "\n");
    } else if (Array.isArray(inlineContent)) {
      inlineContent = inlineContent.map((child: any) =>
        typeof child === "string" ? child.replace(/\uE000/g, "\n") : child
      );
    }

    return (
      <code
        className="break-words whitespace-pre-wrap rounded-[4px] border border-border/70 bg-muted/60 px-1 py-px font-mono text-[0.85em] text-foreground"
        {...props}
      >
        {inlineContent}
      </code>
    );
  },
};
import { ArrowBendUpLeft, File, DownloadSimple, Trash, Copy, PencilSimple, Check, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createRoom } from "../room.action";
import { deleteMessageAction } from "../messages.action";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProfileHoverCard } from "@/components/ui/profile-hover-card";

function truncate(str: string, max = 100) {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

const STATIC_MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => <p className="mb-1 last:mb-0 whitespace-pre-wrap">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc ml-5 my-0.5 space-y-px marker:text-muted-foreground [&_p]:m-0 [&_p]:inline">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal ml-5 my-0.5 space-y-px marker:text-muted-foreground [&_p]:m-0 [&_p]:inline">{children}</ol>,
  li: ({ children }: any) => <li className="pl-0.5 whitespace-pre-wrap">{children}</li>,
  h1: ({ children }: any) => <h1 className="text-lg font-semibold mt-2 mb-1 tracking-tight">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-base font-semibold mt-2 mb-1 tracking-tight">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-[0.95em] font-semibold mt-1.5 mb-0.5">{children}</h3>,
  blockquote: ({ children }: any) => (
    <blockquote className="my-1 border-l-[3px] border-border pl-3 text-foreground/80 [&_p]:mb-0">{children}</blockquote>
  ),
  hr: () => <hr className="my-2 border-border" />,
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-1.5 rounded-md border border-border">
      <table className="w-full text-[13px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }: any) => <th className="px-3 py-1.5 text-left font-medium text-foreground border-b border-border">{children}</th>,
  td: ({ children }: any) => <td className="px-3 py-1.5 border-b border-border/60 [tr:last-child_&]:border-b-0">{children}</td>,
  strong: ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }: any) => <em>{children}</em>,
  del: ({ children }: any) => <del>{children}</del>,
  img: ({ node, ...props }: any) => (
    <img
        {...props}
        className={cn(
            props.className,
            props.className?.includes('fediverse-emoji') && "inline-block h-[1.4em] w-[1.4em] align-text-bottom mx-0.5"
        )}
    />
  ),
};

export function MessageItemComponent({
  message,
  onlineUserIds,
  onReply,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleReaction,
  isEditing,
  currentUserId,
  isContinuation,
  isAfterSeparator,
  isHighlighted,
  onScrollToMessage,
  onRetrySend,
  onDiscardSend,
  roomData,
}: {
  message: MessageWithUserDTO;
  onlineUserIds: string[];
  onReply: (message: MessageWithUserDTO) => void;
  onStartEdit: (message: MessageWithUserDTO) => void;
  onSaveEdit: (messageId: string, content: string) => void;
  onCancelEdit: () => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  isEditing: boolean;
  currentUserId: string;
  isContinuation?: boolean;
  isAfterSeparator?: boolean;
  isHighlighted?: boolean;
  onScrollToMessage?: (messageId: string) => void;
  onRetrySend?: (message: MessageWithUserDTO) => void;
  onDiscardSend?: (message: MessageWithUserDTO) => void;
  roomData?: RoomWithParticipantsDTO;
}) {
  const router = useRouter();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const isMobile = useIsMobile();

  // Inline edit state
  const [editContent, setEditContent] = useState(message.content || "");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // When entering edit mode, populate and focus
  const resolveMentionsForEdit = useCallback((content: string) => {
    if (!content) return "";
    return content.replace(/<@([a-zA-Z0-9_-]+)>/g, (match, uid) => {
      if (uid === "everyone") return "@everyone";
      const participant = roomData?.participants?.find((p: any) => p.user.id === uid);
      return participant ? `@${participant.user.username}` : match;
    });
  }, [roomData]);

  const prepareMentionsForSave = useCallback((content: string) => {
    if (!content) return "";
    return content.replace(/(?<!<)@([a-zA-Z0-9_-]+)>/g, (match, username) => {
      if (username.toLowerCase() === "everyone") return "<@everyone>";
      const participant = roomData?.participants?.find((p: any) => p.user.username.toLowerCase() === username.toLowerCase());
      return participant ? `<@${participant.user.id}>` : match;
    });
  }, [roomData]);

  useEffect(() => {
    if (isEditing) {
      setEditContent(resolveMentionsForEdit(message.content || ""));
      // Lexical's autoFocus prop handles focus and cursor positioning
    }
  }, [isEditing, message.content]);


  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    const originalParsed = resolveMentionsForEdit(message.content || "");
    if (!trimmed || trimmed === originalParsed || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await onSaveEdit(message.id, prepareMentionsForSave(trimmed));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancelEdit();
    }
  };

  // Detect if message was edited
  const isEdited = useMemo(() => {
    if (!message.updatedAt || !message.createdAt) return false;
    const created = new Date(message.createdAt).getTime();
    const updated = new Date(message.updatedAt).getTime();
    // Allow 1 second tolerance for DB write delay
    return updated - created > 1000;
  }, [message.createdAt, message.updatedAt]);

  const formatEditedTime = (date: Date) => {
    return new Date(date).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Auto hide mobile actions after 3.5s to free up screen and prevent stuck UI
  useEffect(() => {
    if (showMobileActions) {
      const timer = setTimeout(() => setShowMobileActions(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [showMobileActions]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleStartDM = useCallback(async (targetUserId: string) => {
    if (targetUserId === currentUserId) return;

    const response = await createRoom(currentUserId, targetUserId);
    if (response.status === "success" && response.data) {
      router.push(`/channels/${response.data.id}`);
    } else {
      toast.error(response.error?.message || "Gagal membuat percakapan");
    }
  }, [currentUserId, router]);

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    const response = await deleteMessageAction(currentUserId, message.id);
    if (response.status === "error") {
      toast.error(response.error?.message || "Gagal menghapus pesan");
      setIsDeleting(false);
    } else {
      toast.success("Pesan dihapus");
      setDeleteConfirmOpen(false);
    }
  };

  const handleToggleReaction = async (emoji: string) => {
    if (!currentUserId || !message.id) return;
    onToggleReaction?.(message.id, emoji);
  };

  const groupedReactions = useMemo(() => {
    const groups: Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }> = {};

    (message.reactions || []).forEach((r) => {
      if (!groups[r.emoji]) {
        groups[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasReacted: false };
      }
      groups[r.emoji].count++;
      const displayName = r.userId === currentUserId ? "Anda" : (r.user?.username || "Seseorang");
      groups[r.emoji].users.push(displayName);
      if (r.userId === currentUserId) {
        groups[r.emoji].hasReacted = true;
      }
    });

    // Sort so "Anda" is first
    Object.values(groups).forEach(g => {
      g.users.sort((a, b) => (a === "Anda" ? -1 : b === "Anda" ? 1 : 0));
    });

    return Object.values(groups);
  }, [message.reactions, currentUserId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || "");
    toast.success("Teks disalin");
    setShowMobileActions(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatFullDate = (date: Date) =>
    date.toLocaleString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (date: Date) => {
    const isToday = (d: Date) => {
      const now = new Date();
      return d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
    };

    const time = formatTime(date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Kemarin ${time}`;
    }
    if (!isToday(date)) {
      const dateStr = date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      });
      return `${dateStr}, ${time}`;
    }
    return time;
  };

  // Custom emojis check (Misskey/Pleroma style :shortcode:)
  // We allow multiple shortcodes but nothing else
  const messageIsOnlyEmoji = useMemo(() => {
    const str = message.content;
    if (!str) return false;
    const cleanStr = str.replace(WHITESPACE_REGEX, "");
    if (!cleanStr) return false;
    if (CUSTOM_EMOJI_ONLY_REGEX.test(cleanStr)) return true;

    // Modern regex using Unicode property escapes to match all emojis,
    // including ZWJ sequences, modifiers, and variation selectors.
    // We filter out digits/text if they aren't part of an emoji sequence.
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji_Modifier_Base}|\p{Emoji_Modifier}|\p{Emoji_Component}|[\u200D\uFE0F])*$/u;

    // Hardening: make sure it's not JUST numbers or punctuation that happen to have emoji properties
    const hasActualEmoji = EXTENDED_PICTOGRAPHIC_REGEX.test(cleanStr);

    return (emojiRegex.test(cleanStr) && hasActualEmoji) || CUSTOM_EMOJI_ONLY_REGEX.test(cleanStr);
  }, [message.content]);

  // A message made of exactly one custom emoji is shown as a sticker: large,
  // with no bubble or text line around it.
  const isSticker = useMemo(() => {
    const clean = (message.content || "").replace(WHITESPACE_REGEX, "");
    return /^:[a-zA-Z0-9_-]+:$/.test(clean);
  }, [message.content]);

const isImage = (url: string) => {
    return IMAGE_REGEX.test(url) || url.startsWith('data:image/');
};

const isVideo = (url: string) => {
    return VIDEO_REGEX.test(url) || url.startsWith('data:video/');
};

const getFileName = (url: string) => {
    try {
        const parts = url.split('/');
        const lastPart = parts[parts.length - 1];
        return lastPart.replace(LEADING_DIGITS_REGEX, '');
    } catch {
        return 'Attachment';
    }
};

  const getProxiedUrl = (url: string) => {
    if (!url) return "";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://komunikasi.qzz.io";
    if (url.startsWith("/") || 
        url.startsWith(window.location.origin) || 
        url.startsWith(baseUrl) ||
        url.includes("/api/media-proxy")) {
        return url;
    }
    return `/api/media-proxy?url=${encodeURIComponent(url)}`;
  };

  const imagesAndVideos = useMemo(() => {
    return (message.attachments || [])
      .filter(a => isImage(a.url) || isVideo(a.url))
      .map(a => ({
        url: getProxiedUrl(a.url),
        filename: getFileName(a.url),
        type: isVideo(a.url) ? 'video' : 'image'
      }));
  }, [message.attachments]);

  const otherFiles = useMemo(() => {
    return (message.attachments || []).filter(a => !isImage(a.url) && !isVideo(a.url));
  }, [message.attachments]);

  const openLightbox = (index: number) => {
    setInitialImageIndex(index);
    setLightboxOpen(true);
  };

  const socialEmbeds = useMemo(() => {
    if (!message.content) return [];

    const urls = extractUrls(message.content);

    const embeds: React.ReactNode[] = [];
    
    // STRICT MANDATE: Only ONE link preview per message (focus on the first content link)
    if (urls.length > 0) {
      const url = urls[0];
      const ytMatch = url.match(YOUTUBE_REGEX);
      if (ytMatch) {
        embeds.push(<YouTubeEmbed key={url} videoId={ytMatch[1]} />);
      } else {
        const xMatch = url.match(X_REGEX);
        if (xMatch) {
          embeds.push(<XEmbed key={url} tweetUrl={url} />);
        }
      }

      // Show indicator for other links
      if (urls.length > 1) {
        embeds.push(
          <div key="more-links" className="text-[10px] text-muted-foreground/40 ml-1 py-1 italic">
            +{urls.length - 1} tautan lainnya
          </div>
        );
      }
    }

    return embeds;
  }, [message.content]);

  const participantsById = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of roomData?.participants ?? []) {
      if (p?.user?.id) map.set(p.user.id, p);
    }
    return map;
  }, [roomData?.participants]);

  const resolveMentionsForView = useCallback((content: string) => {
    if (!content) return "";
    // Discord behavior: Preserve leading newlines, but trim trailing ones.
    const trimmedContent = content.replace(/\n+$/, "");
    const mentionBlocks: string[] = [];
    let processed = trimmedContent.replace(/<@([a-zA-Z0-9_-]+)>/g, (match, uid) => {
      let resolved = "";
      if (uid === "everyone") {
        resolved = "[@everyone](#mention:everyone)";
      } else {
        const participant = participantsById.get(uid);
        resolved = participant ? `[@${participant.user.username}](#mention:${uid})` : `@${uid}`;
      }
      mentionBlocks.push(resolved);
      return `__MENTION_BLOCK_${mentionBlocks.length - 1}__`;
    });

    // --- DISCORD MARKDOWN FIXES ---
    // 0. Extract Code Blocks (triple backticks) to protect them from regex modifications
    const blockCodes: string[] = [];
    processed = processed.replace(/```[\s\S]*?```/g, (match) => {
      let normalized = match;
      if (!normalized.match(/\n```$/)) {
        normalized = normalized.replace(/```$/, "\n```");
      }
      blockCodes.push(normalized);
      return `__BLOCK_CODE_${blockCodes.length - 1}__`;
    });

    // 0b. User-typed HTML renders as text, never as markup.
    processed = escapeUserHtml(processed);

    // 1. Allow single backticks (inline code) to span multiple lines safely
    processed = processed.replace(/(?<!`)`([^`]+)`(?!`)/g, (match, inner) => {
      return '`' + inner.replace(/\n/g, '\uE000').replace(/ /g, '\u00A0') + '`';
    });

    // 3. Preserve leading spaces
    processed = processed.replace(/^( +)(?![-*>] |\d+\. )/gm, (match) =>
      '\u00A0'.repeat(match.length)
    );

    // --- GREEN TEXT (IMAGEBOARD STYLE) ---
    // Process each line. If it starts with '>', wrap it in a span with green styling.
    // We do this BEFORE restoring code blocks to avoid matching lines inside them.
    const lines = processed.split('\n');
    processed = lines.map(line => {
      // Imageboard behavior: '>' must be at the very start of the line (or after our space padding)
      const trimmedLine = line.replace(/^\u00A0+/, '');
      if (trimmedLine.startsWith('>') && !trimmedLine.startsWith('>>>')) {
        return `<span class="text-[#789922] dark:text-[#B5BD68] greentext">${line}</span>`;
      }
      return line;
    }).join('\n');

    // 4. Fix multiline wrapping for TextB/TextItalic/Strike
    processed = processed.replace(/(\*\*\*|\*\*|\*|___|__|~~|_)([\s\S]+?)\1/g, (match, sep, inner) => {
      if (inner.includes('\n')) {
        return `${sep}\u200B${inner}\u200B${sep}`;
      }
      return match;
    });

    // 5. Restore Code Blocks
    processed = processed.replace(/__BLOCK_CODE_(\d+)__/g, (match, p1) => {
      return `\n\n${blockCodes[parseInt(p1, 10)]}\n\n`;
    });

    // 6. Restore Mentions (Last step so markdown doesn't mess with (_) or other chars in links)
    processed = processed.replace(/__MENTION_BLOCK_(\d+)__/g, (match, p1) => {
      return mentionBlocks[parseInt(p1, 10)];
    });

    return processed;
  }, [participantsById]);

  const customEmojis = useCustomEmojis();
  const emojiMeta = useMemo(() => customEmojis.map(e => ({ name: e.shortcode, url: e.url })), [customEmojis]);
  const emojiMap = useMemo(() => {
    const map = new Map<string, string>();
    customEmojis.forEach(e => map.set(`:${e.shortcode}:`, e.url));
    return map;
  }, [customEmojis]);

  const renderReactionEmoji = (emoji: string) => {
    const url = emojiMap.get(emoji);
    if (url) {
      return <img src={url} alt={emoji} className="w-[18px] h-[18px] object-contain" />;
    }
    return <>{emoji}</>;
  };

  const viewContent = useMemo(() => {
    if (!message.content) return "";
    return parseFediverseContent(resolveMentionsForView(message.content), emojiMeta);
  }, [message.content, resolveMentionsForView, emojiMeta]);

  const renderContent = (content: string) => {
    if (!content) return null;

    return (
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={markdownComponentsWithOverrides}
      >
        {viewContent}
      </ReactMarkdown >
    );
  };

  const markdownComponents = useMemo(() => ({
    ...STATIC_MARKDOWN_COMPONENTS,
    a: ({ node, href, children, ...props }: any) => {
      if (href?.startsWith('#mention:')) {
        const uid = href.replace('#mention:', '');

        if (uid === "everyone") {
          return (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span className="text-primary bg-primary/12 px-[3px] rounded-[4px] font-medium cursor-default">
                    {children}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs py-1 px-2">
                  <p>Menyebut semua anggota channel</p>
                </TooltipContent>
              </Tooltip>
          );
        }

        const participant = participantsById.get(uid);

        if (!participant) {
          return (
            <span className="text-muted-foreground bg-muted px-[3px] rounded-[4px] font-medium cursor-default">
              {children}
            </span>
          );
        }

        return (
          <ProfileHoverCard
            user={{
              id: participant.user.id,
              username: participant.user.username,
              avatar: participant.user.avatar,
              banner: participant.user.banner,
              bio: participant.user.bio,
              customStatus: participant.user.customStatus,
            }}
            isOnline={onlineUserIds.includes(participant.user.id)}
            currentUserId={currentUserId}
            onStartDM={handleStartDM}
          >
            <span
              className={cn(
                "cursor-pointer px-[3px] rounded-[4px] font-medium transition-colors",
                uid === currentUserId
                  ? "text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25"
                  : "text-primary bg-primary/12 hover:bg-primary/20"
              )}
            >
              {children}
            </span>
          </ProfileHoverCard>
        );
      }
      return (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </a>
      );
    },
  }), [participantsById, onlineUserIds, currentUserId, handleStartDM]);

  const markdownComponentsWithOverrides = useMemo(
    () => ({ ...markdownComponents, ...MARKDOWN_CODE_COMPONENTS }),
    [markdownComponents],
  );

  const isOnline = onlineUserIds.includes(message.userId);
  const [isHovered, setIsHovered] = useState(false);

  // A reply always opens a new visual group, even inside a run of messages from
  // the same sender, so the quoted line has a header to hang from.
  const showHeader = !isContinuation || !!message.replyToMessage;

  const mentionsMe = useMemo(() => {
    if (!message.content || message.userId === currentUserId) return false;
    return message.content.includes(`<@${currentUserId}>`) || message.content.includes("<@everyone>");
  }, [message.content, message.userId, currentUserId]);

  const authorProfile = {
    id: message.userId,
    username: message.user?.username || "Unknown",
    name: message.user?.name,
    avatar: message.user?.avatar || "/avatars/avatar1.png",
    banner: message.user?.banner,
    bio: message.user?.bio,
    customStatus: message.user?.customStatus,
  };

  const replyPreview = useMemo(() => {
    const reply = message.replyToMessage;
    if (!reply) return null;
    const text = (reply.content || "")
      .replace(/<@([a-zA-Z0-9_-]+)>/g, (match, uid) => {
        if (uid === "everyone") return "@everyone";
        const p = participantsById.get(uid);
        return p ? `@${p.user.username}` : "@pengguna";
      })
      .replace(/```[\s\S]*?```/g, "[kode]")
      .replace(/[*_~`]/g, "")
      .replace(/\n+/g, " ")
      .trim();
    return truncate(text, 120);
  }, [message.replyToMessage, participantsById]);

  const createdAt = new Date(message.createdAt);

  return (
    <div
      className={cn(
        "relative group px-3 sm:px-4 cursor-default",
        showHeader
          ? cn("pt-1.5 pb-0.5 first:mt-0", isAfterSeparator ? "mt-0.5" : "mt-3")
          : "py-px",
        "hover:bg-muted/40",
        mentionsMe && "bg-amber-500/[0.07] hover:bg-amber-500/10 shadow-[inset_2px_0_0_#f59e0b]",
        isHighlighted && "bg-primary/10 hover:bg-primary/10 shadow-[inset_2px_0_0_var(--primary)]",
        showMobileActions && isMobile && "bg-muted/50",
        isEditing && "bg-muted/40",
        message.isOptimistic && !message.sendError && "opacity-60"
      )}
      onClick={() => {
        if (isMobile && !isEditing) setShowMobileActions(!showMobileActions);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Quoted message, Discord-style: a thin spine from the avatar column
          curls into a one-line preview of the message being answered. */}
      {message.replyToMessage && (
        <div className="relative flex items-center gap-1.5 pl-12 mb-0.5 min-w-0 h-[18px] text-xs">
          <span
            aria-hidden
            className="absolute left-[17px] top-[9px] h-[11px] w-[26px] rounded-tl-md border-l-2 border-t-2 border-border"
          />
          <button
            type="button"
            className="flex items-center gap-1.5 min-w-0 text-left text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (message.replyTo) onScrollToMessage?.(message.replyTo);
            }}
          >
            <UserAvatar
              src={
                roomData?.participants?.find((p: any) => p.user.username === message.replyToMessage?.user?.username)?.user.avatar
                || "/avatars/avatar1.png"
              }
              alt={message.replyToMessage.user?.username}
              className="h-4 w-4 rounded-full shrink-0"
            />
            <span className="font-medium text-foreground/80 shrink-0">
              {message.replyToMessage.user?.name || message.replyToMessage.user?.username || "pengguna"}
            </span>
            <span className="truncate">
              {replyPreview || <span className="italic">Klik untuk melihat lampiran</span>}
            </span>
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
      <div className="relative w-9 shrink-0 flex justify-center">
        {showHeader ? (
          <ProfileHoverCard
            user={authorProfile}
            isOnline={isOnline}
            currentUserId={currentUserId}
            onStartDM={handleStartDM}
          >
            <UserAvatar
              src={authorProfile.avatar}
              alt={message.user?.username}
              className="mt-0.5 w-9 h-9 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
            />
          </ProfileHoverCard>
        ) : (
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "text-[10px] leading-[22px] tabular-nums text-muted-foreground select-none opacity-0 group-hover:opacity-100",
                  isHovered && "opacity-100"
                )}
              >
                {formatTime(createdAt)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs py-1 px-2">
              {formatFullDate(createdAt)}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="flex items-baseline gap-2 min-w-0">
            <ProfileHoverCard
              user={authorProfile}
              isOnline={isOnline}
              currentUserId={currentUserId}
              onStartDM={handleStartDM}
            >
              <span className="cursor-pointer truncate text-sm font-semibold text-foreground hover:underline underline-offset-2">
                {message.user?.name || message.user?.username || "Pengguna"}
              </span>
            </ProfileHoverCard>

            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <time
                  dateTime={createdAt.toISOString()}
                  className="shrink-0 text-[11px] tabular-nums text-muted-foreground cursor-default"
                >
                  {message.sendError ? formatTimestamp(createdAt) : message.isOptimistic ? "Mengirim…" : formatTimestamp(createdAt)}
                </time>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs py-1 px-2">
                {formatFullDate(createdAt)}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* === INLINE EDIT MODE === */}
        {isEditing ? (
          <div className="mt-1 mb-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <MentionTextarea
                value={editContent}
                onChange={(val) => setEditContent(val)}
                onSubmit={handleSaveEdit}
                onKeyDown={handleEditKeyDown}
                className="w-full bg-background border border-border rounded-lg focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/15 min-h-[40px] max-h-[300px] pr-10"
                maxHeight={300}
                roomData={roomData!}
                currentUserId={currentUserId}
                autoFocus
              />
              <div className="absolute right-1.5 bottom-1.5">
                <EmojiPickerComponent
                  onEmojiSelect={(emoji) => setEditContent((prev) => prev + emoji)}
                  triggerClassName="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <kbd className="font-sans font-medium text-foreground/80">Esc</kbd> untuk{" "}
              <button onClick={onCancelEdit} className="text-primary hover:underline">batal</button>
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              <kbd className="font-sans font-medium text-foreground/80">Enter</kbd> untuk{" "}
              <button onClick={handleSaveEdit} disabled={isSavingEdit} className="text-primary hover:underline disabled:opacity-50">
                {isSavingEdit ? "menyimpan…" : "simpan"}
              </button>
            </p>
          </div>
        ) : (
          /* === NORMAL VIEW MODE === */
          message.content && (
            <div
              className={cn(
                "break-words min-w-0 max-w-full text-foreground",
                isSticker
                  ? "py-1 [&_p]:m-0 [&_img.fediverse-emoji]:!h-28 [&_img.fediverse-emoji]:!w-28 [&_img.fediverse-emoji]:!m-0"
                  : messageIsOnlyEmoji
                    ? "text-[2.5rem] leading-tight py-0.5"
                    : "text-sm leading-[1.45]"
              )}
            >
              {renderContent(message.content)}
              {isEdited && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <span className="ml-1 align-baseline text-[10px] text-muted-foreground cursor-default select-none">
                      (diedit)
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs py-1 px-2">
                    Diedit {formatEditedTime(new Date(message.updatedAt))}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )
        )}

        {/* Embeds & attachments come before reactions so reactions always
            sit at the bottom of the message, like every other chat app. */}
        {socialEmbeds.length > 0 && (
          <div className="flex flex-col gap-1">
            {socialEmbeds}
          </div>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1 mb-0.5 max-w-[480px]">
            {imagesAndVideos.length > 0 && (
              <div className={cn(
                "grid gap-0.5 overflow-hidden rounded-lg",
                imagesAndVideos.length === 1 ? "grid-cols-1 w-fit max-w-full sm:max-w-sm" : "grid-cols-2",
              )}>
                {imagesAndVideos.slice(0, 4).map((item, idx) => (
                  <button
                    type="button"
                    key={item.url}
                    className={cn(
                      "group/media relative overflow-hidden bg-muted cursor-zoom-in",
                      imagesAndVideos.length === 1 ? "max-h-[360px]" : "aspect-square",
                      imagesAndVideos.length === 3 && idx === 0 && "col-span-2 aspect-[2/1]",
                    )}
                    onClick={(e) => { e.stopPropagation(); openLightbox(idx); }}
                  >
                    {item.type === 'video' ? (
                      <>
                        <video
                          src={item.url}
                          className={cn("block object-cover", imagesAndVideos.length === 1 ? "max-h-[360px] w-auto max-w-full" : "h-full w-full")}
                          preload="metadata"
                        />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
                            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z" />
                            </svg>
                          </span>
                        </span>
                      </>
                    ) : (
                      <img
                        src={item.url}
                        alt={item.filename}
                        loading="lazy"
                        className={cn("block object-cover", imagesAndVideos.length === 1 ? "max-h-[360px] w-auto max-w-full" : "h-full w-full")}
                      />
                    )}
                    <span className="absolute inset-0 bg-black/0 group-hover/media:bg-black/10 transition-colors" />
                    {imagesAndVideos.length > 4 && idx === 3 && (
                      <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-lg font-semibold">
                        +{imagesAndVideos.length - 4}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {otherFiles.length > 0 && (
              <div className="flex flex-col gap-1">
                {otherFiles.map((attachment) => {
                  const name = getFileName(attachment.url);
                  const ext = name.includes(".") ? name.split(".").pop()!.slice(0, 4) : "file";
                  return (
                    <div key={attachment.id} className="group/file flex items-center gap-3 py-2 pl-2 pr-1.5 rounded-lg border border-border bg-background hover:bg-muted/40 transition-colors max-w-sm">
                      <div className="h-9 w-9 rounded-md bg-muted flex flex-col items-center justify-center shrink-0 text-muted-foreground">
                        <File className="h-4 w-4" />
                        <span className="text-[8px] font-semibold uppercase leading-none mt-0.5">{ext}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block text-[13px] font-medium truncate text-foreground hover:underline"
                        >
                          {name}
                        </a>
                        <p className="text-[11px] text-muted-foreground">
                          {formatSize(attachment.size) ?? "Lampiran"}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                        <a href={attachment.url} download={name} aria-label={`Unduh ${name}`}>
                          <DownloadSimple className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Reactions */}
        {groupedReactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1 mb-0.5">
            {groupedReactions.map((group) => {
              const others = group.users.length - 3;
              const who = group.users.slice(0, 3).join(", ") + (others > 0 ? ` dan ${others} lainnya` : "");
              return (
                <Tooltip key={group.emoji} delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleReaction(group.emoji); }}
                      aria-pressed={group.hasReacted}
                      className={cn(
                        "flex items-center gap-1 h-6 pl-1.5 pr-2 rounded-full text-xs border select-none transition-colors active:scale-95",
                        group.hasReacted
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-muted/50 border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                    >
                      <span className="text-[15px] leading-none flex items-center justify-center min-w-4">
                        {renderReactionEmoji(group.emoji)}
                      </span>
                      <span className="font-medium tabular-nums text-[11px]">{group.count}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none shrink-0">{renderReactionEmoji(group.emoji)}</span>
                      <p className="text-xs leading-snug">
                        <span className="font-medium">{who}</span> bereaksi
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}

            <div
              className={cn(
                "transition-opacity duration-150",
                isHovered || (isMobile && showMobileActions) ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <EmojiPickerComponent
                onEmojiSelect={handleToggleReaction}
                triggerClassName="h-6 w-7 rounded-full bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                triggerSize="sm"
              />
            </div>
          </div>
        )}

        {message.sendError && (
          <div className="mt-0.5 flex items-center gap-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
            <WarningCircle weight="fill" className="h-3.5 w-3.5 text-destructive shrink-0" />
            <span className="text-destructive">Gagal terkirim</span>
            <span className="text-muted-foreground/50">·</span>
            <button type="button" onClick={() => onRetrySend?.(message)} className="font-medium text-foreground hover:underline">
              Coba lagi
            </button>
            <span className="text-muted-foreground/50">·</span>
            <button type="button" onClick={() => onDiscardSend?.(message)} className="text-muted-foreground hover:text-foreground hover:underline">
              Hapus
            </button>
          </div>
        )}

        {/* Hover toolbar (desktop) / tap-to-reveal toolbar (mobile) */}
        {!isEditing && !message.isOptimistic && (
          <div
            className={cn(
              "absolute -top-4 right-3 sm:right-4 z-10 transition-opacity duration-100",
              isMobile
                ? (showMobileActions ? "opacity-100" : "opacity-0 pointer-events-none")
                : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto has-[[data-state=open]]:opacity-100 has-[[data-state=open]]:pointer-events-auto"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center bg-popover border border-border rounded-md shadow-sm p-0.5">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleToggleReaction(emoji)}
                  className="h-7 w-7 rounded flex items-center justify-center text-base hover:bg-muted transition-colors"
                  aria-label={`Reaksi ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <span className="mx-0.5 h-4 w-px bg-border" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <EmojiPickerComponent
                      onEmojiSelect={handleToggleReaction}
                      triggerClassName="h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs py-1 px-2">Tambah reaksi</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onReply(message)}
                    className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Balas"
                  >
                    <ArrowBendUpLeft className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs py-1 px-2">Balas</TooltipContent>
              </Tooltip>
              {message.content && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label="Salin teks"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs py-1 px-2">Salin teks</TooltipContent>
                </Tooltip>
              )}

              {message.userId === currentUserId && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onStartEdit(message)}
                        className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Edit"
                      >
                        <PencilSimple className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs py-1 px-2">Edit</TooltipContent>
                  </Tooltip>

                  <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            disabled={isDeleting}
                            className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            aria-label="Hapus"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs py-1 px-2">Hapus</TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus pesan ini?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Pesan akan dihapus untuk semua orang dan tidak bisa dikembalikan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => { e.preventDefault(); handleDelete(); }}
                          disabled={isDeleting}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          {isDeleting ? "Menghapus…" : "Hapus"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={imagesAndVideos as any}
          initialIndex={initialImageIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}
    </div>
  );
}

export const MessageItem = memo(MessageItemComponent);
