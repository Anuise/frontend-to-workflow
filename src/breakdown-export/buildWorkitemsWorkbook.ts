import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import ExcelJS from "exceljs";
import type { PageId } from "../contracts/page";
import type { WorkItem, Workitems } from "../contracts/workitems";
import { contractPath } from "../output";

/** 三個 sheet 的名稱（對外常數，供測試與讀取者參照）。 */
export const OVERVIEW_SHEET = "概述";
export const FRONTEND_SHEET = "前端工項";
export const BACKEND_SHEET = "後端工項";

/** 後端工項專屬欄位：標記此列的工項是推論而來、待人工確認。 */
export const INFERRED_STATUS_COLUMN = "推論狀態";
/** 後端工項在「推論狀態」欄一律顯示的字樣（與 workitems.json 的 inferred: true 對應）。 */
export const INFERRED_STATUS_LABEL = "推論·待確認";

/**
 * 前端工項 sheet 的欄序（後端沿用同一組欄、再額外加「推論狀態」）。
 * AI 填：工項ID／來源Page／標題／範疇／驗收標準／依賴／風險備註。
 * 留白（承諾型，表頭在、值空）：估時／優先級／R／A／C／I／簽核日期／狀態。
 */
export const FRONTEND_COLUMNS = [
  "工項ID",
  "來源Page",
  "標題",
  "範疇",
  "驗收標準",
  "依賴",
  "估時",
  "優先級",
  "R",
  "A",
  "C",
  "I",
  "簽核日期",
  "狀態",
  "風險備註",
] as const;

/** 後端工項 sheet 的欄序：同前端，額外一欄「推論狀態」。 */
export const BACKEND_COLUMNS = [...FRONTEND_COLUMNS, INFERRED_STATUS_COLUMN] as const;

/** 承諾型欄位：由人在工作副本填，範本一律留白（只有表頭）。 */
export const BLANK_COLUMNS = [
  "估時",
  "優先級",
  "R",
  "A",
  "C",
  "I",
  "簽核日期",
  "狀態",
] as const;

/** 概述 sheet 的 RACI 圖例。 */
export const RACI_LEGEND = [
  "A 當責＝單一人",
  "R 負責＝可多人",
  "C 諮詢",
  "I 告知",
] as const;

/** 概述 sheet 的狀態圖例。 */
export const STATUS_LEGEND = ["未開始", "進行中", "審查中", "完成", "擱置"] as const;

/** 概述 sheet 的優先級圖例。 */
export const PRIORITY_LEGEND = ["P0", "P1", "P2"] as const;

/** 估時的單位（人天）。 */
export const ESTIMATE_UNIT = "人天";

// 資料列裡各欄的位置（1-indexed，前後端相同段落）。
const ID_COL = 1;
const SOURCE_COL = 2;
const TITLE_COL = 3;
const SCOPE_COL = 4;
const ACCEPTANCE_COL = 5;
const DEPENDS_COL = 6;
const RISK_COL = 15;
// AI 內容型欄（需自動換行）。
const WRAP_COLS = [TITLE_COL, SCOPE_COL, ACCEPTANCE_COL, DEPENDS_COL, RISK_COL];

// 概述 sheet 整體敘述：說明範本／工作副本分離與重跑覆蓋語意。
const NARRATIVE =
  "本工作簿為工項權責畫押（RACI sign-off）範本：每筆 Work item 一列，" +
  "畫押欄（估時／優先級／RACI／簽核日期／狀態）留白。" +
  "此檔為可重跑覆蓋的範本，請另存一份工作副本填寫畫押值；" +
  "上游更新後重跑只覆蓋範本、不動工作副本。";

/** 把 Page 識別轉成可讀標籤（含 tab）。 */
function pageLabel(id: PageId): string {
  return id.tab ? `${id.route}（${id.tab}）` : id.route;
}

/** 依賴工項 id 串成一格文字；無依賴顯示佔位字樣。 */
function dependsOnText(ids: readonly string[]): string {
  return ids.length ? ids.join("、") : "（無依賴）";
}

/** 各欄寬度（AI 內容型欄較寬、承諾型窄欄較窄）。 */
function columnWidth(header: string): number {
  switch (header) {
    case "驗收標準":
      return 44;
    case "範疇":
      return 40;
    case "風險備註":
      return 36;
    case "來源Page":
    case "標題":
    case "依賴":
      return 24;
    case "工項ID":
      return 20;
    case INFERRED_STATUS_COLUMN:
      return 14;
    default:
      return 12; // 承諾型窄欄
  }
}

/**
 * 加一個工項 sheet：標頭列 + 每筆工項一列。
 * AI 內容型欄填值；承諾型欄留白（不設值）；withInferredStatus 時額外填「推論狀態」欄。
 */
function addItemsSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  columns: readonly string[],
  items: readonly WorkItem[],
  withInferredStatus: boolean,
): void {
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((header) => ({ header, width: columnWidth(header) }));
  ws.getRow(1).font = { bold: true };

  items.forEach((item, index) => {
    const row = ws.getRow(index + 2); // 第 1 列為標頭
    row.getCell(ID_COL).value = item.id;
    row.getCell(SOURCE_COL).value = pageLabel(item.sourcePage);
    row.getCell(TITLE_COL).value = item.title;
    row.getCell(SCOPE_COL).value = item.scope;
    row.getCell(ACCEPTANCE_COL).value = item.acceptance;
    row.getCell(DEPENDS_COL).value = dependsOnText(item.dependsOn);
    // 第 7～14 欄（承諾型）刻意不設值——範本留白，由人在工作副本填。
    row.getCell(RISK_COL).value = item.risk;
    if (withInferredStatus) {
      row.getCell(columns.length).value = INFERRED_STATUS_LABEL; // 額外的「推論狀態」欄
    }
    for (const col of WRAP_COLS) {
      row.getCell(col).alignment = { wrapText: true, vertical: "top" };
    }
  });
}

/** 概述 sheet：整體敘述 ＋ 工項統計 ＋ RACI／狀態／估時／優先級 圖例。 */
function addOverviewSheet(wb: ExcelJS.Workbook, workitems: Workitems): void {
  const ws = wb.addWorksheet(OVERVIEW_SHEET);
  ws.columns = [{ width: 100 }];

  const inferredCount = [...workitems.frontend, ...workitems.backend].filter(
    (i) => i.inferred,
  ).length;

  const lines: string[] = [
    OVERVIEW_SHEET,
    NARRATIVE,
    "",
    "工項統計",
    `前端工項：${workitems.frontend.length} 筆`,
    `後端工項：${workitems.backend.length} 筆`,
    `推論工項：${inferredCount} 筆（一律標「${INFERRED_STATUS_LABEL}」，開工前須人工確認）`,
    "",
    "RACI 圖例",
    ...RACI_LEGEND,
    "",
    "狀態圖例",
    STATUS_LEGEND.join("／"),
    "",
    `估時單位：${ESTIMATE_UNIT}`,
    `優先級：${PRIORITY_LEGEND.join("／")}`,
  ];

  lines.forEach((text, index) => {
    const cell = ws.getCell(index + 1, 1);
    cell.value = text;
    cell.alignment = { wrapText: true, vertical: "top" };
  });
  ws.getCell("A1").font = { bold: true, size: 14 };
}

/**
 * 由 workitems 組出記憶體中的 Workbook（確定性核心，不碰 fs、不嵌截圖）。
 * - 「概述」sheet：整體敘述、工項統計與 RACI／狀態／估時／優先級 圖例。
 * - 「前端工項」sheet：每列一筆前端 Work item；AI 內容型欄填值、承諾型欄留白。
 * - 「後端工項」sheet：同前端，額外「推論狀態」欄一律顯示「推論·待確認」。
 */
export function buildWorkitemsWorkbook(workitems: Workitems): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  addOverviewSheet(wb, workitems);
  addItemsSheet(wb, FRONTEND_SHEET, FRONTEND_COLUMNS, workitems.frontend, false);
  addItemsSheet(wb, BACKEND_SHEET, BACKEND_COLUMNS, workitems.backend, true);
  return wb;
}

/**
 * 把組好的 Workbook 寫成 output/<project>/workitems.xlsx，回傳寫入路徑。
 * 缺目錄會自動建立。
 */
export async function saveWorkitemsWorkbook(
  outputRoot: string,
  project: string,
  workbook: ExcelJS.Workbook,
): Promise<string> {
  const path = contractPath(outputRoot, project, "workitemsWorkbook");
  mkdirSync(dirname(path), { recursive: true });
  await workbook.xlsx.writeFile(path);
  return path;
}
