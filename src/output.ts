import { join } from "node:path";

/** 所有跨步驟狀態一律落地在 output/<project>/ 下的這些檔名。 */
export const CONTRACT_FILES = {
  manifest: "manifest.yml",
  pages: "pages.json",
  workflow: "workflow.json",
  workbook: "workflow.xlsx",
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

/** output/<project>/screenshots 的路徑。 */
export function screenshotsPath(outputRoot: string, project: string): string {
  return join(projectOutputDir(outputRoot, project), SCREENSHOTS_DIR);
}
