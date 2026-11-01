/**
 * Heuristics for "is this pasted text code?" and "which language?", used to
 * wrap code pasted into the composer in a ``` fence automatically.
 *
 * Deliberately conservative: prose must never be turned into a code block, so
 * single lines never qualify and most lines must carry a code signal.
 */

const KEYWORD_LINE =
  /^\s*(import|export|from|const|let|var|function|async|await|return|if|else|elif|for|while|switch|case|try|catch|finally|class|interface|type|enum|def|fn|func|pub|use|package|public|private|protected|static|#include|#define|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH|echo|sudo|npm|pnpm|yarn|git|docker|cd|ls|curl)\b/;
const CODE_END = /[;{}()[\],:]\s*$|=>\s*$/;
const CODE_TOKENS = /(=>|===|!==|::|->|\+\+|&&|\|\||\/\/|\/\*|<\/\w+>|\w+\(.*\)|\{\s*$|^\s*[}\])])/;

export function looksLikeCode(text: string): boolean {
  const trimmed = text.replace(/\s+$/, "");
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return false;
  if (isJson(trimmed)) return true;

  let signals = 0;
  let prose = 0;
  for (const line of lines) {
    const isIndented = /^(\t| {2,})\S/.test(line);
    const isCodey = KEYWORD_LINE.test(line) || CODE_END.test(line) || CODE_TOKENS.test(line);
    if (isCodey || isIndented) signals++;
    // Sentences: several words and ending in sentence punctuation.
    if (/^[A-Za-zÀ-ÿ"'(]/.test(line.trim()) && /[.!?]["')]?\s*$/.test(line) && line.trim().split(/\s+/).length >= 5) prose++;
  }
  return signals >= 2 && signals / lines.length >= 0.5 && prose / lines.length < 0.4;
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
