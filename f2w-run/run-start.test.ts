import { describe, expect, it } from "vitest";
import { ensureInstalled, resolveManifest, saveManifest } from "../src/start";
import { loadManifest } from "../src/contracts/manifest";

const OUTPUT_ROOT = "output";
const PROJECT = "new_0724_AI六大模組管理平台_桃園智發會_最新版";
const PROJECT_DIR = `workspace/${PROJECT}`;

// 使用者已確認的 Manifest（Figma Make 匯出前端：pnpm@9 + vite --port，非偵測的 npm/4173）。
const CONFIRMED = {
  project: PROJECT,
  install: "corepack pnpm@9 install",
  start: "corepack pnpm@9 exec vite --port 5173 --strictPort",
  port: 5173,
  baseUrl: "http://localhost:5173",
};

describe("f2w-start", () => {
  it("保存確認後的 manifest 並安裝相依", { timeout: 1_200_000 }, async () => {
    // 這支 driver 可重跑：第一次跑時 manifest.yml 還不存在（偵測出候選，且候選必然不是
    // 使用者確認的那組——偵測看不出 Figma Make 要 pnpm@9／5173）；之後每次跑都是重用既有檔。
    // 兩種狀態都要有斷言，否則只有乾淨的 output/ 底下才過。
    const before = resolveManifest(OUTPUT_ROOT, PROJECT, PROJECT_DIR);
    if (before.reused) {
      expect(before.manifest).toEqual(CONFIRMED);
    } else {
      expect(before.manifest).not.toEqual(CONFIRMED);
    }

    const path = saveManifest(OUTPUT_ROOT, PROJECT, CONFIRMED);
    expect(loadManifest(path)).toEqual(CONFIRMED);

    await ensureInstalled(CONFIRMED, PROJECT_DIR);
  });
});
