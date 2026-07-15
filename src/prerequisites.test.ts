import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { contractPath } from "./output";
import {
  MissingPrerequisiteError,
  requireContract,
  requirePrerequisite,
} from "./prerequisites";

describe("requirePrerequisite", () => {
  it("前置檔存在時不丟錯", () => {
    const dir = mkdtempSync(join(tmpdir(), "f2w-"));
    const file = join(dir, "manifest.yml");
    writeFileSync(file, "x");
    expect(() =>
      requirePrerequisite({ path: file, file: "manifest.yml", previousStep: "f2w-start" }),
    ).not.toThrow();
    rmSync(dir, { recursive: true, force: true });
  });

  it("缺前置檔時丟 MissingPrerequisiteError，訊息含檔名與上一步", () => {
    const call = () =>
      requirePrerequisite({
        path: join(tmpdir(), "f2w-missing-xyz", "pages.json"),
        file: "pages.json",
        previousStep: "f2w-capture",
      });
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/pages\.json/);
    expect(call).toThrow(/f2w-capture/);
  });
});

describe("requireContract", () => {
  it("缺契約檔時報對應產出的上一步", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-out-"));
    // workflow.json 由 f2w-describe 產出
    expect(() => requireContract(root, "demo", "workflow")).toThrow(/f2w-describe/);
    rmSync(root, { recursive: true, force: true });
  });

  it("契約檔存在時回傳其路徑", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-out-"));
    const path = contractPath(root, "demo", "manifest");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "project: demo");
    expect(requireContract(root, "demo", "manifest")).toBe(path);
    rmSync(root, { recursive: true, force: true });
  });
});
