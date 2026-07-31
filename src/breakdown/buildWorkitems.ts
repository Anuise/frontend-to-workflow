import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type PageId, pageIdKey } from "../contracts/page";
import type { Revision } from "../contracts/revisions";
import type { Workflow } from "../contracts/workflow";
import {
  NEEDS_INVESTIGATION,
  type WorkItem,
  type Workitems,
  frontendWorkitemId,
  parseWorkitems,
} from "../contracts/workitems";
import { contractPath } from "../output";
import { applyWorkitemsRevisions } from "../revise/applyRevisions";
import { type VendorCapability, endpointsByVendor } from "./parseVendorSpec";

/**
 * 組裝 buildWorkitems 的單筆輸入：一筆 Work item 的內容型欄位。
 * `inferred` 不在此——它由工項落在 frontend 或 backend 陣列決定（單一真實來源）。
 * `sourcingConfirmed` 也不在此：它一律由 buildWorkitems 寫 false（AI 配對的結果要人核）。
 */
export type WorkItemInput = Omit<WorkItem, "inferred" | "sourcingConfirmed">;

/**
 * 分工鏈把關要的三樣輸入，全部可選——沒有派工輸入時整組不給即可（純自建專案）。
 * 三者總是一起旅行（buildWorkitems、checkPartyChains、乾跑都要同一組），所以收成一個型別。
 */
export interface PartyChainInputs {
  /** 權責泳道圖上人寫的 API 呼叫鏈宣告，當鏈硬底線的權威（見 ADR-0014）。 */
  declaredChains?: readonly (readonly string[])[];
  /** 分工方集合，**純由泳道名決定**，不再 ∪ spec 檔名（見 ADR-0018）。 */
  parties?: readonly string[];
  /** 已解析的 Vendor capability，供 leg 的 vendor／vendorEndpoints 參照校驗。 */
  capabilities?: readonly VendorCapability[];
}

/**
 * buildWorkitems 的具名輸入：人工修訂加派工輸入。
 * 收成一個具名物件而不是再加四個位置參數：呼叫點實測 46 次／9 檔，一長串位置參數會失控。
 */
export interface BuildWorkitemsOptions extends PartyChainInputs {
  /** 人工修訂，存檔前套上（見 ADR-0012）。 */
  revisions?: readonly Revision[];
}

/** buildWorkitems 的產出：驗過的 workitems，加上套用修訂時要交代的 warning（孤兒修訂）。 */
export interface WorkitemsBuild {
  workitems: Workitems;
  warnings: string[];
}

/**
 * 工項劃分與 workflow.json／派工輸入不一致時丟出：
 *  - 涵蓋：某個 Page 沒有任何前端工項（或前端工項數少於該頁可執行操作數）；
 *  - 參照：某筆 sourcePage 指向 workflow.pages 沒有的 Page，或 dependsOn 指向本批不存在的工項 id；
 *  - 前端 id 未依 workflow.json 的陣列索引推導；
 *  - 分工鏈：方序列不在宣告鏈內、party 不在分工方集合內、vendor／端點不存在於對應 spec。
 */
export class WorkitemsConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkitemsConsistencyError";
  }
}

/** 把 Page 識別轉成可讀標籤，供錯誤訊息使用。 */
function label(id: PageId): string {
  return id.tab ? `${id.route}（${id.tab}）` : id.route;
}

/**
 * 參照與顆粒度把關，對象是一份**已成形的** workitems。
 * 抽成獨立函式是因為修訂會增刪工項——套用之後必須再跑一次，否則 remove 掉太多前端工項
 * 就會跌破底線而沒人發現；乾跑也共用這一支。
 */
export function checkWorkitemsConsistency(workflow: Workflow, workitems: Workitems): void {
  const all = [...workitems.frontend, ...workitems.backend];
  const pageKeys = new Set(workflow.pages.map((p) => pageIdKey(p)));

  // 參照：sourcePage 必須指向 workflow.pages 內存在的 Page
  const badSource = all.filter((i) => !pageKeys.has(pageIdKey(i.sourcePage)));
  if (badSource.length) {
    throw new WorkitemsConsistencyError(
      `工項的 sourcePage 指向 workflow.pages 沒有的 Page：${badSource
        .map((i) => `${i.id}（${label(i.sourcePage)}）`)
        .join("、")}`,
    );
  }

  // 涵蓋＋顆粒度：每個 Page 的前端工項數 ≥ max(1, 該頁可執行操作數)
  // 逐可執行操作至少一筆前端工項；純顯示頁（0 actions）至少一筆。
  // max(1, …) 保證下限恆 ≥1，故此檢查涵蓋並取代舊的 per-page ≥1 涵蓋把關。
  const feCountByKey = new Map<string, number>();
  for (const i of workitems.frontend) {
    const k = pageIdKey(i.sourcePage);
    feCountByKey.set(k, (feCountByKey.get(k) ?? 0) + 1);
  }
  const underCovered = workflow.pages
    .map((p) => ({
      page: p,
      count: feCountByKey.get(pageIdKey(p)) ?? 0,
      floor: Math.max(1, p.actions.length),
    }))
    .filter((x) => x.count < x.floor);
  if (underCovered.length) {
    throw new WorkitemsConsistencyError(
      `以下 Page 前端工項數少於可執行操作數（顆粒度不足，需逐操作至少一筆）：${underCovered
        .map((x) => `${label(x.page)}（前端 ${x.count}／需 ${x.floor}）`)
        .join("、")}`,
    );
  }

  // 參照：dependsOn 每個 id 必須存在於本批工項
  const ids = new Set(all.map((i) => i.id));
  const dangling = [...new Set(all.flatMap((i) => i.dependsOn).filter((d) => !ids.has(d)))];
  if (dangling.length) {
    throw new WorkitemsConsistencyError(`dependsOn 指向不存在的工項 id：${dangling.join("、")}`);
  }
}

/**
 * 分工鏈把關：**鏈硬底線**加上方名與端點參照。
 *
 * 每筆帶 partyChain 的後端工項，它的方序列必須逐字等於宣告鏈之一——**含單 leg**。
 * 只校多 leg 的話，一筆 `[{party:"leadtek"}]`（字面上的前端直打 leadtek）會零攔截。
 * `["needs-investigation"]` 這條長度 1 的鏈永遠合法（多 leg 帶它已由契約層擋下）。
 *
 * 這一步跑在**套用修訂之後**，因為 `set partyChain` 也要被校。違反即丟錯不落地並逐一列名。
 * 乾跑呼叫的是同一支——否則乾跑報綠、上游重跑才炸，正是 ADR-0012 點名的失效模式。
 */
export function checkPartyChains(workitems: Workitems, inputs: PartyChainInputs = {}): void {
  const { parties = [], declaredChains = [], capabilities = [] } = inputs;
  const chained = workitems.backend.filter((i) => i.partyChain !== undefined);
  if (chained.length === 0) return;

  const partySet = new Set(parties);
  const byVendor = endpointsByVendor(capabilities);
  const declared = new Set(declaredChains.map((c) => c.join(" > ")));
  const badChain: string[] = [];
  const badField: string[] = [];

  for (const item of chained) {
    const chain = item.partyChain!;
    chain.forEach((leg, i) => {
      const at = `${item.id} 的 leg ${i + 1}`;
      if (leg.party !== NEEDS_INVESTIGATION && !partySet.has(leg.party)) {
        badField.push(
          `${at}：party「${leg.party}」不在分工方集合內（可用：${[...partySet].join("、") || "（無，本次沒有泳道圖）"}）`,
        );
      }
      if (leg.vendor === undefined) return;
      const known = byVendor.get(leg.vendor);
      if (!known) {
        badField.push(
          `${at}：vendor「${leg.vendor}」不在已解析的 Vendor spec 內（可用：${[...byVendor.keys()].join("、") || "（無）"}）`,
        );
        return;
      }
      const missing = leg.vendorEndpoints.filter((e) => !known.has(e));
      if (missing.length) {
        badField.push(`${at}：以下端點不存在於 ${leg.vendor} 的 spec：${missing.join("、")}`);
      }
    });

    const sequence = chain.map((l) => l.party);
    const investigationOnly = sequence.length === 1 && sequence[0] === NEEDS_INVESTIGATION;
    if (!investigationOnly && !declared.has(sequence.join(" > "))) {
      badChain.push(`${item.id}：${sequence.join(" > ")}`);
    }
  }

  const problems: string[] = [];
  if (badChain.length) {
    problems.push(
      [
        `以下後端工項的方序列不在宣告鏈內（宣告鏈：${declaredChains.map((c) => c.join(" > ")).join("；") || "（無）"}）：`,
        ...badChain.map((b) => `  ${b}`),
      ].join("\n"),
    );
  }
  if (badField.length) problems.push(badField.join("\n"));
  if (problems.length) throw new WorkitemsConsistencyError(problems.join("\n"));
}

/**
 * sourcePage 一律取自 workflow.pages（單一真實來源），修訂補進來的工項也一併正規化。
 * 抽成共用函式是因為 f2w-breakdown 與乾跑必須看到同一份後處理結果——
 * 兩邊分岔正是 ADR-0012:35 點名的失效模式。呼叫前 sourcePage 參照要先驗過（查表才安全）。
 */
export function canonicalizeSourcePages(workflow: Workflow, workitems: Workitems): Workitems {
  const pageByKey = new Map<string, PageId>(
    workflow.pages.map((p) => [
      pageIdKey(p),
      p.tab === undefined ? { route: p.route } : { route: p.route, tab: p.tab },
    ]),
  );
  const canonical = (i: WorkItem): WorkItem => ({
    ...i,
    sourcePage: pageByKey.get(pageIdKey(i.sourcePage))!,
  });
  return {
    ...workitems,
    frontend: workitems.frontend.map(canonical),
    backend: workitems.backend.map(canonical),
  };
}

/**
 * 由 workflow.json 與 AI 產出的前端／後端工項接合出並驗證一份 workitems 物件。
 * - 參照：每筆 sourcePage 必須指向 workflow.pages 內存在的 Page，否則丟 WorkitemsConsistencyError。
 * - 前端 id：逐筆等於 frontendWorkitemId(頁索引, 該頁工項索引)，不由 AI 自由編號（見 ADR-0013）。
 *   後端 id 刻意不受此約束，且**不再被拆項改寫**——多方接力只是多一個 leg（見 ADR-0016）。
 * - inferred 一律由陣列決定：前端 false、後端 true；sourcePage 取自 workflow.pages（單一真實來源）。
 * - 派工：帶 partyChain 的後端工項一律寫 `sourcingConfirmed: false`（AI 配對要人核，見 ADR-0007）。
 * - 修訂：存檔前套上人工修訂（見 ADR-0012）。**人的校正壓過 AI 的新產出**；錨到已不存在的工項
 *   的修訂算孤兒：保留該筆、發 warning、其餘照套。
 * - 套用修訂之後仍跑全部把關：涵蓋／顆粒度底線／dependsOn 參照／分工鏈硬底線。跌破即丟錯、**不落地**。
 * - 通過契約驗證（欄位非空、id 全域唯一、前端 id 格式、inferred 旗標、partyChain 全有全無）才回傳。
 */
export function buildWorkitems(
  workflow: Workflow,
  frontendItems: readonly WorkItemInput[],
  backendItems: readonly WorkItemInput[],
  options: BuildWorkitemsOptions = {},
): WorkitemsBuild {
  const { revisions = [], ...partyInputs } = options;

  // 前端 id 確定性：逐筆等於由 workflow.json 陣列索引推導的值，不由 AI 自由編號。
  // 這是 workitems 側修訂能撐過重拆的前提（見 ADR-0013）；後端 id 刻意不受此約束。
  const pageIndexByKey = new Map(workflow.pages.map((p, i) => [pageIdKey(p), i]));
  const seqByKey = new Map<string, number>();
  const misnumbered = frontendItems.flatMap((i) => {
    const k = pageIdKey(i.sourcePage);
    const seq = seqByKey.get(k) ?? 0;
    seqByKey.set(k, seq + 1);
    const pageIndex = pageIndexByKey.get(k);
    if (pageIndex === undefined) return []; // sourcePage 本身有問題，交給下面的參照把關報
    const expected = frontendWorkitemId(pageIndex, seq);
    return i.id === expected ? [] : [`${i.id}（該頁第 ${seq + 1} 筆，應為 ${expected}）`];
  });
  if (misnumbered.length) {
    throw new WorkitemsConsistencyError(
      `前端工項 id 未依 workflow.json 的陣列索引推導：${misnumbered.join("、")}`,
    );
  }

  // inferred 由陣列決定（單一真實來源，不由修訂覆蓋）
  const assembled: Workitems = {
    project: workflow.project,
    frontend: frontendItems.map((i) => ({ ...i, inferred: false })),
    backend: backendItems.map((i) => ({ ...i, inferred: true })),
  };

  const { result, warnings } = applyWorkitemsRevisions(assembled, revisions);
  checkWorkitemsConsistency(workflow, result); // 含 sourcePage 參照，故下面的查表安全
  checkPartyChains(result, partyInputs); // 跑在套用之後：set partyChain 也要被校

  // sourcingConfirmed 一律 false，且在**套用修訂之後**才寫——修訂 upsert 進來的後端工項
  // 也要被蓋上這個旗標，否則「AI 配對要人核」這條會被一筆 upsert 繞過。
  const confirmed: Workitems = {
    ...result,
    backend: result.backend.map((i) =>
      i.partyChain === undefined ? i : { ...i, sourcingConfirmed: false },
    ),
  };

  return { workitems: parseWorkitems(canonicalizeSourcePages(workflow, confirmed)), warnings };
}

/**
 * 把（已劃分的）workitems 驗證後保存成 output/<project>/workitems.json。
 * 契約驗證失敗即冒泡 ContractValidationError，且不落地任何檔案。
 */
export function saveWorkitems(outputRoot: string, project: string, workitems: unknown): string {
  const validated = parseWorkitems(workitems); // 於寫檔前擋下不合契約的值
  const path = contractPath(outputRoot, project, "workitems");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return path;
}
