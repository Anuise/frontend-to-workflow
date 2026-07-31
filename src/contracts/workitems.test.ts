import { describe, expect, it } from "vitest";
import { ContractValidationError } from "./validate";
import {
  frontendWorkitemId,
  parsePartyLegLabel,
  parseWorkitems,
  partyLegLabel,
} from "./workitems";

/** 一份合法的 workitems：兩筆前端（各對應一頁）、一筆後端（推論）。 */
const validWorkitems = {
  project: "sample-frontend",
  frontend: [
    {
      id: "FE-01-01",
      sourcePage: { route: "/" },
      title: "首頁進入點",
      scope: "渲染歡迎訊息與導覽連結。",
      acceptance: "開啟 / 能看到導覽連結並可點擊。",
      dependsOn: [],
      risk: "",
      inferred: false,
    },
    {
      id: "FE-02-01",
      sourcePage: { route: "/settings", tab: "個人資料" },
      title: "個人資料表單",
      scope: "顯示並編輯姓名與 Email。",
      acceptance: "輸入合法值後可提交。",
      dependsOn: ["FE-01-01"],
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
      dependsOn: ["FE-02-01"],
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
      backend: [{ ...validWorkitems.backend[0], id: "FE-01-01" }],
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

  it("契約：前端 id 不合 FE-<頁序>-<該頁工項序> 時丟錯，且訊息指名該筆 id", () => {
    for (const badId of ["FE-1", "FE-P01-A1", "fe-01-01", "FE-01", "BE-01-01"]) {
      const bad = {
        ...validWorkitems,
        frontend: [{ ...validWorkitems.frontend[0], id: badId }, validWorkitems.frontend[1]],
      };
      expect(() => parseWorkitems(bad)).toThrow(ContractValidationError);
      expect(() => parseWorkitems(bad)).toThrow(new RegExp(badId));
    }
  });

  it("契約：後端 id 不受前端格式約束（自訂 id 照樣通過）", () => {
    const w = parseWorkitems({
      ...validWorkitems,
      backend: [{ ...validWorkitems.backend[0], id: "BE-EXTRA-01" }],
    });
    expect(w.backend[0]?.id).toBe("BE-EXTRA-01");
  });

  it("契約：後端 inferred 為 false 時丟 ContractValidationError", () => {
    const bad = {
      ...validWorkitems,
      backend: [{ ...validWorkitems.backend[0], inferred: false }],
    };
    expect(() => parseWorkitems(bad)).toThrow(ContractValidationError);
  });
});

describe("partyChain 契約", () => {
  /** 由 validWorkitems 換一批後端工項；其餘原封。 */
  const withBackend = (backend: unknown[]) => ({ ...validWorkitems, backend });
  const chained = (partyChain: unknown) => ({
    ...validWorkitems.backend[0]!,
    partyChain,
    sourcingConfirmed: false,
  });
  const secondItem = (partyChain: unknown) => ({
    ...validWorkitems.backend[0]!,
    id: "BE-2",
    partyChain,
    sourcingConfirmed: false,
  });
  const leg = (party: string, extra: Record<string, unknown> = {}) => ({
    party,
    vendorEndpoints: [],
    ...extra,
  });
  const prose = { title: "一段", scope: "一段範疇。", acceptance: "一段驗收。" };

  it("接受不帶 partyChain 的工項（既有專案不改一個字就能過）", () => {
    expect(() => parseWorkitems(validWorkitems)).not.toThrow();
  });

  it("後端只有部分工項帶 partyChain 時被擋下，訊息指出缺的那幾筆 id", () => {
    const bad = withBackend([chained([leg("mobagel")]), { ...validWorkitems.backend[0]!, id: "BE-2" }]);
    expect(() => parseWorkitems(bad)).toThrow(ContractValidationError);
    expect(() => parseWorkitems(bad)).toThrow(/BE-2/);
  });

  it("工項 id 含 # 被擋下並指名該筆", () => {
    const bad = withBackend([{ ...validWorkitems.backend[0]!, id: "BE-1#2" }]);
    expect(() => parseWorkitems(bad)).toThrow(/BE-1#2/);
  });

  it("多 leg 而某個 leg 缺散文時被擋下並指名該 leg 序", () => {
    const bad = withBackend([
      chained([leg("mobagel", prose), leg("gary"), leg("leadtek", prose)]),
    ]);
    expect(() => parseWorkitems(bad)).toThrow(/leg 2/);
  });

  it("單 leg 且三欄皆缺時合法（缺欄繼承工項層）", () => {
    expect(() => parseWorkitems(withBackend([chained([leg("mobagel")])]))).not.toThrow();
  });

  it("leg 的 vendor 與 vendorEndpoints 不成對時被擋下", () => {
    const onlyVendor = withBackend([chained([{ party: "gary", vendor: "gary", vendorEndpoints: [] }])]);
    expect(() => parseWorkitems(onlyVendor)).toThrow(ContractValidationError);
    const onlyEndpoints = withBackend([chained([{ party: "gary", vendorEndpoints: ["GET /x"] }])]);
    expect(() => parseWorkitems(onlyEndpoints)).toThrow(ContractValidationError);
  });

  it("needs-investigation 不得帶 vendor，也不得出現在多 leg 鏈裡", () => {
    const withVendor = withBackend([
      chained([{ party: "needs-investigation", vendor: "gary", vendorEndpoints: ["GET /x"] }]),
    ]);
    expect(() => parseWorkitems(withVendor)).toThrow(ContractValidationError);

    const inChain = withBackend([
      chained([leg("mobagel", prose), leg("needs-investigation", prose)]),
      secondItem([leg("mobagel")]),
    ]);
    expect(() => parseWorkitems(inChain)).toThrow(/needs-investigation/);
  });
});

describe("partyLegLabel", () => {
  it("單 leg 是裸 id，多 leg 加 #<leg序>", () => {
    expect(partyLegLabel("BE-MODEL-1", 1)).toBe("BE-MODEL-1");
    expect(partyLegLabel("BE-MODEL-1", 2)).toBe("BE-MODEL-1#2");
    expect(partyLegLabel("BE-MODEL-1", 1, 3)).toBe("BE-MODEL-1#1");
    expect(partyLegLabel("BE-MODEL-1", 1, 1)).toBe("BE-MODEL-1");
  });

  it("切得回去——工項 id 不含 # 由契約保證，所以切法無歧義", () => {
    expect(parsePartyLegLabel("BE-MODEL-1")).toEqual({ itemId: "BE-MODEL-1" });
    expect(parsePartyLegLabel("BE-MODEL-1#2")).toEqual({ itemId: "BE-MODEL-1", legIndex: 2 });
  });
});

describe("frontendWorkitemId", () => {
  it("由 0-based 索引推導出補零兩位、從 01 起的 id", () => {
    expect(frontendWorkitemId(0, 0)).toBe("FE-01-01");
    expect(frontendWorkitemId(9, 11)).toBe("FE-10-12");
  });

  it("超過兩位數的頁序不截斷", () => {
    expect(frontendWorkitemId(99, 0)).toBe("FE-100-01");
  });
});
