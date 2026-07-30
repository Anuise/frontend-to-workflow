import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSourcedWorkitems } from "../contracts/sourcedWorkitems";
import { ContractValidationError } from "../contracts/validate";
import { type Workitems, parseWorkitems } from "../contracts/workitems";
import { contractPath } from "../output";
import {
  type PartyAssignment,
  SourcingConsistencyError,
  buildSourcedWorkitems,
  saveSourcedWorkitems,
} from "./buildSourcedWorkitems";
import type { VendorCapability } from "./parseVendorSpec";

const workitems: Workitems = parseWorkitems({
  project: "demo",
  frontend: [
    {
      id: "FE-01-01",
      sourcePage: { route: "/" },
      title: "模型清單頁",
      scope: "列出模型。",
      acceptance: "看得到清單。",
      dependsOn: [],
      risk: "",
      inferred: false,
    },
  ],
  backend: [
    {
      id: "BE-1",
      sourcePage: { route: "/" },
      title: "模型清單查詢",
      scope: "回傳模型清單。",
      acceptance: "欄位齊全。",
      dependsOn: [],
      risk: "",
      inferred: true,
    },
    {
      id: "BE-2",
      sourcePage: { route: "/" },
      title: "模型用量彙總",
      scope: "彙總各模型用量。",
      acceptance: "數字可對帳。",
      dependsOn: ["BE-1"],
      risk: "彙總口徑易與供應商不同。",
      inferred: true,
    },
    {
      id: "BE-3",
      sourcePage: { route: "/" },
      title: "稽核日誌",
      scope: "記錄查詢行為。",
      acceptance: "可追溯操作者。",
      dependsOn: ["BE-2"],
      risk: "",
      inferred: true,
    },
  ],
});

/** 權責泳道圖的泳道名（AI 讀圖抽出後傳入）。 */
const parties = ["mobagel", "gary", "leadtek"];

const capabilities: VendorCapability[] = [
  {
    vendor: "Gateway-API",
    endpoint: "GET /models",
    method: "GET",
    path: "/models",
    summary: "列出模型",
    parameters: [],
    responses: [],
  },
  {
    vendor: "Gateway-API",
    endpoint: "GET /usage",
    method: "GET",
    path: "/usage",
    summary: "用量原始資料",
    parameters: [],
    responses: [],
  },
];

const assignments: PartyAssignment[] = [
  {
    itemId: "BE-1",
    assignedParty: "gary",
    vendor: "Gateway-API",
    vendorEndpoints: ["GET /models"],
  },
  {
    // 跨方接力：gary 出用量端點、mobagel 接回彙總
    itemId: "BE-2",
    parts: [
      {
        id: "BE-2-fetch",
        title: "串接用量端點",
        scope: "呼叫 GET /usage 取回原始用量。",
        acceptance: "取得完整分頁資料。",
        assignedParty: "gary",
        vendor: "Gateway-API",
        vendorEndpoints: ["GET /usage"],
      },
      {
        id: "BE-2-process",
        title: "用量彙總處理層",
        scope: "把原始用量彙總成平台口徑。",
        acceptance: "彙總數字與原始資料可對帳。",
        assignedParty: "mobagel",
      },
    ],
  },
  { itemId: "BE-3", assignedParty: "mobagel" },
];

describe("buildSourcedWorkitems", () => {
  it("逐筆派方、跨方接力拆項，並把指向被拆 id 的依賴改指接力最後一筆", () => {
    const sourced = buildSourcedWorkitems(workitems, parties, capabilities, assignments);

    expect(sourced.backend.map((i) => i.id)).toEqual([
      "BE-1",
      "BE-2-fetch",
      "BE-2-process",
      "BE-3",
    ]);
    const direct = sourced.backend[0]!;
    const fetch = sourced.backend[1]!;
    const process = sourced.backend[2]!;
    const audit = sourced.backend[3]!;

    expect(direct.assignedParty).toBe("gary");
    expect(direct.vendor).toBe("Gateway-API");
    expect(direct.vendorEndpoints).toEqual(["GET /models"]);

    // 拆項：首筆承接原依賴並掛端點，後筆接力依賴前一筆、不掛端點
    expect(fetch.assignedParty).toBe("gary");
    expect(fetch.dependsOn).toEqual(["BE-1"]);
    expect(fetch.vendorEndpoints).toEqual(["GET /usage"]);
    expect(fetch.risk).toBe("彙總口徑易與供應商不同。");
    expect(process.assignedParty).toBe("mobagel");
    expect(process.dependsOn).toEqual(["BE-2-fetch"]);
    expect(process.vendorEndpoints).toEqual([]);
    expect([fetch.originItemId, process.originItemId]).toEqual(["BE-2", "BE-2"]);

    // 原 BE-2 已不存在，BE-3 的依賴改指接力最後一筆
    expect(audit.assignedParty).toBe("mobagel");
    expect(audit.dependsOn).toEqual(["BE-2-process"]);
    expect(audit.vendor).toBeUndefined();

    // 一律待人核；前端原封複製
    expect(sourced.backend.every((i) => i.sourcingConfirmed === false)).toBe(true);
    expect(sourced.frontend).toEqual(workitems.frontend);
  });

  it("只給泳道方名、不給任何 Vendor spec 也能派工", () => {
    const noSpec: PartyAssignment[] = [
      { itemId: "BE-1", assignedParty: "gary" },
      { itemId: "BE-2", assignedParty: "leadtek" },
      { itemId: "BE-3", assignedParty: "needs-investigation" },
    ];
    const sourced = buildSourcedWorkitems(workitems, parties, [], noSpec);
    expect(sourced.backend.map((i) => i.assignedParty)).toEqual([
      "gary",
      "leadtek",
      "needs-investigation",
    ]);
    expect(sourced.backend.every((i) => i.vendorEndpoints.length === 0)).toBe(true);
  });

  it("泳道名與 spec 皆缺（分工方集合為空）即丟 SourcingConsistencyError", () => {
    expect(() => buildSourcedWorkitems(workitems, [], [], assignments)).toThrow(
      /分工方集合為空/,
    );
  });

  it("漏給、多給或重複給歸屬都丟 SourcingConsistencyError", () => {
    expect(() =>
      buildSourcedWorkitems(workitems, parties, capabilities, assignments.slice(0, 2)),
    ).toThrow(/缺分工歸屬/);
    expect(() =>
      buildSourcedWorkitems(workitems, parties, capabilities, [
        ...assignments,
        { itemId: "BE-9", assignedParty: "mobagel" },
      ]),
    ).toThrow(SourcingConsistencyError);
    expect(() =>
      buildSourcedWorkitems(workitems, parties, capabilities, [...assignments, assignments[2]!]),
    ).toThrow(/多筆歸屬/);
  });

  it("assignedParty 不在分工方集合內即丟 SourcingConsistencyError", () => {
    const stranger = assignments.map((a) =>
      a.itemId === "BE-3" ? { ...a, assignedParty: "Nobody" } : a,
    );
    expect(() => buildSourcedWorkitems(workitems, parties, capabilities, stranger)).toThrow(
      /不在分工方集合內/,
    );
  });

  it("端點或 vendor 不在 spec 內即丟 SourcingConsistencyError", () => {
    const badEndpoint = assignments.map((a) =>
      a.itemId === "BE-1" ? { ...a, vendorEndpoints: ["DELETE /models"] } : a,
    );
    expect(() => buildSourcedWorkitems(workitems, parties, capabilities, badEndpoint)).toThrow(
      /不存在於 Gateway-API 的 spec/,
    );

    const badVendor = assignments.map((a) =>
      a.itemId === "BE-1" ? { ...a, vendor: "Nope", vendorEndpoints: ["GET /x"] } : a,
    );
    expect(() => buildSourcedWorkitems(workitems, parties, capabilities, badVendor)).toThrow(
      /不在已解析的 Vendor spec 內/,
    );
  });

  it("needs-investigation 攀附供應商、或 vendor 與端點不成對都擋下", () => {
    const clingy = assignments.map((a) =>
      a.itemId === "BE-3"
        ? {
            ...a,
            assignedParty: "needs-investigation",
            vendor: "Gateway-API",
            vendorEndpoints: ["GET /models"],
          }
        : a,
    );
    expect(() => buildSourcedWorkitems(workitems, parties, capabilities, clingy)).toThrow(
      /不得帶 vendor/,
    );

    const unpaired = assignments.map((a) =>
      a.itemId === "BE-3" ? { ...a, vendor: "Gateway-API" } : a,
    );
    expect(() => buildSourcedWorkitems(workitems, parties, capabilities, unpaired)).toThrow(
      /必須成對/,
    );
  });

  it("拆項不足兩筆、頂層並填歸屬、或兩種形式皆缺都擋下", () => {
    const half = assignments.map((a) =>
      a.itemId === "BE-2" ? { ...a, parts: a.parts!.slice(0, 1) } : a,
    );
    expect(() => buildSourcedWorkitems(workitems, parties, capabilities, half)).toThrow(
      /至少拆兩筆/,
    );

    const both = assignments.map((a) =>
      a.itemId === "BE-2" ? { ...a, assignedParty: "gary" } : a,
    );
    expect(() => buildSourcedWorkitems(workitems, parties, capabilities, both)).toThrow(
      /頂層不得再帶/,
    );

    const neither = assignments.map((a) => (a.itemId === "BE-3" ? { itemId: "BE-3" } : a));
    expect(() => buildSourcedWorkitems(workitems, parties, capabilities, neither)).toThrow(
      /必須給 assignedParty 或 parts/,
    );
  });
});

describe("saveSourcedWorkitems", () => {
  it("驗證通過才寫檔，且讀回與寫入相同", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-sourcing-out-"));
    const sourced = buildSourcedWorkitems(workitems, parties, capabilities, assignments);

    const path = saveSourcedWorkitems(root, "demo", sourced);
    expect(path).toBe(contractPath(root, "demo", "workitemsSourced"));
    expect(loadSourcedWorkitems(path)).toEqual(sourced);

    rmSync(root, { recursive: true, force: true });
  });

  it("sourcingConfirmed 不是 false 就冒泡 ContractValidationError 且不落地", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-sourcing-out-"));
    const sourced = buildSourcedWorkitems(workitems, parties, capabilities, assignments);
    const tampered = {
      ...sourced,
      backend: sourced.backend.map((i) => ({ ...i, sourcingConfirmed: true })),
    };

    expect(() => saveSourcedWorkitems(root, "demo", tampered)).toThrow(ContractValidationError);

    rmSync(root, { recursive: true, force: true });
  });
});
