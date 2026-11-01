import { describe, it, expect } from "vitest";
import { looksLikeCode, guessLanguage, languageFromVsCode } from "./code-detect";

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
