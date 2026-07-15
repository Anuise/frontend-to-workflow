import { type Pages, loadPages } from "../contracts/pages";
import { CONTRACT_PRODUCER, SCREENSHOTS_DIR, screenshotsPath } from "../output";
import { requireContract, requirePrerequisite } from "../prerequisites";

/**
 * f2w-describe 的前置入口：確認 f2w-capture 的產出（pages.json 與 screenshots/）皆已存在，
 * 讀回並驗證後回傳 Pages。任一缺件即丟 MissingPrerequisiteError，訊息提示先跑 f2w-capture。
 * 回傳的 Pages 是逐頁描述的來源：每個 Page 的 route/tab 與對應截圖檔名。
 */
export function loadCapturedPages(outputRoot: string, project: string): Pages {
  const pagesPath = requireContract(outputRoot, project, "pages");
  requirePrerequisite({
    path: screenshotsPath(outputRoot, project),
    file: `${SCREENSHOTS_DIR}/`,
    previousStep: CONTRACT_PRODUCER.pages,
  });
  return loadPages(pagesPath);
}
