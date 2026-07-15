import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { validate } from "./validate";

/**
 * Manifest（啟動描述檔）契約：描述單一 project 如何安裝、啟動、對外 port 與 base URL。
 * 由 f2w-start 首次偵測、確認後保存為 output/<project>/manifest.yml。
 */
export const manifestSchema = z.object({
  project: z.string().min(1),
  install: z.string().min(1),
  start: z.string().min(1),
  port: z.number().int().positive().max(65535),
  baseUrl: z.string().url(),
});

export type Manifest = z.infer<typeof manifestSchema>;

/** 驗證一個（已解析的）Manifest 物件。 */
export function parseManifest(data: unknown): Manifest {
  return validate("manifest.yml", manifestSchema, data);
}

/** 讀取並驗證 manifest.yml 檔（YAML）。 */
export function loadManifest(path: string): Manifest {
  return parseManifest(parseYaml(readFileSync(path, "utf8")));
}
