/**
 * Heuristics for "is this pasted text code?" and "which language?", used to
 * wrap code pasted into the composer in a ``` fence automatically.
 *
 * Deliberately conservative: prose must never be turned into a code block, so
 * single lines never qualify and most lines must carry a code signal.
 */

const KEYWORD_LINE =
  /^\s*(import|export|from|const|let|var|function|async|await|return|if|else|elif|for|while|switch|case|try|catch|finally|class|interface|type|enum|def|fn|func|pub|use|package|public|private|protected|static|#include|#define|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH|echo|sudo|npm|pnpm|yarn|git|docker|cd|ls|curl)\b/;
// Line endings that mean code. Deliberately not ")" (emoticons like ":)" and
// "(besok)" asides end chat lines all the time), not "," (prose) and not a bare
// ":" (prose like "cek ini:"); calls and keys are caught by the patterns below.
const CODE_END = /[;{}[\]]\s*$|=>\s*$/;
const CODE_TOKENS = /(=>|===|!==|::|->|\+\+|&&|\|\||\/\/|\/\*|<\/\w+>|\w\(.*\)|\{\s*$|^\s*[}\])])/;
/** A lone key opening a block: "scripts:", "def f():" is caught by the call pattern. */
const BLOCK_KEY = /^\s*[\w.-]+:\s*$/;
const URL = /\bhttps?:\/\/\S+/g;

export function looksLikeCode(text: string): boolean {
  const trimmed = text.replace(/\s+$/, "");
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return false;
  if (isJson(trimmed)) return true;

  let signals = 0;
  let prose = 0;
  let counted = 0;
  for (const raw of lines) {
    // URLs ("//", ":") are not code signals; a line that is only a link is
    // neutral and does not count either way.
    const line = raw.replace(URL, "").replace(/\s+$/, "");
    if (line.trim().length === 0) continue;
    counted++;
    const isIndented = /^(\t| {2,})\S/.test(line);
    const isCodey =
      KEYWORD_LINE.test(line) || CODE_END.test(line) || CODE_TOKENS.test(line) || BLOCK_KEY.test(line);
    if (isCodey || isIndented) signals++;
    // Sentences: several words and ending in sentence punctuation.
    if (/^[A-Za-zÀ-ÿ"'(]/.test(line.trim()) && /[.!?]["')]?\s*$/.test(line) && line.trim().split(/\s+/).length >= 5) prose++;
  }
  if (counted < 2) return false;
  return signals >= 2 && signals / counted >= 0.5 && prose / counted < 0.4;
}

function isJson(text: string) {
  const t = text.trim();
  if (!/^[[{]/.test(t)) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

const VSCODE_MODE_MAP: Record<string, string> = {
  typescriptreact: "tsx",
  javascriptreact: "jsx",
  typescript: "ts",
  javascript: "js",
  shellscript: "bash",
  plaintext: "",
};

/**
 * Code copied from a web page or an IDE that puts HTML on the clipboard
 * (GitHub, StackOverflow, docs sites, JetBrains IDEs) arrives inside <pre> or
 * <code>, usually with the language in a class. That is a far surer signal
 * than guessing from the text. Returns null when the HTML is not a code block,
 * otherwise the language ("" when it does not say).
 */
export function codeFromHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  // The whole selection has to be code: a <code> span inside a paragraph of
  // prose (inline code in an article) does not count.
  const body = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^[\s\S]*?<body[^>]*>/i, "")
    .replace(/<\/body>[\s\S]*$/i, "")
    .replace(/<meta[^>]*>/gi, "")
    .trim();
  const isPre = /^(<(div|span)[^>]*>\s*)*<pre[\s>]/i.test(body);
  const isCodeOnly = /^(<(div|span)[^>]*>\s*)*<code[\s>][\s\S]*<\/code>(\s*<\/(div|span)>)*$/i.test(body);
  // GitHub file view: a table of lines with this class.
  const isGitHubBlob = /class="[^"]*\bblob-code\b/.test(body);
  if (!isPre && !isCodeOnly && !isGitHubBlob) return null;
  const lang =
    body.match(/class="[^"]*\b(?:language|lang)-([\w+#-]+)/i)?.[1] ??
    body.match(/class="[^"]*\bhighlight-source-([\w+#-]+)/i)?.[1] ??
    "";
  return VSCODE_MODE_MAP[lang.toLowerCase()] ?? lang.toLowerCase();
}

/** Language from VS Code's clipboard metadata, if the paste came from VS Code. */
export function languageFromVsCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const mode = JSON.parse(raw)?.mode;
    if (typeof mode !== "string") return null;
    return VSCODE_MODE_MAP[mode] ?? mode.toLowerCase();
  } catch {
    return null;
  }
}

/** Best-effort language guess for the fence label; "" when unsure. */
export function guessLanguage(text: string): string {
  const t = text.trim();
  if (isJson(t)) return "json";
  if (/^\s*<(!doctype|html|div|span|template|svg|\w+[\s>])/i.test(t) && /<\/\w+>/.test(t)) return "html";
  if (/^\s*(def |class \w+.*:|from \w+ import|import \w+$)/m.test(t) && /:\s*$/m.test(t)) return "python";
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH)\b/im.test(t)) return "sql";
  if (/^\s*(#include|int main\s*\()/m.test(t)) return "cpp";
  if (/^\s*package \w+/m.test(t) && /\bfunc\b/.test(t)) return "go";
  if (/^\s*(fn |use |let mut )/m.test(t)) return "rust";
  if (/^\s*(\$ |sudo |npm |pnpm |yarn |git |docker |cd |ls )/m.test(t)) return "bash";
  if (/:\s*(string|number|boolean)\b|interface \w+|type \w+ =|<\w+>\(/.test(t)) return "ts";
  if (/\b(const|let|function|=>|import .* from)\b/.test(t)) return "js";
  if (/^\s*[.#]?[\w-]+\s*\{[\s\S]*:\s*[^;]+;/m.test(t)) return "css";
  return "";
}
