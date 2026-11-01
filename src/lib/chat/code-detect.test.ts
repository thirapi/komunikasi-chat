import { describe, it, expect } from "vitest";
import { looksLikeCode, guessLanguage, languageFromVsCode, codeFromHtml } from "./code-detect";

describe("looksLikeCode", () => {
  it("detects typical code", () => {
    expect(looksLikeCode("function add(a, b) {\n  return a + b;\n}")).toBe(true);
    expect(looksLikeCode("def hello(name):\n    print(name)\n    return name")).toBe(true);
    expect(looksLikeCode('{\n  "a": 1,\n  "b": [2, 3]\n}')).toBe(true);
    expect(looksLikeCode("SELECT id, name\nFROM users\nWHERE id = 1;")).toBe(true);
  });

  it("leaves prose and single lines alone", () => {
    expect(looksLikeCode("const x = 1;")).toBe(false);
    expect(looksLikeCode("Halo semuanya, besok rapat jam sembilan pagi.\nJangan lupa bawa laptop masing-masing ya teman.")).toBe(false);
    expect(looksLikeCode("oke\nsiap\nmantap")).toBe(false);
    expect(looksLikeCode("Daftar belanja:\n- telur\n- susu")).toBe(false);
  });
});

describe("language", () => {
  it("guesses common languages", () => {
    expect(guessLanguage('{"a":1,\n"b":2}')).toBe("json");
    expect(guessLanguage("def f(x):\n    return x")).toBe("python");
    expect(guessLanguage("SELECT *\nFROM t")).toBe("sql");
    expect(guessLanguage("#include <iostream>\nint main() {}")).toBe("cpp");
    expect(guessLanguage("const a = 1;\nconst b = () => a;")).toBe("js");
  });

  it("maps VS Code clipboard modes", () => {
    expect(languageFromVsCode('{"mode":"typescriptreact"}')).toBe("tsx");
    expect(languageFromVsCode('{"mode":"python"}')).toBe("python");
    expect(languageFromVsCode("not json")).toBeNull();
  });
});

describe("looksLikeCode: casual chat stays text", () => {
  it.each([
    ["emoticons and asides", "oke siap :)\nnanti aku kabarin ya (besok)"],
    ["parenthesised asides", "wkwk (bercanda)\nserius kok (dikit)"],
    ["a list of links", "cek ini:\nhttps://github.com/a/b\nhttps://google.com"],
    ["an agenda", "Agenda rapat:\nJam 9: pembukaan\nJam 10: diskusi"],
    ["trailing commas", "halo semua,\nbesok libur ya,\njangan lupa"],
  ])("%s", (_, text) => {
    expect(looksLikeCode(text)).toBe(false);
  });

  it.each([
    ["stack trace", "TypeError: x is undefined\n    at foo (app.js:10:5)\n    at bar (app.js:20:3)"],
    ["yaml", "name: app\nscripts:\n  dev: next dev"],
    ["shell", "npm install\nnpm run dev"],
    ["css", ".btn {\n  color: red;\n}"],
    ["html", "<div class=\"a\">\n  <span>hi</span>\n</div>"],
    ["python", "for i in range(10):\n    print(i)"],
    ["code with a url in a comment", "// see https://example.com/docs\nconst a = fetch(url);"],
  ])("still detects %s", (_, text) => {
    expect(looksLikeCode(text)).toBe(true);
  });
});

describe("codeFromHtml", () => {
  it("reads a <pre> block and its language class", () => {
    expect(codeFromHtml('<meta charset="utf-8"><pre class="lang-py"><code>x = 1\ny = 2</code></pre>')).toBe("py");
    expect(codeFromHtml('<div class="highlight"><pre><code class="language-typescript">a</code></pre></div>')).toBe("ts");
  });

  it("reads GitHub's file view", () => {
    expect(codeFromHtml('<table class="highlight tab-size js-file-line-container"><tr><td class="blob-code blob-code-inner">a</td></tr></table>')).toBe("");
  });

  it("returns '' for code without a language", () => {
    expect(codeFromHtml("<pre>echo hi\nls</pre>")).toBe("");
  });

  it("ignores prose with inline code and plain rich text", () => {
    expect(codeFromHtml("<p>Pakai <code>npm i</code> lalu jalankan.</p>")).toBeNull();
    expect(codeFromHtml("<b>halo</b> semua")).toBeNull();
    expect(codeFromHtml(null)).toBeNull();
  });
});
