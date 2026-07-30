import { existsSync, statSync } from "node:fs";
import { expect, test } from "vitest";
import { buildWorkbook, loadDescribedWorkflow, saveWorkbook } from "../src/export";

// f2w-export 驅動：讀回 workflow.json + pages.json + screenshots/，組出 Workbook 寫成 workflow.xlsx。
const OUTPUT_ROOT = "output";
const PROJECT = "0729_AI六大模組管理平台_5E_AI平台最新版";

test("f2w-export 產出 workflow.xlsx（概述＋逐頁工作流程）", { timeout: 120_000 }, async () => {
  const { workflow, screenshots } = loadDescribedWorkflow(OUTPUT_ROOT, PROJECT);
  expect(screenshots.size).toBe(workflow.pages.length);

  const wb = buildWorkbook(workflow, screenshots);
  const path = await saveWorkbook(OUTPUT_ROOT, PROJECT, wb);

  expect(existsSync(path)).toBe(true);
  // eslint-disable-next-line no-console
  console.log(`SAVED ${path} (${statSync(path).size} bytes)`);
});
