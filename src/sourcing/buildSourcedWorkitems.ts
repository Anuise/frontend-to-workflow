import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  type SourcedBackendItem,
  type SourcedWorkitems,
  type SourcingBucket,
  parseSourcedWorkitems,
} from "../contracts/sourcedWorkitems";
import type { WorkItem, Workitems } from "../contracts/workitems";
import { contractPath } from "../output";
import { type VendorCapability, endpointsByVendor } from "./parseVendorSpec";

/** vendor-adapted 拆出的一筆子工項的內容（其餘欄位沿用被拆的原始後端工項）。 */
export interface SplitPart {
  id: string;
  title: string;
  scope: string;
  acceptance: string;
  risk?: string;
}

/** 一筆後端工項的來源決策；vendor-adapted 必須同時給 fetch 與 process 兩筆內容。 */
export interface SourcingDecision {
  itemId: string;
  sourcing: SourcingBucket;
  vendor?: string;
  vendorEndpoints?: string[];
  fetch?: SplitPart;
  process?: SplitPart;
}

/**
 * 來源決策與 workitems.json／Vendor spec 不一致時丟出：
 *  - 涵蓋：後端工項沒有決策、決策指向不存在的工項、或同一工項給了多筆決策；
 *  - 參照：vendor 不在 spec 內、vendorEndpoints 有 spec 沒有的端點、dependsOn 指向不存在的工項；
 *  - 桶別欄位：自建／待查攀附供應商、靠供應商卻沒指名、vendor-adapted 沒給兩筆拆項內容。
 */
export class SourcingConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourcingConsistencyError";
  }
}

/** 由 SplitPart 與被拆的原始工項組出一筆 vendor-adapted 子工項。 */
function splitItem(
  origin: WorkItem,
  part: SplitPart,
  role: "fetch" | "process",
  vendor: string,
  endpoints: readonly string[],
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
    sourcing: "vendor-adapted",
    vendor,
    // 端點掛在 fetch 筆；process 是自建處理層，不呼叫供應商。
    vendorEndpoints: role === "fetch" ? [...endpoints] : [],
    sourcingConfirmed: false,
    adaptationRole: role,
    originItemId: origin.id,
  };
}

/**
 * 由 workitems.json、Vendor capability 與 AI 的來源決策接合出並驗證 workitems-sourced 物件。
 * - 涵蓋：後端工項與決策一一對應，漏／多／重複皆丟 SourcingConsistencyError。
 * - 參照：vendor 與 vendorEndpoints 必須真的存在於對應 Vendor spec。
 * - 桶別欄位：self-built／needs-investigation 不得帶供應商；vendor-adapted 必須給 fetch／process。
 * - vendor-adapted 拆兩筆，原 id 消失，故其他工項指向它的 dependsOn 一律改指 process 筆。
 * - frontend 原封複製自 workitems（單一真實來源，複製不會漂移）。
 * - sourcingConfirmed 一律 false；通過契約驗證才回傳，否則冒泡 ContractValidationError。
 */
export function buildSourcedWorkitems(
  workitems: Workitems,
  capabilities: readonly VendorCapability[],
  decisions: readonly SourcingDecision[],
): SourcedWorkitems {
  const byVendor = endpointsByVendor(capabilities);

  // 涵蓋：決策與後端工項一一對應
  const backendById = new Map(workitems.backend.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const unknown: string[] = [];
  const duplicated: string[] = [];
  for (const d of decisions) {
    if (!backendById.has(d.itemId)) unknown.push(d.itemId);
    else if (seen.has(d.itemId)) duplicated.push(d.itemId);
    else seen.add(d.itemId);
  }
  const missing = workitems.backend.filter((i) => !seen.has(i.id)).map((i) => i.id);
  if (unknown.length || duplicated.length || missing.length) {
    throw new SourcingConsistencyError(
      [
        unknown.length ? `決策指向不存在的後端工項：${unknown.join("、")}` : "",
        duplicated.length ? `同一後端工項有多筆決策：${duplicated.join("、")}` : "",
        missing.length ? `以下後端工項缺來源決策：${missing.join("、")}` : "",
      ]
        .filter(Boolean)
        .join("；"),
    );
  }

  // 桶別欄位＋端點參照
  const backend: SourcedBackendItem[] = [];
  const replacedBy = new Map<string, string>(); // 被拆的原 id → process 筆 id
  for (const d of decisions) {
    const origin = backendById.get(d.itemId)!;
    const usesVendor = d.sourcing === "vendor-direct" || d.sourcing === "vendor-adapted";
    const endpoints = d.vendorEndpoints ?? [];

    if (!usesVendor) {
      if (d.vendor !== undefined || endpoints.length) {
        throw new SourcingConsistencyError(
          `${d.itemId}：${d.sourcing} 不得帶 vendor 或 vendorEndpoints`,
        );
      }
      backend.push({
        ...origin,
        sourcing: d.sourcing,
        vendorEndpoints: [],
        sourcingConfirmed: false,
      });
      continue;
    }

    if (d.vendor === undefined) {
      throw new SourcingConsistencyError(`${d.itemId}：${d.sourcing} 必須指名 vendor`);
    }
    const known = byVendor.get(d.vendor);
    if (!known) {
      throw new SourcingConsistencyError(
        `${d.itemId}：vendor「${d.vendor}」不在已解析的 Vendor spec 內（可用：${[...byVendor.keys()].join("、")}）`,
      );
    }
    const badEndpoints = endpoints.filter((e) => !known.has(e));
    if (badEndpoints.length) {
      throw new SourcingConsistencyError(
        `${d.itemId}：以下端點不存在於 ${d.vendor} 的 spec：${badEndpoints.join("、")}`,
      );
    }

    if (d.sourcing === "vendor-direct") {
      backend.push({
        ...origin,
        sourcing: "vendor-direct",
        vendor: d.vendor,
        vendorEndpoints: [...endpoints],
        sourcingConfirmed: false,
      });
      continue;
    }

    if (!d.fetch || !d.process) {
      throw new SourcingConsistencyError(
        `${d.itemId}：vendor-adapted 必須同時給 fetch 與 process 兩筆拆項內容`,
      );
    }
    backend.push(splitItem(origin, d.fetch, "fetch", d.vendor, endpoints, origin.dependsOn));
    backend.push(splitItem(origin, d.process, "process", d.vendor, endpoints, [d.fetch.id]));
    replacedBy.set(origin.id, d.process.id);
  }

  // 被拆掉的原 id 已不存在，把指向它的 dependsOn 改指 process 筆
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
 * 把（已定來源的）workitems 驗證後保存成 output/<project>/workitems-sourced.json。
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
