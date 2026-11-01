import { stripMarkdown } from "@/lib/strip-markdown";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i;

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
  const isImage = first.fileType?.startsWith("image/") || IMAGE_EXT.test(first.url);
  return isImage ? "📷 Foto" : "📁 File";
}
