import { basename, extname, join } from "node:path";

/** 所有跨步驟狀態一律落地在 output/<project>/ 下的這些檔名。 */
export const CONTRACT_FILES = {
  manifest: "manifest.yml",
  pages: "pages.json",
  workflow: "workflow.json",
  workbook: "workflow.xlsx",
  mainflow: "mainflow.json",
  diagram: "mainflow.drawio",
  workitems: "workitems.json",
  workitemsWorkbook: "workitems.xlsx",
} as const;

export type ContractName = keyof typeof CONTRACT_FILES;

/** 截圖存放子目錄名。 */
export const SCREENSHOTS_DIR = "screenshots";

/** 產生每個契約檔的 step——缺前置檔時用來提示「請先跑上一步」。 */
export const CONTRACT_PRODUCER: Record<ContractName, string> = {
  manifest: "f2w-start",
  pages: "f2w-capture",
  workflow: "f2w-describe",
  workbook: "f2w-export",
  mainflow: "f2w-diagram",
  diagram: "f2w-diagram",
  workitems: "f2w-breakdown",
  workitemsWorkbook: "f2w-breakdown-export",
};

/** output/<project>/ 的路徑。 */
export function projectOutputDir(outputRoot: string, project: string): string {
  return join(outputRoot, project);
}

/** output/<project>/<contract-file> 的路徑。 */
export function contractPath(
  outputRoot: string,
  project: string,
  contract: ContractName,
): string {
  return join(projectOutputDir(outputRoot, project), CONTRACT_FILES[contract]);
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/** 交付物檔名用的時戳：本地時間的 YYYYMMDD-HHmmss（如 20260803-153012）。 */
export function timestampSuffix(at: Date): string {
  const date = `${pad(at.getFullYear(), 4)}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `${date}-${time}`;
}

/**
 * 帶時戳的契約檔路徑：時戳插在副檔名之前，如
 * output/<project>/workflow-20260803-153012.xlsx。
 * 供 export 步的最終交付物使用——每次重跑各留一份、不互相覆蓋。
 */
export function timestampedContractPath(
  outputRoot: string,
  project: string,
  contract: ContractName,
  at: Date,
): string {
  const file = CONTRACT_FILES[contract];
  const ext = extname(file);
  return join(
    projectOutputDir(outputRoot, project),
    `${basename(file, ext)}-${timestampSuffix(at)}${ext}`,
  );
}

/** output/<project>/screenshots 的路徑。 */
export function screenshotsPath(outputRoot: string, project: string): string {
  return join(projectOutputDir(outputRoot, project), SCREENSHOTS_DIR);
}
