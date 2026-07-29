import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  NEEDS_INVESTIGATION,
  type SourcedBackendItem,
  type SourcedWorkitems,
  parseSourcedWorkitems,
} from "../contracts/sourcedWorkitems";
import type { WorkItem, Workitems } from "../contracts/workitems";
import { contractPath } from "../output";
import { type VendorCapability, endpointsByVendor } from "./parseVendorSpec";

/** 跨方接力拆出的一筆子工項的內容（其餘欄位沿用被拆的原始後端工項）。 */
export interface SplitPart {
  id: string;
  title: string;
  scope: string;
  acceptance: string;
  risk?: string;
  assignedParty: string;
  vendor?: string;
  vendorEndpoints?: string[];
}

/**
 * 一筆後端工項的分工歸屬：派給單一分工方（assignedParty），
 * 或判定需跨方接力時給 parts（≥2 筆、依序接力）拆項；兩種形式互斥。
 */
export interface PartyAssignment {
  itemId: string;
  assignedParty?: string;
  vendor?: string;
  vendorEndpoints?: string[];
  parts?: SplitPart[];
}

/**
 * 分工歸屬與 workitems.json／輸入事實不一致時丟出：
 *  - 涵蓋：後端工項沒有歸屬、歸屬指向不存在的工項、或同一工項給了多筆歸屬；
 *  - 方名：assignedParty 不在「泳道名 ∪ spec 供應商名」集合內、或集合為空（雙輸入皆缺）；
 *  - 參照：vendor 不在 spec 內、vendorEndpoints 有 spec 沒有的端點、dependsOn 指向不存在的工項；
 *  - 欄位：needs-investigation 攀附供應商、vendor 與 endpoints 不成對、parts 與 assignedParty 並填或 parts 不足兩筆。
 */
export class SourcingConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourcingConsistencyError";
  }
}

/** 校驗一組（方名、vendor、端點）欄位；label 供錯誤訊息定位。 */
function checkAssignmentFields(
  label: string,
  assignedParty: string,
  vendor: string | undefined,
  endpoints: readonly string[],
  partySet: ReadonlySet<string>,
  byVendor: ReadonlyMap<string, Set<string>>,
): void {
  if (assignedParty === NEEDS_INVESTIGATION) {
    if (vendor !== undefined || endpoints.length) {
      throw new SourcingConsistencyError(
        `${label}：needs-investigation 不得帶 vendor 或 vendorEndpoints`,
      );
    }
    return;
  }
  if (!partySet.has(assignedParty)) {
    throw new SourcingConsistencyError(
      `${label}：assignedParty「${assignedParty}」不在分工方集合內（可用：${[...partySet].join("、")}）`,
    );
  }
  if ((vendor !== undefined) !== endpoints.length > 0) {
    throw new SourcingConsistencyError(
      `${label}：vendor 與 vendorEndpoints 必須成對（一有俱有、一空俱空）`,
    );
  }
  if (vendor !== undefined) {
    const known = byVendor.get(vendor);
    if (!known) {
      throw new SourcingConsistencyError(
        `${label}：vendor「${vendor}」不在已解析的 Vendor spec 內（可用：${[...byVendor.keys()].join("、")}）`,
      );
    }
    const badEndpoints = endpoints.filter((e) => !known.has(e));
    if (badEndpoints.length) {
      throw new SourcingConsistencyError(
        `${label}：以下端點不存在於 ${vendor} 的 spec：${badEndpoints.join("、")}`,
      );
    }
  }
}

/** 由 SplitPart 與被拆的原始工項組出一筆跨方接力子工項。 */
function splitItem(
  origin: WorkItem,
  part: SplitPart,
  dependsOn: readonly string[],
): SourcedBackendItem {
  return {
    id: part.id,
    sourcePage: origin.sourcePage,
    title: part.title,
    scope: part.scope,
    acceptance: part.acceptance,
    dependsOn: [...dependsOn],
    risk: part.risk ?? origin.risk,
    inferred: true,
    assignedParty: part.assignedParty,
    ...(part.vendor !== undefined ? { vendor: part.vendor } : {}),
    vendorEndpoints: [...(part.vendorEndpoints ?? [])],
    sourcingConfirmed: false,
    originItemId: origin.id,
  };
}

/**
 * 由 workitems.json、分工方名集合、Vendor capability 與 AI 的分工歸屬接合出並驗證 workitems-sourced 物件。
 * - 方名集合 = parties（權責泳道圖的泳道名，AI 讀圖抽出後傳入）∪ spec 供應商名；集合為空即丟錯（雙輸入皆缺）。
 * - 涵蓋：後端工項與歸屬一一對應，漏／多／重複皆丟 SourcingConsistencyError。
 * - 方名：assignedParty ∈ 方名集合 ∪ {needs-investigation}。
 * - 參照：vendor 與 vendorEndpoints 必須真的存在於對應 Vendor spec，且與 assignedParty 脫鉤。
 * - 拆項：跨方接力給 parts（≥2）——首筆承接原依賴，其後逐筆依賴前一筆，各帶 originItemId 溯源；
 *   原 id 消失，其他工項指向它的 dependsOn 一律改指最後一筆。
 * - frontend 原封複製自 workitems（單一真實來源，複製不會漂移）。
 * - sourcingConfirmed 一律 false；通過契約驗證才回傳，否則冒泡 ContractValidationError。
 */
export function buildSourcedWorkitems(
  workitems: Workitems,
  parties: readonly string[],
  capabilities: readonly VendorCapability[],
  assignments: readonly PartyAssignment[],
): SourcedWorkitems {
  const byVendor = endpointsByVendor(capabilities);
  const partySet = new Set([...parties, ...byVendor.keys()]);
  if (partySet.size === 0) {
    throw new SourcingConsistencyError(
      "分工方集合為空：權責泳道圖與 Vendor spec 至少要提供一份",
    );
  }

  // 涵蓋：歸屬與後端工項一一對應
  const backendById = new Map(workitems.backend.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const unknown: string[] = [];
  const duplicated: string[] = [];
  for (const a of assignments) {
    if (!backendById.has(a.itemId)) unknown.push(a.itemId);
    else if (seen.has(a.itemId)) duplicated.push(a.itemId);
    else seen.add(a.itemId);
  }
  const missing = workitems.backend.filter((i) => !seen.has(i.id)).map((i) => i.id);
  if (unknown.length || duplicated.length || missing.length) {
    throw new SourcingConsistencyError(
      [
        unknown.length ? `歸屬指向不存在的後端工項：${unknown.join("、")}` : "",
        duplicated.length ? `同一後端工項有多筆歸屬：${duplicated.join("、")}` : "",
        missing.length ? `以下後端工項缺分工歸屬：${missing.join("、")}` : "",
      ]
        .filter(Boolean)
        .join("；"),
    );
  }

  // 方名＋端點參照＋拆項
  const backend: SourcedBackendItem[] = [];
  const replacedBy = new Map<string, string>(); // 被拆的原 id → 接力最後一筆 id
  for (const a of assignments) {
    const origin = backendById.get(a.itemId)!;

    if (a.parts !== undefined) {
      if (a.assignedParty !== undefined || a.vendor !== undefined || a.vendorEndpoints?.length) {
        throw new SourcingConsistencyError(
          `${a.itemId}：拆項時歸屬寫在各 part 上，頂層不得再帶 assignedParty／vendor／vendorEndpoints`,
        );
      }
      if (a.parts.length < 2) {
        throw new SourcingConsistencyError(
          `${a.itemId}：跨方接力至少拆兩筆，只有一筆就直接派給該方`,
        );
      }
      a.parts.forEach((part, index) => {
        checkAssignmentFields(
          `${a.itemId} 的拆項 ${part.id}`,
          part.assignedParty,
          part.vendor,
          part.vendorEndpoints ?? [],
          partySet,
          byVendor,
        );
        // 首筆承接原依賴，其後逐筆接力依賴前一筆
        const dependsOn = index === 0 ? origin.dependsOn : [a.parts![index - 1]!.id];
        backend.push(splitItem(origin, part, dependsOn));
      });
      replacedBy.set(origin.id, a.parts[a.parts.length - 1]!.id);
      continue;
    }

    if (a.assignedParty === undefined) {
      throw new SourcingConsistencyError(`${a.itemId}：必須給 assignedParty 或 parts 其中之一`);
    }
    const endpoints = a.vendorEndpoints ?? [];
    checkAssignmentFields(a.itemId, a.assignedParty, a.vendor, endpoints, partySet, byVendor);
    backend.push({
      ...origin,
      assignedParty: a.assignedParty,
      ...(a.vendor !== undefined ? { vendor: a.vendor } : {}),
      vendorEndpoints: [...endpoints],
      sourcingConfirmed: false,
    });
  }

  // 被拆掉的原 id 已不存在，把指向它的 dependsOn 改指接力最後一筆
  const remapped = backend.map((i) => ({
    ...i,
    dependsOn: i.dependsOn.map((dep) => replacedBy.get(dep) ?? dep),
  }));

  // 參照：dependsOn 每個 id 必須存在於本批（originItemId 純溯源，不校）
  const ids = new Set([...workitems.frontend, ...remapped].map((i) => i.id));
  const dangling = [
    ...new Set(remapped.flatMap((i) => i.dependsOn).filter((dep) => !ids.has(dep))),
  ];
  if (dangling.length) {
    throw new SourcingConsistencyError(`dependsOn 指向不存在的工項 id：${dangling.join("、")}`);
  }

  return parseSourcedWorkitems({
    project: workitems.project,
    frontend: workitems.frontend,
    backend: remapped,
  });
}

/**
 * 把（已定分工歸屬的）workitems 驗證後保存成 output/<project>/workitems-sourced.json。
 * 契約驗證失敗即冒泡 ContractValidationError，且不落地任何檔案。
 */
export function saveSourcedWorkitems(
  outputRoot: string,
  project: string,
  sourced: unknown,
): string {
  const validated = parseSourcedWorkitems(sourced); // 於寫檔前擋下不合契約的值
  const path = contractPath(outputRoot, project, "workitemsSourced");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return path;
}
