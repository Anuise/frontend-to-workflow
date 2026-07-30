import { describe, expect, it } from "vitest";
import { ensureInstalled, resolveManifest, saveManifest } from "../src/start";
import { loadManifest } from "../src/contracts/manifest";

const OUTPUT_ROOT = "output";
const PROJECT = "0729_AI六大模組管理平台_5E_AI平台最新版";
const PROJECT_DIR = `workspace/${PROJECT}`;

// 沿用同款 Figma Make 匯出已確認的 Manifest 模式（pnpm@9 + vite --port，非偵測的 npm/4173）。
const CONFIRMED = {
  project: PROJECT,
  install: "corepack pnpm@9 install",
  start: "corepack pnpm@9 exec vite --port 5173 --strictPort",
  port: 5173,
  baseUrl: "http://localhost:5173",
};

describe("f2w-start", () => {
  it("保存確認後的 manifest 並安裝相依", { timeout: 1_200_000 }, async () => {
    const before = resolveManifest(OUTPUT_ROOT, PROJECT, PROJECT_DIR);
    if (!before.reused) {
      const path = saveManifest(OUTPUT_ROOT, PROJECT, CONFIRMED);
      expect(loadManifest(path)).toEqual(CONFIRMED);
    }

    await ensureInstalled(CONFIRMED, PROJECT_DIR);
  });
});
