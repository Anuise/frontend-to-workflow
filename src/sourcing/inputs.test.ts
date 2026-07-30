import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { saveWorkitems } from "../breakdown/buildWorkitems";
import { MissingPrerequisiteError } from "../prerequisites";
import { loadWorkitemsForSourcing } from "./inputs";

const workitems = {
  project: "demo",
  frontend: [
    {
      id: "FE-01-01",
      sourcePage: { route: "/" },
      title: "首頁",
      scope: "顯示連結。",
      acceptance: "看得到連結。",
      dependsOn: [],
      risk: "",
      inferred: false,
    },
  ],
  backend: [
    {
      id: "BE-1",
      sourcePage: { route: "/" },
      title: "清單查詢",
      scope: "回傳清單。",
      acceptance: "欄位齊全。",
      dependsOn: [],
      risk: "",
      inferred: true,
    },
  ],
};

describe("loadWorkitemsForSourcing", () => {
  it("缺 workitems.json 時丟 MissingPrerequisiteError，訊息提示先跑 f2w-breakdown", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-sourcing-in-"));
    const call = () => loadWorkitemsForSourcing(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/f2w-breakdown/);
    rmSync(root, { recursive: true, force: true });
  });

  it("workitems.json 存在時讀回並驗證 Workitems", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-sourcing-in-"));
    saveWorkitems(root, "demo", workitems);
    const w = loadWorkitemsForSourcing(root, "demo");
    expect(w.project).toBe("demo");
    expect(w.backend).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });
  });
});
