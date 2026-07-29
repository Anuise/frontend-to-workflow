import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { type PageId, pageIdKey } from "../contracts/page";
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

/** workflow.json 與 pages.json 的 Page/截圖對應不一致時丟出。 */
export class ExportInputConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportInputConsistencyError";
  }
}

/** 把 Page 識別轉成可讀標籤，供錯誤訊息使用。 */
function pageLabel(id: PageId): string {
  return id.tab ? `${id.route}（${id.tab}）` : id.route;
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
 * - workflow.json 與 pages.json 的 Page 必須一一對應；新版 workflow 若帶 screenshot，必須與 pages.json 相同。
 * 截圖檔名優先使用 workflow.json 的 screenshot；舊版 workflow 缺欄位時 fallback 到 pages.json。
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

  const workflowKeys = new Set(workflow.pages.map((p) => pageIdKey(p)));
  const pageEntries = new Map(pages.pages.map((p) => [pageIdKey(p), p]));

  const missingFromPages = workflow.pages.filter((p) => !pageEntries.has(pageIdKey(p)));
  const missingFromWorkflow = pages.pages.filter((p) => !workflowKeys.has(pageIdKey(p)));
  if (missingFromPages.length || missingFromWorkflow.length) {
    const parts: string[] = [];
    if (missingFromPages.length) {
      parts.push(`workflow.json 描述了 pages.json 沒有的 Page：${missingFromPages.map(pageLabel).join("、")}`);
    }
    if (missingFromWorkflow.length) {
      parts.push(`pages.json 有但 workflow.json 未描述的 Page：${missingFromWorkflow.map(pageLabel).join("、")}`);
    }
    throw new ExportInputConsistencyError(`workflow.json 與 pages.json 未一一對應——${parts.join("；")}`);
  }

  const screenshots = new Map<string, ScreenshotImage>();
  for (const page of workflow.pages) {
    const key = pageIdKey(page);
    const entry = pageEntries.get(key)!;
    if (page.screenshot !== undefined && page.screenshot !== entry.screenshot) {
      throw new ExportInputConsistencyError(
        `Page ${pageLabel(page)} 的截圖對應不一致：workflow.json=${page.screenshot}；pages.json=${entry.screenshot}`,
      );
    }

    const screenshot = page.screenshot ?? entry.screenshot;
    const file = join(shotsDir, screenshot);
    requirePrerequisite({
      path: file,
      file: `${SCREENSHOTS_DIR}/${screenshot}`,
      previousStep: CONTRACT_PRODUCER.pages,
    });
    screenshots.set(key, {
      buffer: readFileSync(file),
      extension: toImageExtension(screenshot),
    });
  }

  return { workflow, screenshots };
}
