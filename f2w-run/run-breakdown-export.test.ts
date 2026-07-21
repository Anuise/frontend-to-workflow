import { expect, test } from "vitest";
import {
  BACKEND_SHEET,
  FRONTEND_SHEET,
  OVERVIEW_SHEET,
  buildWorkitemsWorkbook,
  loadWorkitemsForExport,
  saveWorkitemsWorkbook,
} from "../src/breakdown-export";

// f2w-breakdown-export 驅動：讀回 workitems.json，組出三個 sheet 的範本並寫成 workitems.xlsx。
const OUTPUT_ROOT = "output";
const PROJECT = "AI六大模組管理平台_桃園智發會_0714";

test("f2w-breakdown-export 產出 workitems.xlsx（三 sheet 範本）", async () => {
  const workitems = loadWorkitemsForExport(OUTPUT_ROOT, PROJECT);
  const wb = buildWorkitemsWorkbook(workitems);

  // 三個 sheet 齊備、資料列數＝工項數（不含標頭）。
  const names = wb.worksheets.map((w) => w.name);
  expect(names).toEqual([OVERVIEW_SHEET, FRONTEND_SHEET, BACKEND_SHEET]);
  expect(wb.getWorksheet(FRONTEND_SHEET)!.rowCount - 1).toBe(workitems.frontend.length);
  expect(wb.getWorksheet(BACKEND_SHEET)!.rowCount - 1).toBe(workitems.backend.length);

  const path = await saveWorkitemsWorkbook(OUTPUT_ROOT, PROJECT, wb);
  // eslint-disable-next-line no-console
  console.log(`SAVED ${path} | frontend=${workitems.frontend.length} backend=${workitems.backend.length}`);
});
