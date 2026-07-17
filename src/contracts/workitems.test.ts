import { describe, expect, it } from "vitest";
import { ContractValidationError } from "./validate";
import { parseWorkitems } from "./workitems";

/** 一份合法的 workitems：兩筆前端（各對應一頁）、一筆後端（推論）。 */
const validWorkitems = {
  project: "sample-frontend",
  frontend: [
    {
      id: "FE-1",
      sourcePage: { route: "/" },
      title: "首頁進入點",
      scope: "渲染歡迎訊息與導覽連結。",
      acceptance: "開啟 / 能看到導覽連結並可點擊。",
      dependsOn: [],
      risk: "",
      inferred: false,
    },
    {
      id: "FE-2",
      sourcePage: { route: "/settings", tab: "個人資料" },
      title: "個人資料表單",
      scope: "顯示並編輯姓名與 Email。",
      acceptance: "輸入合法值後可提交。",
      dependsOn: ["FE-1"],
      risk: "欄位驗證規則待確認。",
      inferred: false,
    },
  ],
  backend: [
    {
      id: "BE-1",
      sourcePage: { route: "/settings", tab: "個人資料" },
      title: "個人資料儲存 API",
      scope: "接收並持久化個人資料。",
      acceptance: "提交後資料落地並可讀回。",
      dependsOn: ["FE-2"],
      risk: "",
      inferred: true,
    },
  ],
};

describe("parseWorkitems", () => {
  it("接受合法 workitems（含空 risk、跨陣列 dependsOn、後端推論旗標）", () => {
    const w = parseWorkitems(validWorkitems);
    expect(w.project).toBe("sample-frontend");
    expect(w.frontend).toHaveLength(2);
    expect(w.backend).toHaveLength(1);
    expect(w.frontend[0]?.risk).toBe("");
    expect(w.frontend[0]?.inferred).toBe(false);
    expect(w.backend[0]?.inferred).toBe(true);
    expect(w.backend[0]?.sourcePage).toEqual({ route: "/settings", tab: "個人資料" });
  });

  it("契約：空 id／title／scope／acceptance 冒泡 ContractValidationError", () => {
    const blanks = ["id", "title", "scope", "acceptance"] as const;
    for (const field of blanks) {
      const bad = {
        ...validWorkitems,
        frontend: [{ ...validWorkitems.frontend[0], [field]: "" }, validWorkitems.frontend[1]],
      };
      expect(() => parseWorkitems(bad)).toThrow(ContractValidationError);
    }
  });

  it("契約：id 跨 frontend＋backend 重複時丟 ContractValidationError", () => {
    const bad = {
      ...validWorkitems,
      backend: [{ ...validWorkitems.backend[0], id: "FE-1" }],
    };
    expect(() => parseWorkitems(bad)).toThrow(ContractValidationError);
  });

  it("契約：前端 inferred 為 true 時丟 ContractValidationError", () => {
    const bad = {
      ...validWorkitems,
      frontend: [{ ...validWorkitems.frontend[0], inferred: true }, validWorkitems.frontend[1]],
    };
    expect(() => parseWorkitems(bad)).toThrow(ContractValidationError);
  });

  it("契約：後端 inferred 為 false 時丟 ContractValidationError", () => {
    const bad = {
      ...validWorkitems,
      backend: [{ ...validWorkitems.backend[0], inferred: false }],
    };
    expect(() => parseWorkitems(bad)).toThrow(ContractValidationError);
  });
});
