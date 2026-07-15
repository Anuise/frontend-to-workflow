import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadManifest } from "../contracts/manifest";
import { ContractValidationError } from "../contracts/validate";
import { contractPath } from "../output";
import { saveManifest } from "./save";

const valid = {
  project: "sample-frontend",
  install: "npm install",
  start: "npm run start",
  port: 4173,
  baseUrl: "http://localhost:4173",
};

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "f2w-save-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("saveManifest", () => {
  it("保存合法 Manifest 後可被 loadManifest 讀回且相等", () => {
    const path = saveManifest(root, "sample-frontend", valid);
    expect(path).toBe(contractPath(root, "sample-frontend", "manifest"));
    expect(loadManifest(path)).toEqual(valid);
  });

  it("拒絕非法 Manifest：丟 ContractValidationError 且不落地任何檔案", () => {
    const bad = { ...valid, port: 70000 };
    expect(() => saveManifest(root, "sample-frontend", bad)).toThrow(ContractValidationError);
    expect(existsSync(contractPath(root, "sample-frontend", "manifest"))).toBe(false);
  });
});
