import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import ExcelJS from "exceljs";
import { type PageId, pageIdKey } from "../contracts/page";
import type { Workflow, WorkflowAction } from "../contracts/workflow";
import { contractPath } from "../output";
import type { ScreenshotImage } from "./inputs";

/** 兩個 sheet 的名稱（對外常數，供測試與讀取者參照）。 */
export const OVERVIEW_SHEET = "概述";
export const PAGES_SHEET = "逐頁工作流程";

// 縮圖尺寸（像素）；列高／截圖欄寬依此調整，讓縮圖不被裁切。
const THUMB_WIDTH = 240;
const THUMB_HEIGHT = 150;
const SCREENSHOT_COL = 5; // 「截圖」欄（1-indexed）

/** 要嵌入的 Page 缺對應截圖時丟出——描述與截圖對應不一致。 */
export class WorkbookConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookConsistencyError";
  }
}

/** 把 Page 識別轉成可讀標籤（含 tab）。 */
function pageLabel(id: PageId): string {
  return id.tab ? `${id.route}（${id.tab}）` : id.route;
}

/** 把一頁的可執行操作組成多行文字：每行「操作說明 → 操作去向」。 */
function actionsText(actions: readonly WorkflowAction[]): string {
  if (actions.length === 0) return "（無可執行操作）";
  return actions
    .map((a) => {
      const dest = a.destination ? `前往 ${pageLabel(a.destination)}` : "停留原頁";
      return `• ${a.label} → ${dest}`;
    })
    .join("\n");
}

/**
 * 由 workflow 與「Page → 截圖影像」對應，組出記憶體中的 Workbook（確定性核心，不碰 fs）。
 * - 「概述」sheet 放 Overview。
 * - 「逐頁工作流程」sheet 每列對應一個 Page（route/tab、用途、主要內容、可執行操作），並嵌入該頁截圖縮圖。
 * 某 Page 在對應表裡找不到截圖即丟 WorkbookConsistencyError（描述與截圖不一致）。
 */
export function buildWorkbook(
  workflow: Workflow,
  screenshots: ReadonlyMap<string, ScreenshotImage>,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  // 概述 sheet：標題 + Overview（自動換行）
  const overview = wb.addWorksheet(OVERVIEW_SHEET);
  overview.columns = [{ width: 100 }];
  overview.getCell("A1").value = OVERVIEW_SHEET;
  overview.getCell("A1").font = { bold: true, size: 14 };
  overview.getCell("A2").value = workflow.overview;
  overview.getCell("A2").alignment = { wrapText: true, vertical: "top" };

  // 逐頁工作流程 sheet：標頭 + 每個 Page 一列
  const ws = wb.addWorksheet(PAGES_SHEET);
  ws.columns = [
    { header: "Page", width: 28 },
    { header: "用途", width: 40 },
    { header: "主要內容", width: 50 },
    { header: "可執行操作", width: 50 },
    { header: "截圖", width: Math.ceil(THUMB_WIDTH / 7) },
  ];
  ws.getRow(1).font = { bold: true };

  workflow.pages.forEach((page, index) => {
    const shot = screenshots.get(pageIdKey(page));
    if (!shot) {
      throw new WorkbookConsistencyError(
        `Page ${pageLabel(page)} 缺對應截圖，無法嵌入縮圖`,
      );
    }

    const rowNumber = index + 2; // 第 1 列為標頭
    const row = ws.getRow(rowNumber);
    row.getCell(1).value = pageLabel(page);
    row.getCell(2).value = page.purpose;
    row.getCell(3).value = page.content;
    row.getCell(4).value = actionsText(page.actions);
    for (let col = 1; col < SCREENSHOT_COL; col++) {
      row.getCell(col).alignment = { wrapText: true, vertical: "top" };
    }
    row.height = THUMB_HEIGHT * 0.75; // 像素→點的概略換算，容納縮圖高度

    // 用 base64 入口，避開 @types/node 泛型 Buffer 與 exceljs 舊式 Buffer 型別的邊界衝突。
    const imageId = wb.addImage({ base64: shot.buffer.toString("base64"), extension: shot.extension });
    ws.addImage(imageId, {
      // tl anchor 為 0-indexed；錨定在「截圖」欄該列的左上角
      tl: { col: SCREENSHOT_COL - 1, row: rowNumber - 1 },
      ext: { width: THUMB_WIDTH, height: THUMB_HEIGHT },
    });
  });

  return wb;
}

/**
 * 把組好的 Workbook 寫成 output/<project>/workflow.xlsx，回傳寫入路徑。
 * 缺目錄會自動建立。
 */
export async function saveWorkbook(
  outputRoot: string,
  project: string,
  workbook: ExcelJS.Workbook,
): Promise<string> {
  const path = contractPath(outputRoot, project, "workbook");
  mkdirSync(dirname(path), { recursive: true });
  await workbook.xlsx.writeFile(path);
  return path;
}
