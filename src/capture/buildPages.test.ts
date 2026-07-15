import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPages } from "../contracts/pages";
import { ContractValidationError } from "../contracts/validate";
import { contractPath } from "../output";
import { buildPages, savePages, screenshotFilename } from "./buildPages";

describe("screenshotFilename", () => {
  it("由 route 產生穩定檔名（根路由用 index）", () => {
    expect(screenshotFilename({ route: "/" })).toBe("index.png");
    expect(screenshotFilename({ route: "/about" })).toBe("about.png");
    expect(screenshotFilename({ route: "/settings/profile" })).toBe("settings-profile.png");
  });

  it("含 tab 時把 tab 併入檔名，同 route 不同 tab 得到不同檔名", () => {
    const profile = screenshotFilename({ route: "/settings", tab: "個人資料" });
    const account = screenshotFilename({ route: "/settings", tab: "帳號" });
    expect(profile).toBe("settings--個人資料.png");
    expect(account).toBe("settings--帳號.png");
    expect(profile).not.toBe(account);
  });

  it("清洗路徑分隔與危險字元，檔名恆為單一安全片段（防目錄穿越）", () => {
    const name = screenshotFilename({ route: "/x", tab: '../../etc/pa:ss"?' });
    expect(name).not.toContain("/");
    expect(name).not.toContain("\\");
    expect(name).not.toContain("..");
    expect(name).not.toContain(":");
    expect(name.endsWith(".png")).toBe(true);
  });
});

describe("buildPages", () => {
  it("同 route 不同 tab 各自成為一個 Page（AC：tab 狀態各成一頁）", () => {
    const pages = buildPages("demo", [
      { route: "/" },
      { route: "/settings", tab: "個人資料" },
      { route: "/settings", tab: "帳號" },
    ]);
    expect(pages.pages).toHaveLength(3);
    expect(pages.pages.map((p) => p.screenshot)).toEqual([
      "index.png",
      "settings--個人資料.png",
      "settings--帳號.png",
    ]);
  });

  it("截圖檔名碰撞時加數字後綴，保證每頁一張不互相覆寫", () => {
    // "/a-b" 與 "/a/b" 的樸素 slug 都會是 "a-b"——必須去重避免覆寫。
    const pages = buildPages("demo", [{ route: "/a-b" }, { route: "/a/b" }]);
    const names = pages.pages.map((p) => p.screenshot);
    expect(new Set(names).size).toBe(2);
    expect(names).toContain("a-b.png");
    expect(names).toContain("a-b-2.png");
  });

  it("空 Page 清單違反契約（min 1）而丟錯", () => {
    expect(() => buildPages("demo", [])).toThrow(ContractValidationError);
  });

  it("重複的 Page 識別違反契約（唯一性）而丟錯", () => {
    expect(() =>
      buildPages("demo", [
        { route: "/settings", tab: "帳號" },
        { route: "/settings", tab: "帳號" },
      ]),
    ).toThrow(ContractValidationError);
  });

  it("非正規化 route 違反契約而丟錯（列舉端 bug 要當場炸出來）", () => {
    expect(() => buildPages("demo", [{ route: "settings" }])).toThrow(ContractValidationError);
  });
});

describe("savePages", () => {
  it("驗證通過後寫出 output/<project>/pages.json，可被 loadPages 讀回且相符", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-pages-"));
    const pages = buildPages("demo", [{ route: "/" }, { route: "/about" }]);
    const path = savePages(root, "demo", pages);
    expect(path).toBe(contractPath(root, "demo", "pages"));
    expect(loadPages(path)).toEqual(pages);
    rmSync(root, { recursive: true, force: true });
  });

  it("資料不合契約時丟錯且不落地任何檔案", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-pages-"));
    expect(() => savePages(root, "demo", { project: "demo", pages: [] })).toThrow(
      ContractValidationError,
    );
    // 目錄不應被建立/寫入 pages.json
    const dir = join(root, "demo");
    expect(existsSync(dir) && readdirSync(dir).length > 0).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });
});
