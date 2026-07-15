import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { parseManifest } from "../contracts/manifest";
import { contractPath } from "../output";

/**
 * 把（已確認的）Manifest 驗證後保存成 output/<project>/manifest.yml。
 * 契約驗證失敗即丟 ContractValidationError，且不落地任何檔案。
 */
export function saveManifest(outputRoot: string, project: string, manifest: unknown): string {
  const validated = parseManifest(manifest); // 於寫檔前擋下不合契約的值
  const path = contractPath(outputRoot, project, "manifest");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyYaml(validated), "utf8");
  return path;
}
