import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { Workitems } from "../contracts/workitems";
import { contractPath } from "../output";
import {
  BACKEND_SHEET,
  BACKEND_SOURCED_COLUMNS,
  BLANK_COLUMNS,
  FRONTEND_COLUMNS,
  FRONTEND_SHEET,
  INFERRED_STATUS_COLUMN,
  INFERRED_STATUS_LABEL,
  NEEDS_INVESTIGATION_LABEL,
  OVERVIEW_SHEET,
  RACI_LEGEND,
  SOURCING_STATUS_LABEL,
  STATUS_LEGEND,
  buildWorkitemsWorkbook,
  saveWorkitemsWorkbook,
} from "./buildWorkitemsWorkbook";
import { loadWorkitemsForExport } from "./inputs";

const workitems: Workitems = {
  project: "demo",
  frontend: [
    {
      id: "FE-01-01",
      sourcePage: { route: "/" },
      title: "首頁",
      scope: "呈現歡迎訊息與導覽。",
      acceptance: "載入後顯示歡迎訊息。",
      dependsOn: [],
      risk: "",
      inferred: false,
    },
    {
      id: "FE-02-01",
      sourcePage: { route: "/settings", tab: "個人資料" },
      title: "個人資料表單",
      scope: "姓名與 Email 欄位。",
      acceptance: "可輸入並切換 tab。",
      dependsOn: [],
      risk: "驗證規則待確認。",
      inferred: false,
    },
  ],
  backend: [
    {
      id: "BE-1",
      sourcePage: { route: "/settings", tab: "個人資料" },
      title: "儲存個人資料 API",
      scope: "驗證後持久化。",
      acceptance: "合法回 200。",
      dependsOn: ["FE-02-01"],
      risk: "契約推論而來。",
      inferred: true,
    },
  ],
};

// 每個 sheet 的所有 cell 值攤平成字串陣列，方便斷言某段文字有無出現。
function cellTexts(sheet: ExcelJS.Worksheet): string[] {
  const out: string[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell) => out.push(String(cell.value ?? "")));
  });
  return out;
}

describe("buildWorkitemsWorkbook", () => {
  it("產出三個 sheet：概述、前端工項、後端工項（AC：三 sheet）", () => {
    const wb = buildWorkitemsWorkbook(workitems);
    expect(wb.getWorksheet(OVERVIEW_SHEET)).toBeDefined();
    expect(wb.getWorksheet(FRONTEND_SHEET)).toBeDefined();
    expect(wb.getWorksheet(BACKEND_SHEET)).toBeDefined();
  });

  it("前端工項 sheet 每列對應一筆前端 Work item，AI 欄填值（AC：每列一工項）", () => {
    const wb = buildWorkitemsWorkbook(workitems);
    const ws = wb.getWorksheet(FRONTEND_SHEET)!;
    // 標頭列 + 每筆前端工項一列
    expect(ws.rowCount).toBe(workitems.frontend.length + 1);
    // 標頭比對
    const header = ws.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual([...FRONTEND_COLUMNS]);
    // 第 2 列（FE-01-01）：AI 內容型欄位
    const row = ws.getRow(2);
    expect(String(row.getCell(1).value)).toBe("FE-01-01");
    expect(String(row.getCell(2).value)).toBe("/");
    expect(String(row.getCell(3).value)).toBe("首頁");
    expect(String(row.getCell(15).value ?? "")).toBe(""); // 風險備註（空字串）
    // 第 3 列（FE-02-01）：來源 Page 帶 tab 標籤
    expect(String(ws.getRow(3).getCell(2).value)).toBe("/settings（個人資料）");
    expect(String(ws.getRow(3).getCell(15).value)).toBe("驗證規則待確認。");
  });

  it("承諾型欄位留白：表頭在、資料列值空（AC：留白）", () => {
    const wb = buildWorkitemsWorkbook(workitems);
    const ws = wb.getWorksheet(FRONTEND_SHEET)!;
    const header = (ws.getRow(1).values as unknown[]).slice(1).map(String);
    for (const col of BLANK_COLUMNS) {
      const idx = header.indexOf(col);
      expect(idx).toBeGreaterThanOrEqual(0); // 表頭在
      // 每一筆資料列該欄皆空
      for (let r = 2; r <= ws.rowCount; r++) {
        expect(String(ws.getRow(r).getCell(idx + 1).value ?? "")).toBe("");
      }
    }
  });

  it("後端工項 sheet 同前端＋額外「推論狀態」欄，值為推論·待確認（AC：後端推論狀態）", () => {
    const wb = buildWorkitemsWorkbook(workitems);
    const ws = wb.getWorksheet(BACKEND_SHEET)!;
    expect(ws.rowCount).toBe(workitems.backend.length + 1);
    const header = (ws.getRow(1).values as unknown[]).slice(1).map(String);
    // 前端欄位原樣在前，推論狀態為額外一欄
    expect(header.slice(0, FRONTEND_COLUMNS.length)).toEqual([...FRONTEND_COLUMNS]);
    const inferredIdx = header.indexOf(INFERRED_STATUS_COLUMN);
    expect(inferredIdx).toBe(FRONTEND_COLUMNS.length);
    // 每筆後端列的推論狀態欄＝推論·待確認
    for (let r = 2; r <= ws.rowCount; r++) {
      expect(String(ws.getRow(r).getCell(inferredIdx + 1).value)).toBe(INFERRED_STATUS_LABEL);
    }
    // dependsOn 呈現於依賴欄
    const dependsIdx = header.indexOf("依賴");
    expect(String(ws.getRow(2).getCell(dependsIdx + 1).value)).toContain("FE-02-01");
  });

  it("概述 sheet 含工項統計與 RACI／狀態圖例（AC：概述統計與圖例）", () => {
    const wb = buildWorkitemsWorkbook(workitems);
    const texts = cellTexts(wb.getWorksheet(OVERVIEW_SHEET)!);
    const blob = texts.join("\n");
    // 工項統計：前端 2、後端 1、推論 1
    expect(blob).toMatch(/前端.*2/);
    expect(blob).toMatch(/後端.*1/);
    expect(blob).toMatch(/推論.*1/);
    // RACI 圖例（A 當責＝單一人、R 負責＝可多人…）與狀態圖例
    for (const line of RACI_LEGEND) expect(blob).toContain(line);
    for (const s of STATUS_LEGEND) expect(blob).toContain(s);
    // 估時單位人天、優先級 P0/P1/P2
    expect(blob).toContain("人天");
    expect(blob).toContain("P0");
  });

  it("不嵌入任何截圖（AC：工項表不放縮圖）", () => {
    const wb = buildWorkitemsWorkbook(workitems);
    for (const name of [OVERVIEW_SHEET, FRONTEND_SHEET, BACKEND_SHEET]) {
      expect(wb.getWorksheet(name)!.getImages()).toHaveLength(0);
    }
  });
});

// 同一批工項的帶分工鏈版：一筆單 leg 配到端點、一筆三 leg 接力（含 gary 純通道中繼）、一筆待查。
const sourced: Workitems = {
  project: "demo",
  frontend: workitems.frontend,
  backend: [
    {
      ...workitems.backend[0]!,
      partyChain: [
        {
          party: "sample-vendor",
          vendor: "sample-vendor",
          vendorEndpoints: ["POST /api/v1/profile", "GET /api/v1/profile"],
        },
      ],
      sourcingConfirmed: false,
    },
    {
      ...workitems.backend[0]!,
      id: "BE-2",
      title: "驗證規則",
      partyChain: [
        {
          party: "mobagel",
          vendorEndpoints: [],
          title: "驗證規則（mobagel 前置閘道）",
          scope: "mobagel 收前端請求、驗授權後轉發。",
          acceptance: "前端不直接呼叫下游。",
        },
        {
          party: "gary",
          vendorEndpoints: [],
          title: "驗證規則（gary 轉發）",
          scope: "gary 需開代理 API 轉呼下游，現有 spec 未提供。",
          acceptance: "轉發保留呼叫端身分。",
        },
        {
          party: "sample-vendor",
          vendor: "sample-vendor",
          vendorEndpoints: ["GET /api/v1/profile"],
          title: "驗證規則（實作）",
          scope: "下游實作驗證規則本體。",
          acceptance: "欄位齊全，支援分頁與排序。",
        },
      ],
      sourcingConfirmed: false,
    },
    {
      ...workitems.backend[0]!,
      id: "BE-3",
      title: "個人資料遮罩層",
      partyChain: [{ party: "needs-investigation", vendorEndpoints: [] }],
      sourcingConfirmed: false,
    },
  ],
};

describe("buildWorkitemsWorkbook（帶分工鏈）", () => {
  const header = (ws: import("exceljs").Worksheet) =>
    (ws.getRow(1).values as unknown[]).slice(1).map(String);

  it("後端 sheet 在推論狀態後加分工欄，並一個 leg 一列（AC：leg 展開）", () => {
    const ws = buildWorkitemsWorkbook(sourced).getWorksheet(BACKEND_SHEET)!;
    expect(header(ws)).toEqual([...BACKEND_SOURCED_COLUMNS]);
    // 前 15 欄仍是前端那組、推論狀態仍在第 16 欄
    expect(header(ws).slice(0, FRONTEND_COLUMNS.length)).toEqual([...FRONTEND_COLUMNS]);
    expect(header(ws)[FRONTEND_COLUMNS.length]).toBe(INFERRED_STATUS_COLUMN);
    // 1（單 leg）＋3（三 leg）＋1（待查）＝5 列，不是 3 列
    expect(ws.rowCount).toBe(6);
  });

  it("列標籤：單 leg 是裸 id，多 leg 是 <id>#<leg序>（AC：列標籤）", () => {
    const ws = buildWorkitemsWorkbook(sourced).getWorksheet(BACKEND_SHEET)!;
    const labels = [2, 3, 4, 5, 6].map((r) => String(ws.getRow(r).getCell(1).value));
    expect(labels).toEqual([
      workitems.backend[0]!.id,
      "BE-2#1",
      "BE-2#2",
      "BE-2#3",
      "BE-3",
    ]);
  });

  it("每列填該 leg 的分工事實與自己的散文，來源狀態一律配對·待確認（AC：leg 散文）", () => {
    const ws = buildWorkitemsWorkbook(sourced).getWorksheet(BACKEND_SHEET)!;
    const cols = header(ws);
    const cell = (r: number, col: string) =>
      String(ws.getRow(r).getCell(cols.indexOf(col) + 1).value ?? "");

    // 單 leg 配到端點：派工方／供應商／端點皆填，分工段 1/1
    expect(cell(2, "派工方")).toBe("sample-vendor");
    expect(cell(2, "供應商")).toBe("sample-vendor");
    expect(cell(2, "供應商端點")).toContain("POST /api/v1/profile");
    expect(cell(2, "分工段")).toBe("1/1");
    // gary 純通道中繼列：供應商與端點留空、分工段 2/3
    expect(cell(4, "派工方")).toBe("gary");
    expect(cell(4, "供應商")).toBe("");
    expect(cell(4, "供應商端點")).toBe("");
    expect(cell(4, "分工段")).toBe("2/3");
    // 中繼列的標題／範疇／驗收是自己的，不等於下游那一列
    for (const col of ["標題", "範疇", "驗收標準"]) {
      expect(cell(4, col)).not.toBe(cell(5, col));
    }
    // needs-investigation：顯示「待查」、不得攀附供應商
    expect(cell(6, "派工方")).toBe(NEEDS_INVESTIGATION_LABEL);
    expect(cell(6, "供應商")).toBe("");
    // 畫押欄逐列留白；推論狀態與來源狀態並存（兩個獨立的待確認維度）
    for (let r = 2; r <= ws.rowCount; r++) {
      expect(cell(r, INFERRED_STATUS_COLUMN)).toBe(INFERRED_STATUS_LABEL);
      expect(cell(r, "來源狀態")).toBe(SOURCING_STATUS_LABEL);
      for (const col of BLANK_COLUMNS) expect(cell(r, col)).toBe("");
    }
  });

  it("前端 sheet 不受影響、概述補分工圖例（AC：概述）", () => {
    const wb = buildWorkitemsWorkbook(sourced);
    const feHeader = (wb.getWorksheet(FRONTEND_SHEET)!.getRow(1).values as unknown[]).slice(1);
    expect(feHeader.map(String)).toEqual([...FRONTEND_COLUMNS]);
    const blob = cellTexts(wb.getWorksheet(OVERVIEW_SHEET)!).join("\n");
    expect(blob).toContain(SOURCING_STATUS_LABEL);
    // 分工圖例列出本批出現的派工方（含待查）與展開後的列數
    expect(blob).toContain("mobagel");
    expect(blob).toContain(NEEDS_INVESTIGATION_LABEL);
    expect(blob).toContain("共 5 列");
  });
});

describe("saveWorkitemsWorkbook", () => {
  it("寫出 workitems.xlsx，可用 ExcelJS 讀回且三 sheet 都在（AC：save round-trip）", async () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-breakdown-export-save-"));
    const wb = buildWorkitemsWorkbook(workitems);
    const path = await saveWorkitemsWorkbook(root, "demo", wb);
    expect(path).toBe(contractPath(root, "demo", "workitemsWorkbook"));
    expect(existsSync(path)).toBe(true);

    const reread = new ExcelJS.Workbook();
    await reread.xlsx.readFile(path);
    expect(reread.getWorksheet(OVERVIEW_SHEET)).toBeDefined();
    expect(reread.getWorksheet(FRONTEND_SHEET)).toBeDefined();
    expect(reread.getWorksheet(BACKEND_SHEET)).toBeDefined();
    rmSync(root, { recursive: true, force: true });
  });
});

describe("端到端（真實 fixtures）", () => {
  it("讀真實 workitems.json → 組裝 → 寫出可讀回的 workitems.xlsx，無嵌入圖片", async () => {
    const wi = loadWorkitemsForExport(join(process.cwd(), "fixtures"), "contracts");
    const wb = buildWorkitemsWorkbook(wi);
    expect(wb.getWorksheet(FRONTEND_SHEET)!.rowCount).toBe(wi.frontend.length + 1);
    expect(wb.getWorksheet(BACKEND_SHEET)!.rowCount).toBe(wi.backend.length + 1);

    const root = mkdtempSync(join(tmpdir(), "f2w-breakdown-export-e2e-"));
    const path = await saveWorkitemsWorkbook(root, "contracts", wb);
    const reread = new ExcelJS.Workbook();
    await reread.xlsx.readFile(path); // 讀得回 = 合法 xlsx
    expect(reread.getWorksheet(FRONTEND_SHEET)!.getImages()).toHaveLength(0);
    expect(reread.getWorksheet(BACKEND_SHEET)!.getImages()).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });
});
