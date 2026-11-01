"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
} from "lexical";
import { toast } from "sonner";
import { codeFromHtml, guessLanguage, languageFromVsCode, looksLikeCode } from "@/lib/chat/code-detect";

/**
 * Paste code → ``` fenced block, automatically.
 *
 * Triggers when the clipboard comes from VS Code (it adds `vscode-editor-data`,
 * which also tells us the language), when its HTML is a <pre>/<code> block
 * (GitHub, StackOverflow, docs, JetBrains IDEs), or when the text clearly
 * looks like code.
 * The fence is inserted as plain markdown, consistent with the editor's
 * "markdown is always text" model, so Ctrl/⌘+Z restores the raw paste.
 * Skipped when the caret is already inside a fence or the text has its own.
 */
export function CodePastePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (typeof ClipboardEvent === "undefined" || !(event instanceof ClipboardEvent)) return false;
        const data = event.clipboardData;
        if (!data || data.files.length > 0) return false;

        const text = data.getData("text/plain");
        if (!text || text.includes("```")) return false;

        const multiLine = /\n/.test(text.trim());
        // Explicit sources say "this is code"; they still need several lines,
        // a single line stays inline text.
        const vscodeLang = languageFromVsCode(data.getData("vscode-editor-data"));
        const htmlLang = vscodeLang === null ? codeFromHtml(data.getData("text/html")) : null;
        const sourceLang = vscodeLang ?? htmlLang;
        const isCode = sourceLang !== null ? multiLine : looksLikeCode(text);
        if (!isCode) return false;

        // Already inside an open fence? Then paste as-is.
        let insideFence = false;
        editor.getEditorState().read(() => {
          insideFence = (($getRoot().getTextContent().match(/```/g) || []).length % 2) === 1;
        });
        if (insideFence) return false;

        const lang = sourceLang || guessLanguage(text);
        const body = text.replace(/\r\n/g, "\n").replace(/\n+$/, "");

        event.preventDefault();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          // The fence must start on its own line.
          const anchor = selection.anchor.getNode();
          const before = $isTextNode(anchor) ? anchor.getTextContent().slice(0, selection.anchor.offset) : "";
          const needsBreak = before.length > 0 && !before.endsWith("\n");
          selection.insertRawText(`${needsBreak ? "\n" : ""}\`\`\`${lang}\n${body}\n\`\`\`\n`);
        });

        toast("Ditempel sebagai blok kode", {
          description: "Tekan Ctrl/⌘+Z untuk menempel sebagai teks biasa.",
          duration: 3000,
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
