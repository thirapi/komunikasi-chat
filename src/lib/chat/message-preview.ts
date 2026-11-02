import { stripMarkdown } from "@/lib/strip-markdown";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|ogv)(\?|$)/i;
const AUDIO_EXT = /\.(weba|m4a|mp3|oga|opus|wav|aac)(\?|$)/i;

/**
 * Chat-list label for a message that is only an attachment. Shared by the
 * live preview and the server's sidebar query so both read the same.
 */
export function attachmentLabel(url: string, fileType?: string | null) {
  const type = fileType ?? "";
  if (type.startsWith("audio/") || AUDIO_EXT.test(url)) return "🎤 Pesan suara";
  if (type.startsWith("image/") || IMAGE_EXT.test(url)) return "📷 Foto";
  if (type.startsWith("video/") || VIDEO_EXT.test(url)) return "🎬 Video";
  return "📁 File";
}

/**
 * One-line sidebar preview for a message, matching what the server's sidebar
 * query produces (get-sidebar-data.use-case.ts) so live updates and reloads
 * look the same.
 */
export function messagePreview(
  message: { content?: string | null; attachments?: { url: string; fileType?: string | null }[] | null },
  me?: { id: string; username: string },
) {
  let content = message.content || "";
  if (me) content = content.replaceAll(`<@${me.id}>`, `@${me.username}`);
  const text = stripMarkdown(content);
  if (text) return text;
  const first = message.attachments?.[0];
  if (!first) return "";
  return attachmentLabel(first.url, first.fileType);
}
