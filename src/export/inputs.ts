import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { pageIdKey } from "../contracts/page";
import { loadPages } from "../contracts/pages";
import { type Workflow, loadWorkflow } from "../contracts/workflow";
import { CONTRACT_PRODUCER, SCREENSHOTS_DIR, screenshotsPath } from "../output";
import { requireContract, requirePrerequisite } from "../prerequisites";

/** exceljs addImage 接受的影像副檔名。 */
export type ImageExtension = "png" | "jpeg" | "gif";

/** 單張截圖的位元組與副檔名，供嵌入 Workbook 使用。 */
export interface ScreenshotImage {
  buffer: Buffer;
  extension: ImageExtension;
}

/** f2w-export 的輸入：已描述的 workflow ＋ 每個 Page 對應的截圖影像（key = pageIdKey）。 */
export interface ExportInputs {
  workflow: Workflow;
  screenshots: Map<string, ScreenshotImage>;
}

/** 由截圖檔名推得 exceljs 可用的副檔名；非 jpeg/gif 一律當 png（f2w-capture 產出 png）。 */
function toImageExtension(filename: string): ImageExtension {
  const ext = extname(filename).replace(/^\./, "").toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "gif") return "gif";
  return "png";
}

/**
 * f2w-export 的前置入口：確認 f2w-describe 的 workflow.json、f2w-capture 的 pages.json 與
 * screenshots/ 皆已存在，讀回並驗證後回傳 workflow 與「Page → 截圖影像」對應。
 * - 缺 workflow.json 丟 MissingPrerequisiteError，提示先跑 f2w-describe。
 * - 缺 pages.json 或 screenshots/（含個別截圖檔）丟 MissingPrerequisiteError，提示先跑 f2w-capture。
 * 截圖對應以 pages.json（單一真實來源）為準，key 為 pageIdKey，供 buildWorkbook 逐頁嵌入縮圖。
 */
export function loadDescribedWorkflow(outputRoot: string, project: string): ExportInputs {
  const workflowPath = requireContract(outputRoot, project, "workflow");
  const pagesPath = requireContract(outputRoot, project, "pages");
  const shotsDir = screenshotsPath(outputRoot, project);
  requirePrerequisite({
    path: shotsDir,
    file: `${SCREENSHOTS_DIR}/`,
    previousStep: CONTRACT_PRODUCER.pages,
  });

  const workflow = loadWorkflow(workflowPath);
  const pages = loadPages(pagesPath);

  const screenshots = new Map<string, ScreenshotImage>();
  for (const entry of pages.pages) {
    const file = join(shotsDir, entry.screenshot);
    requirePrerequisite({
      path: file,
      file: `${SCREENSHOTS_DIR}/${entry.screenshot}`,
      previousStep: CONTRACT_PRODUCER.pages,
    });
    screenshots.set(pageIdKey(entry), {
      buffer: readFileSync(file),
      extension: toImageExtension(entry.screenshot),
    });
  }

  return { workflow, screenshots };
}
