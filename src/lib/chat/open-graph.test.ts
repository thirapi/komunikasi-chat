import { describe, it, expect } from "vitest";
import { parseOpenGraph } from "./open-graph";

describe("parseOpenGraph", () => {
  it("reads Open Graph tags and resolves a relative image", () => {
    const html = `<html><head>
      <meta property="og:title" content="Rilis &amp; Catatan" />
      <meta property="og:description" content="Apa yang baru di versi 2" />
      <meta property="og:image" content="/img/cover.png">
      <meta property="og:site_name" content="Contoh Blog">
      <title>Ignored</title>
    </head><body>…</body></html>`;
    expect(parseOpenGraph(html, "https://blog.example.com/post/1")).toEqual({
      title: "Rilis & Catatan",
      description: "Apa yang baru di versi 2",
      image: "https://blog.example.com/img/cover.png",
      siteName: "Contoh Blog",
    });
  });

  it("falls back to twitter tags, <title>, meta description and the hostname", () => {
    const html = `<head><title> Halaman  Utama </title>
      <meta name="description" content='Deskripsi biasa'>
      <meta name="twitter:image" content="https://cdn.example.com/a.jpg"></head>`;
    expect(parseOpenGraph(html, "https://www.example.com/")).toEqual({
      title: "Halaman Utama",
      description: "Deskripsi biasa",
      image: "https://cdn.example.com/a.jpg",
      siteName: "example.com",
    });
  });

  it("ignores non-http image schemes and truncates long text", () => {
    const html = `<head><meta property="og:title" content="${"a".repeat(400)}"><meta property="og:image" content="javascript:alert(1)"></head>`;
    const res = parseOpenGraph(html, "https://example.com");
    expect(res.image).toBeNull();
    expect(res.title!.length).toBe(160);
  });
});
