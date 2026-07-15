import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { pageIdKey } from "../contracts/page";
import type { Workflow } from "../contracts/workflow";
import { contractPath } from "../output";
import {
  OVERVIEW_SHEET,
  PAGES_SHEET,
  WorkbookConsistencyError,
  buildWorkbook,
  saveWorkbook,
} from "./buildWorkbook";
import { loadDescribedWorkflow, type ScreenshotImage } from "./inputs";

// 1×1 透明 PNG，讓寫出的 .xlsx 是合法可讀回的檔。
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const workflow: Workflow = {
  project: "demo",
  overview: "整體流程：從首頁進入，前往設定頁編輯個人資料。",
  pages: [
    {
      route: "/",
      purpose: "首頁，是進入點。",
      content: "歡迎訊息與導覽連結。",
      actions: [
        { label: "前往設定", destination: { route: "/settings", tab: "個人資料" } },
        { label: "捲動頁面", destination: null },
      ],
    },
    {
      route: "/settings",
      tab: "個人資料",
      purpose: "編輯個人資料。",
      content: "姓名與 Email 欄位。",
      actions: [],
    },
  ],
};

function fullScreenshots(): Map<string, ScreenshotImage> {
  const m = new Map<string, ScreenshotImage>();
  for (const p of workflow.pages) {
    m.set(pageIdKey(p), { buffer: TINY_PNG, extension: "png" });
  }
  return m;
}

describe("buildWorkbook", () => {
  it("產出含「概述」與「逐頁工作流程」兩個 sheet（AC：兩個 sheet）", () => {
    const wb = buildWorkbook(workflow, fullScreenshots());
    expect(wb.getWorksheet(OVERVIEW_SHEET)).toBeDefined();
    expect(wb.getWorksheet(PAGES_SHEET)).toBeDefined();
  });

  it("「概述」sheet 呈現 Overview（AC：概述）", () => {
    const wb = buildWorkbook(workflow, fullScreenshots());
    const sheet = wb.getWorksheet(OVERVIEW_SHEET)!;
    const cells: string[] = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => cells.push(String(cell.value ?? "")));
    });
    expect(cells.some((v) => v.includes(workflow.overview))).toBe(true);
  });

  it("「逐頁工作流程」每列對應一個 Page，含描述文字（AC：每列一 Page）", () => {
    const wb = buildWorkbook(workflow, fullScreenshots());
    const ws = wb.getWorksheet(PAGES_SHEET)!;
    // 標頭列 + 每個 Page 一列
    expect(ws.rowCount).toBe(workflow.pages.length + 1);
    // 第 2 列（第一個 Page）：Page 識別、用途、內容、操作
    const row = ws.getRow(2);
    expect(String(row.getCell(1).value)).toBe("/");
    expect(String(row.getCell(2).value)).toBe("首頁，是進入點。");
    expect(String(row.getCell(3).value)).toBe("歡迎訊息與導覽連結。");
    const actions = String(row.getCell(4).value);
    expect(actions).toContain("前往設定");
    expect(actions).toContain("停留原頁"); // destination 為 null 的操作
    // 第 3 列（含 tab 的 Page）：Page 識別帶 tab
    expect(String(ws.getRow(3).getCell(1).value)).toBe("/settings（個人資料）");
  });

  it("逐頁每列嵌入一張截圖縮圖，圖片數＝Page 數（AC：嵌入截圖縮圖，確定性核心）", () => {
    const wb = buildWorkbook(workflow, fullScreenshots());
    const ws = wb.getWorksheet(PAGES_SHEET)!;
    expect(ws.getImages()).toHaveLength(workflow.pages.length);
  });

  it("某 Page 缺對應截圖時丟 WorkbookConsistencyError", () => {
    const partial = fullScreenshots();
    partial.delete(pageIdKey(workflow.pages[1]!));
    const call = () => buildWorkbook(workflow, partial);
    expect(call).toThrow(WorkbookConsistencyError);
    expect(call).toThrow(/settings/);
  });
});

describe("saveWorkbook", () => {
  it("寫出 workflow.xlsx，可用 ExcelJS 讀回且兩個 sheet 都在", async () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-export-save-"));
    const wb = buildWorkbook(workflow, fullScreenshots());
    const path = await saveWorkbook(root, "demo", wb);
    expect(path).toBe(contractPath(root, "demo", "workbook"));
    expect(existsSync(path)).toBe(true);

    const reread = new ExcelJS.Workbook();
    await reread.xlsx.readFile(path);
    expect(reread.getWorksheet(OVERVIEW_SHEET)).toBeDefined();
    expect(reread.getWorksheet(PAGES_SHEET)).toBeDefined();
    expect(reread.getWorksheet(PAGES_SHEET)!.rowCount).toBe(workflow.pages.length + 1);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("端到端（真實 fixtures）", () => {
  it("讀真實 workflow.json/pages.json/截圖 → 組裝 → 寫出可讀回的 workflow.xlsx", async () => {
    const inputs = loadDescribedWorkflow(join(process.cwd(), "fixtures"), "contracts");
    const wb = buildWorkbook(inputs.workflow, inputs.screenshots);
    const ws = wb.getWorksheet(PAGES_SHEET)!;
    // 每個真實 Page 一列，且每列都嵌入了真實截圖縮圖
    expect(ws.rowCount).toBe(inputs.workflow.pages.length + 1);
    expect(ws.getImages()).toHaveLength(inputs.workflow.pages.length);

    const root = mkdtempSync(join(tmpdir(), "f2w-export-e2e-"));
    const path = await saveWorkbook(root, "contracts", wb);
    const reread = new ExcelJS.Workbook();
    await reread.xlsx.readFile(path); // 讀得回 = 產出的是合法 xlsx
    expect(reread.getWorksheet(OVERVIEW_SHEET)).toBeDefined();
    expect(reread.getWorksheet(PAGES_SHEET)!.getImages()).toHaveLength(
      inputs.workflow.pages.length,
    );
    rmSync(root, { recursive: true, force: true });
  });
});
