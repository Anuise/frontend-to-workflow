import { existsSync } from "node:fs";
import { type Manifest, loadManifest } from "../contracts/manifest";
import { contractPath } from "../output";
import { detectManifest } from "./detect";

/**
 * resolveManifest 的結果：
 * - reused=true：重用既有 manifest.yml（含使用者手改），可直接啟動、無須再確認。
 * - reused=false：偵測出的候選，需先呈現給使用者確認、再 saveManifest 才落地。
 */
export interface ResolveResult {
  reused: boolean;
  manifest: Manifest;
}

/**
 * 決定要重用既有 manifest.yml 還是重新偵測。
 * 既有檔存在就讀回並驗證（尊重手改、不重新偵測）；不存在才偵測出候選。
 */
export function resolveManifest(
  outputRoot: string,
  project: string,
  projectDir: string,
): ResolveResult {
  const path = contractPath(outputRoot, project, "manifest");
  if (existsSync(path)) {
    return { reused: true, manifest: loadManifest(path) };
  }
  return { reused: false, manifest: detectManifest(projectDir, project) };
}
