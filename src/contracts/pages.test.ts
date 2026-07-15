import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPages, parsePages } from "./pages";
import { ContractValidationError } from "./validate";

const validPages = {
  project: "sample-frontend",
  pages: [
    { route: "/", screenshot: "home.png" },
    { route: "/settings", tab: "個人資料", screenshot: "settings-profile.png" },
    { route: "/settings", tab: "帳號", screenshot: "settings-account.png" },
  ],
};

describe("parsePages", () => {
  it("接受合法 pages（同 route 不同 tab 視為不同 Page）", () => {
    const p = parsePages(validPages);
    expect(p.pages).toHaveLength(3);
    expect(p.pages[1]?.tab).toBe("個人資料");
  });

  it("拒絕空清單、非正規化 route、重複 Page、缺 screenshot", () => {
    const invalid: unknown[] = [
      { project: "x", pages: [] },
      { project: "x", pages: [{ route: "/a?x=1", screenshot: "a.png" }] },
      {
        project: "x",
        pages: [
          { route: "/", screenshot: "a.png" },
          { route: "/", screenshot: "b.png" },
        ],
      },
      { project: "x", pages: [{ route: "/" }] },
    ];
    for (const bad of invalid) {
      expect(() => parsePages(bad)).toThrow(ContractValidationError);
    }
  });
});

describe("loadPages", () => {
  it("讀取並驗證手寫 fixture pages.json", () => {
    const p = loadPages(join(process.cwd(), "fixtures/contracts/pages.json"));
    expect(p.pages.length).toBeGreaterThan(0);
  });

  it("fixture 引用的每張截圖都存在於 screenshots/", () => {
    const p = loadPages(join(process.cwd(), "fixtures/contracts/pages.json"));
    for (const page of p.pages) {
      const shot = join(process.cwd(), "fixtures/contracts/screenshots", page.screenshot);
      expect(existsSync(shot)).toBe(true);
    }
  });
});
