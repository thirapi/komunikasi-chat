import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { CHAT_SANITIZE_SCHEMA, escapeUserHtml } from "@/lib/chat/markdown-sanitize";

const render = (md: string) =>
  renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, CHAT_SANITIZE_SCHEMA]] as any}>{md}</ReactMarkdown>
  );

describe("chat markdown sanitize", () => {
  it("shows user html as text", () => {
    const out = render(escapeUserHtml("#include <iostream> <img src=x onerror=alert(1)> <script>alert(1)</script>"));
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<script");
    expect(out).toContain("&lt;iostream&gt;");
  });
  it("keeps inline code literal", () => {
    expect(render(escapeUserHtml("`<b>x</b>`"))).toContain("<code>&lt;b&gt;x&lt;/b&gt;</code>");
  });
  it("keeps injected emoji and greentext, strips handlers", () => {
    const out = render('<span class="text-[#789922] dark:text-[#B5BD68] greentext">&gt;hi</span> <img src="https://e/x.png" alt=":x:" class="fediverse-emoji inline-block h-[1.2em] w-[1.2em] align-text-bottom" onerror="alert(1)" />');
    expect(out).toContain('class="text-[#789922] dark:text-[#B5BD68] greentext"');
    expect(out).toContain('class="fediverse-emoji');
    expect(out).not.toContain("onerror");
  });
  it("blocks javascript links but keeps mention links", () => {
    const out = render("[a](javascript:alert(1)) [@bob](#mention:u1)");
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="#mention:u1"');
  });
});
