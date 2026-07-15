import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveManifest } from "./resolve";
import { saveManifest } from "./save";

const sampleProjectDir = join(process.cwd(), "fixtures/sample-project");

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "f2w-resolve-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("resolveManifest", () => {
  it("已存在 manifest.yml 時重用既有值、不重新偵測（尊重手改）", () => {
    // 手改值刻意與偵測結果不同（port 9999、非預設 start），用來證明沒有重新偵測。
    const edited = {
      project: "sample-frontend",
      install: "npm ci",
      start: "npm run serve:custom",
      port: 9999,
      baseUrl: "http://localhost:9999",
    };
    saveManifest(root, "sample-frontend", edited);

    const result = resolveManifest(root, "sample-frontend", sampleProjectDir);
    expect(result.reused).toBe(true);
    expect(result.manifest).toEqual(edited);
  });

  it("缺 manifest.yml 時回傳偵測出的候選（待確認）", () => {
    const result = resolveManifest(root, "sample-frontend", sampleProjectDir);
    expect(result.reused).toBe(false);
    expect(result.manifest).toEqual({
      project: "sample-frontend",
      install: "npm install",
      start: "npm run start",
      port: 4173,
      baseUrl: "http://localhost:4173",
    });
  });
});
