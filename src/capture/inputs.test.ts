import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { contractPath } from "../output";
import { MissingPrerequisiteError } from "../prerequisites";
import { loadRunningManifest } from "./inputs";

const validManifest = [
  "project: demo",
  "install: npm install",
  "start: npm run start",
  "port: 4173",
  "baseUrl: http://localhost:4173",
  "",
].join("\n");

function writeManifest(root: string, project: string, yaml: string): void {
  const path = contractPath(root, project, "manifest");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yaml, "utf8");
}

describe("loadRunningManifest", () => {
  it("缺 manifest.yml 時中止並提示先跑 f2w-start（AC：缺前置檔）", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-cap-in-"));
    const call = () => loadRunningManifest(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/manifest\.yml/);
    expect(call).toThrow(/f2w-start/);
    rmSync(root, { recursive: true, force: true });
  });

  it("manifest.yml 存在時讀回並驗證，回傳可截圖的 base URL", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-cap-in-"));
    writeManifest(root, "demo", validManifest);
    const manifest = loadRunningManifest(root, "demo");
    expect(manifest).toEqual({
      project: "demo",
      install: "npm install",
      start: "npm run start",
      port: 4173,
      baseUrl: "http://localhost:4173",
    });
    rmSync(root, { recursive: true, force: true });
  });
});
