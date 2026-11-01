import { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";

/**
 * What chat markdown may render after `rehype-raw`.
 *
 * Messages go through rehype-raw only so that markup *we* inject survives:
 *   - greentext lines:   <span class="greentext ...">
 *   - custom emoji:      <img class="fediverse-emoji ..." src=... alt=":name:">
 * User-typed `<` is already escaped before parsing (see escapeUserHtml), so
 * this schema is the second line of defence: GitHub's default allow-list
 * (no script/style/iframe, no event handlers, http(s)/mailto links only) plus
 * the class names above.
 */
export const CHAT_SANITIZE_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  // Keep the ids/names markdown generates usable without a prefix clash.
  clobberPrefix: "msg-",
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", "greentext", /^text-\[#[0-9A-Fa-f]{6}\]$/, /^dark:text-\[#[0-9A-Fa-f]{6}\]$/],
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      ["className", "fediverse-emoji", "inline-block", /^h-\[[\d.]+em\]$/, /^w-\[[\d.]+em\]$/, "align-text-bottom"],
    ],
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-[\w+#-]+$/]],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), "span"],
};

/**
 * Escape `<` the user typed so raw HTML shows as text, as in Discord/Telegram
 * (`#include <iostream>` stays visible instead of becoming an unknown tag).
 * Inline code is left alone: markdown already treats it as literal text, and an
 * escaped entity inside backticks would show as "&lt;". Fenced blocks must be
 * swapped out by the caller before this runs.
 */
export function escapeUserHtml(text: string) {
  return text.replace(/(`+)([\s\S]*?)\1|</g, (match, ticks) => (ticks ? match : "&lt;"));
}
