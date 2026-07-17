import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MissingPrerequisiteError } from "../prerequisites";
import { loadWorkitemsForExport } from "./inputs";

// fixtures/contracts/ 恰好符合 output/<project>/ 版面：含 workitems.json
const FIXTURE_ROOT = join(process.cwd(), "fixtures");
const FIXTURE_PROJECT = "contracts";

describe("loadWorkitemsForExport", () => {
  it("缺 workitems.json 時中止並提示先跑 f2w-breakdown（AC：缺前置檔）", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-breakdown-export-in-"));
    const call = () => loadWorkitemsForExport(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/workitems\.json/);
    expect(call).toThrow(/f2w-breakdown/);
    rmSync(root, { recursive: true, force: true });
  });

  it("前置齊備時讀回並驗證 workitems（用真實 fixtures）", () => {
    const workitems = loadWorkitemsForExport(FIXTURE_ROOT, FIXTURE_PROJECT);
    expect(workitems.project).toBe("sample-frontend");
    expect(workitems.frontend).toHaveLength(4);
    expect(workitems.backend).toHaveLength(2);
    // 契約旗標：前端非推論、後端推論
    expect(workitems.frontend.every((i) => i.inferred === false)).toBe(true);
    expect(workitems.backend.every((i) => i.inferred === true)).toBe(true);
  });
});
