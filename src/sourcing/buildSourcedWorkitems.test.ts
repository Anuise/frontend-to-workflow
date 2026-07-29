import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSourcedWorkitems } from "../contracts/sourcedWorkitems";
import { ContractValidationError } from "../contracts/validate";
import { type Workitems, parseWorkitems } from "../contracts/workitems";
import { contractPath } from "../output";
import {
  type SourcingDecision,
  SourcingConsistencyError,
  buildSourcedWorkitems,
  saveSourcedWorkitems,
} from "./buildSourcedWorkitems";
import type { VendorCapability } from "./parseVendorSpec";

const workitems: Workitems = parseWorkitems({
  project: "demo",
  frontend: [
    {
      id: "FE-1",
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

const decisions: SourcingDecision[] = [
  {
    itemId: "BE-1",
    sourcing: "vendor-direct",
    vendor: "Gateway-API",
    vendorEndpoints: ["GET /models"],
  },
  {
    itemId: "BE-2",
    sourcing: "vendor-adapted",
    vendor: "Gateway-API",
    vendorEndpoints: ["GET /usage"],
    fetch: {
      id: "BE-2-fetch",
      title: "串接用量端點",
      scope: "呼叫 GET /usage 取回原始用量。",
      acceptance: "取得完整分頁資料。",
    },
    process: {
      id: "BE-2-process",
      title: "用量彙總處理層",
      scope: "把原始用量彙總成平台口徑。",
      acceptance: "彙總數字與原始資料可對帳。",
    },
  },
  { itemId: "BE-3", sourcing: "self-built" },
];

describe("buildSourcedWorkitems", () => {
  it("逐桶貼標、vendor-adapted 拆兩筆，並把指向被拆 id 的依賴改指 process 筆", () => {
    const sourced = buildSourcedWorkitems(workitems, capabilities, decisions);

    expect(sourced.backend.map((i) => i.id)).toEqual([
      "BE-1",
      "BE-2-fetch",
      "BE-2-process",
      "BE-3",
    ]);
    const direct = sourced.backend[0]!;
    const fetch = sourced.backend[1]!;
    const process = sourced.backend[2]!;
    const selfBuilt = sourced.backend[3]!;

    expect(direct.sourcing).toBe("vendor-direct");
    expect(direct.vendorEndpoints).toEqual(["GET /models"]);
    expect(direct.adaptationRole).toBeUndefined();

    // 拆項：fetch 承接原依賴並掛端點，process 只依賴 fetch 且不列端點
    expect(fetch.adaptationRole).toBe("fetch");
    expect(fetch.dependsOn).toEqual(["BE-1"]);
    expect(fetch.vendorEndpoints).toEqual(["GET /usage"]);
    expect(fetch.risk).toBe("彙總口徑易與供應商不同。");
    expect(process.adaptationRole).toBe("process");
    expect(process.dependsOn).toEqual(["BE-2-fetch"]);
    expect(process.vendorEndpoints).toEqual([]);
    expect([fetch.originItemId, process.originItemId]).toEqual(["BE-2", "BE-2"]);

    // 原 BE-2 已不存在，BE-3 的依賴改指完整能力那一筆
    expect(selfBuilt.sourcing).toBe("self-built");
    expect(selfBuilt.dependsOn).toEqual(["BE-2-process"]);
    expect(selfBuilt.vendor).toBeUndefined();

    // 一律待人核；前端原封複製
    expect(sourced.backend.every((i) => i.sourcingConfirmed === false)).toBe(true);
    expect(sourced.frontend).toEqual(workitems.frontend);
  });

  it("漏給、多給或重複給決策都丟 SourcingConsistencyError", () => {
    expect(() => buildSourcedWorkitems(workitems, capabilities, decisions.slice(0, 2))).toThrow(
      /缺來源決策/,
    );
    expect(() =>
      buildSourcedWorkitems(workitems, capabilities, [
        ...decisions,
        { itemId: "BE-9", sourcing: "self-built" },
      ]),
    ).toThrow(SourcingConsistencyError);
    expect(() =>
      buildSourcedWorkitems(workitems, capabilities, [...decisions, decisions[2]!]),
    ).toThrow(/多筆決策/);
  });

  it("端點或 vendor 不在 spec 內即丟 SourcingConsistencyError", () => {
    const badEndpoint = decisions.map((d) =>
      d.itemId === "BE-1" ? { ...d, vendorEndpoints: ["DELETE /models"] } : d,
    );
    expect(() => buildSourcedWorkitems(workitems, capabilities, badEndpoint)).toThrow(
      /不存在於 Gateway-API 的 spec/,
    );

    const badVendor = decisions.map((d) => (d.itemId === "BE-1" ? { ...d, vendor: "Nope" } : d));
    expect(() => buildSourcedWorkitems(workitems, capabilities, badVendor)).toThrow(
      /不在已解析的 Vendor spec 內/,
    );
  });

  it("自建攀附供應商、或 vendor-adapted 沒給兩筆拆項都擋下", () => {
    const clingy = decisions.map((d) => (d.itemId === "BE-3" ? { ...d, vendor: "Gateway-API" } : d));
    expect(() => buildSourcedWorkitems(workitems, capabilities, clingy)).toThrow(/不得帶 vendor/);

    const halfSplit = decisions.map((d) => (d.itemId === "BE-2" ? { ...d, process: undefined } : d));
    expect(() => buildSourcedWorkitems(workitems, capabilities, halfSplit)).toThrow(
      /必須同時給 fetch 與 process/,
    );
  });
});

describe("saveSourcedWorkitems", () => {
  it("驗證通過才寫檔，且讀回與寫入相同", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-sourcing-out-"));
    const sourced = buildSourcedWorkitems(workitems, capabilities, decisions);

    const path = saveSourcedWorkitems(root, "demo", sourced);
    expect(path).toBe(contractPath(root, "demo", "workitemsSourced"));
    expect(loadSourcedWorkitems(path)).toEqual(sourced);

    rmSync(root, { recursive: true, force: true });
  });

  it("sourcingConfirmed 不是 false 就冒泡 ContractValidationError 且不落地", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-sourcing-out-"));
    const sourced = buildSourcedWorkitems(workitems, capabilities, decisions);
    const tampered = {
      ...sourced,
      backend: sourced.backend.map((i) => ({ ...i, sourcingConfirmed: true })),
    };

    expect(() => saveSourcedWorkitems(root, "demo", tampered)).toThrow(ContractValidationError);

    rmSync(root, { recursive: true, force: true });
  });
});
