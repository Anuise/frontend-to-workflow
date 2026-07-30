import { expect, test } from "vitest";
import {
  BACKEND_SHEET,
  BACKEND_SOURCED_COLUMNS,
  FRONTEND_SHEET,
  OVERVIEW_SHEET,
  SOURCING_STATUS_LABEL,
  buildWorkitemsWorkbook,
  isSourcedWorkitems,
  loadWorkitemsForExport,
  saveWorkitemsWorkbook,
} from "../src/breakdown-export";

// f2w-breakdown-export 驅動（本專案插過 f2w-sourcing）：優先讀 workitems-sourced.json，
// 組出三個 sheet 的範本、後端 sheet 多帶來源決策欄，寫成 workitems.xlsx。
const OUTPUT_ROOT = "output";
const PROJECT = "new_0724_AI六大模組管理平台_桃園智發會_最新版";

test("f2w-breakdown-export 產出 workitems.xlsx（sourced 後端帶來源決策欄）", async () => {
  const workitems = loadWorkitemsForExport(OUTPUT_ROOT, PROJECT);
  expect(isSourcedWorkitems(workitems)).toBe(true); // 讀到的是 sourced 檔

  const wb = buildWorkitemsWorkbook(workitems);

  const names = wb.worksheets.map((w) => w.name);
  expect(names).toEqual([OVERVIEW_SHEET, FRONTEND_SHEET, BACKEND_SHEET]);
  expect(wb.getWorksheet(FRONTEND_SHEET)!.rowCount - 1).toBe(workitems.frontend.length);

  const backend = wb.getWorksheet(BACKEND_SHEET)!;
  expect(backend.rowCount - 1).toBe(workitems.backend.length);
  const header = (backend.getRow(1).values as unknown[]).slice(1).map(String);
  expect(header).toEqual([...BACKEND_SOURCED_COLUMNS]);
  // 每列的來源狀態都是配對·待確認
  const statusCol = header.indexOf("來源狀態") + 1;
  for (let r = 2; r <= backend.rowCount; r++) {
    expect(String(backend.getRow(r).getCell(statusCol).value)).toBe(SOURCING_STATUS_LABEL);
  }

  const path = await saveWorkitemsWorkbook(OUTPUT_ROOT, PROJECT, wb);
  // eslint-disable-next-line no-console
  console.log(
    `SAVED ${path} | frontend=${workitems.frontend.length} backend=${workitems.backend.length}`,
  );
});
