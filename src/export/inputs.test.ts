import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { pageIdKey } from "../contracts/page";
import { contractPath, screenshotsPath } from "../output";
import { MissingPrerequisiteError } from "../prerequisites";
import { loadDescribedWorkflow } from "./inputs";

// fixtures/contracts/ 恰好符合 output/<project>/ 版面：workflow.json + pages.json + screenshots/
const FIXTURE_ROOT = join(process.cwd(), "fixtures");
const FIXTURE_PROJECT = "contracts";

const validPages = {
  project: "demo",
  pages: [
    { route: "/", screenshot: "home.png" },
    { route: "/settings", tab: "個人資料", screenshot: "settings-profile.png" },
  ],
};

const validWorkflow = {
  project: "demo",
  overview: "從首頁可前往設定頁編輯個人資料。",
  pages: [
    { route: "/", purpose: "首頁。", content: "歡迎訊息與連結。", actions: [] },
    {
      route: "/settings",
      tab: "個人資料",
      purpose: "編輯個人資料。",
      content: "姓名與 Email 欄位。",
      actions: [],
    },
  ],
};

function writeJson(
  root: string,
  project: string,
  contract: "workflow" | "pages",
  data: unknown,
): void {
  const path = contractPath(root, project, contract);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

describe("loadDescribedWorkflow", () => {
  it("缺 workflow.json 時中止並提示先跑 f2w-describe（AC：缺前置檔）", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-export-in-"));
    const call = () => loadDescribedWorkflow(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/workflow\.json/);
    expect(call).toThrow(/f2w-describe/);
    rmSync(root, { recursive: true, force: true });
  });

  it("有 workflow.json 但缺 pages.json 時中止並提示先跑 f2w-capture", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-export-in-"));
    writeJson(root, "demo", "workflow", validWorkflow);
    const call = () => loadDescribedWorkflow(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/pages\.json/);
    expect(call).toThrow(/f2w-capture/);
    rmSync(root, { recursive: true, force: true });
  });

  it("有 workflow.json 與 pages.json 但缺 screenshots/ 時中止並提示先跑 f2w-capture", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-export-in-"));
    writeJson(root, "demo", "workflow", validWorkflow);
    writeJson(root, "demo", "pages", validPages);
    const call = () => loadDescribedWorkflow(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/screenshots/);
    expect(call).toThrow(/f2w-capture/);
    rmSync(root, { recursive: true, force: true });
  });

  it("screenshots/ 在但個別截圖檔缺時中止並提示該檔", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-export-in-"));
    writeJson(root, "demo", "workflow", validWorkflow);
    writeJson(root, "demo", "pages", validPages);
    mkdirSync(screenshotsPath(root, "demo"), { recursive: true });
    const call = () => loadDescribedWorkflow(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/home\.png/);
    rmSync(root, { recursive: true, force: true });
  });

  it("前置齊備時讀回 workflow 與 Page→截圖影像對應（用真實 fixtures）", () => {
    const { workflow, screenshots } = loadDescribedWorkflow(FIXTURE_ROOT, FIXTURE_PROJECT);
    expect(workflow.pages).toHaveLength(4);
    expect(screenshots.size).toBe(4);
    // 每個 workflow Page 都能在對應表裡找到一張有位元組的截圖
    for (const page of workflow.pages) {
      const shot = screenshots.get(pageIdKey(page));
      expect(shot).toBeDefined();
      expect(shot!.buffer.length).toBeGreaterThan(0);
      expect(shot!.extension).toBe("png");
    }
  });
});
