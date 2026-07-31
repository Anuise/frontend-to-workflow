import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MissingPrerequisiteError } from "../prerequisites";
import { hasPartyChains, loadWorkitemsForExport } from "./inputs";

// 合成的 workitems.json：一筆前端、一筆帶分工鏈的後端。
const SOURCED = {
  project: "demo",
  frontend: [
    {
      id: "FE-01-01",
      sourcePage: { route: "/login" },
      title: "登入表單",
      scope: "帳號密碼欄位與送出。",
      acceptance: "送出後導向首頁。",
      dependsOn: [],
      risk: "",
      inferred: false,
    },
  ],
  backend: [
    {
      id: "BE-1",
      sourcePage: { route: "/login" },
      title: "登入 API",
      scope: "驗證帳密並發工作階段。",
      acceptance: "帳密正確回 200 與 token。",
      dependsOn: ["FE-01-01"],
      risk: "",
      inferred: true,
      partyChain: [
        {
          party: "sample-vendor",
          vendor: "sample-vendor",
          vendorEndpoints: ["POST /api/v1/login"],
        },
      ],
      sourcingConfirmed: false,
    },
  ],
};

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

  it("分工鏈長在 workitems.json 上，沒有第二份檔要挑（AC：sourced 契約退場）", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-breakdown-export-sourced-"));
    mkdirSync(join(root, "demo"), { recursive: true });
    writeFileSync(join(root, "demo", "workitems.json"), JSON.stringify(SOURCED));

    const loaded = loadWorkitemsForExport(root, "demo");
    expect(hasPartyChains(loaded)).toBe(true);
    expect(loaded.backend[0]?.partyChain?.[0]).toMatchObject({
      party: "sample-vendor",
      vendor: "sample-vendor",
    });
    expect(loaded.backend[0]?.sourcingConfirmed).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  it("前置齊備時讀回並驗證 workitems（用真實 fixtures）", () => {
    const workitems = loadWorkitemsForExport(FIXTURE_ROOT, FIXTURE_PROJECT);
    expect(hasPartyChains(workitems)).toBe(false); // fixtures 不帶分工鏈
    expect(workitems.project).toBe("sample-frontend");
    expect(workitems.frontend).toHaveLength(4);
    expect(workitems.backend).toHaveLength(2);
    // 契約旗標：前端非推論、後端推論
    expect(workitems.frontend.every((i) => i.inferred === false)).toBe(true);
    expect(workitems.backend.every((i) => i.inferred === true)).toBe(true);
  });
});
