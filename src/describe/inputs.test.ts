import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { contractPath, screenshotsPath } from "../output";
import { MissingPrerequisiteError } from "../prerequisites";
import { loadCapturedPages } from "./inputs";

const validPages = {
  project: "demo",
  pages: [
    { route: "/", screenshot: "index.png" },
    { route: "/about", screenshot: "about.png" },
  ],
};

function writePages(root: string, project: string, pages: unknown): void {
  const path = contractPath(root, project, "pages");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(pages, null, 2)}\n`, "utf8");
}

describe("loadCapturedPages", () => {
  it("缺 pages.json 時中止並提示先跑 f2w-capture（AC：缺前置檔）", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-desc-in-"));
    const call = () => loadCapturedPages(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/pages\.json/);
    expect(call).toThrow(/f2w-capture/);
    rmSync(root, { recursive: true, force: true });
  });

  it("有 pages.json 但缺 screenshots/ 時中止並提示先跑 f2w-capture（AC：缺前置檔）", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-desc-in-"));
    writePages(root, "demo", validPages);
    const call = () => loadCapturedPages(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/screenshots/);
    expect(call).toThrow(/f2w-capture/);
    rmSync(root, { recursive: true, force: true });
  });

  it("pages.json 與 screenshots/ 皆在時讀回並驗證，回傳 Pages", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-desc-in-"));
    writePages(root, "demo", validPages);
    mkdirSync(screenshotsPath(root, "demo"), { recursive: true });
    const pages = loadCapturedPages(root, "demo");
    expect(pages).toEqual(validPages);
    rmSync(root, { recursive: true, force: true });
  });
});
