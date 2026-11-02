/**
 * Pull a link preview (title, description, image, site name) out of an HTML
 * page: Open Graph first, then Twitter cards, then plain <title>/<meta
 * description>. Regex over the <head> only; we never render this HTML.
 */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function clean(text: string | undefined, max: number) {
  if (!text) return null;
  const t = decode(text).replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : undefined;
}

export function parseOpenGraph(html: string, pageUrl: string) {
  const head = html.slice(0, html.search(/<\/head>/i) > 0 ? html.search(/<\/head>/i) : 256 * 1024);
  const meta: Record<string, string> = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (key && content !== undefined && !(key in meta)) meta[key] = content;
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const rawImage = meta["og:image:secure_url"] || meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || meta["twitter:image:src"];
  let image: string | null = null;
  if (rawImage) {
    try {
      const resolved = new URL(decode(rawImage.trim()), pageUrl);
      if (resolved.protocol === "https:" || resolved.protocol === "http:") image = resolved.toString();
    } catch {
      image = null;
    }
  }

  let siteName = clean(meta["og:site_name"], 60);
  if (!siteName) {
    try {
      siteName = new URL(pageUrl).hostname.replace(/^www\./, "");
    } catch {
      siteName = null;
    }
  }

  return {
    title: clean(meta["og:title"] || meta["twitter:title"] || titleTag, 160),
    description: clean(meta["og:description"] || meta["twitter:description"] || meta["description"], 300),
    image,
    siteName,
  };
}
