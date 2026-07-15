import { type Manifest, loadManifest } from "../contracts/manifest";
import { requireContract } from "../prerequisites";

/**
 * f2w-capture 的前置入口：確認 output/<project>/manifest.yml 已存在（由 f2w-start 產出），
 * 讀回並驗證後回傳 Manifest。缺檔即丟 MissingPrerequisiteError，訊息提示先跑 f2w-start。
 * 回傳的 baseUrl 指向執行中的 project，供逐 Page 導覽與截圖。
 */
export function loadRunningManifest(outputRoot: string, project: string): Manifest {
  const path = requireContract(outputRoot, project, "manifest");
  return loadManifest(path);
}
