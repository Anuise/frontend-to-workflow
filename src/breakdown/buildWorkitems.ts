import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type PageId, pageIdKey } from "../contracts/page";
import type { Revision } from "../contracts/revisions";
import type { Workflow } from "../contracts/workflow";
import {
  type WorkItem,
  type Workitems,
  frontendWorkitemId,
  parseWorkitems,
} from "../contracts/workitems";
import { contractPath } from "../output";
import { applyWorkitemsRevisions } from "../revise/applyRevisions";

/**
 * 組裝 buildWorkitems 的單筆輸入：一筆 Work item 的內容型欄位。
 * `inferred` 不在此——它由工項落在 frontend 或 backend 陣列決定（單一真實來源）。
 */
export type WorkItemInput = Omit<WorkItem, "inferred">;

/** buildWorkitems 的產出：驗過的 workitems，加上套用修訂時要交代的 warning（孤兒修訂）。 */
export interface WorkitemsBuild {
  workitems: Workitems;
  warnings: string[];
}

/**
 * 工項劃分與 workflow.json 不一致時丟出：
 *  - 涵蓋：某個 Page 沒有任何前端工項（或前端工項數少於該頁可執行操作數）；
 *  - 參照：某筆 sourcePage 指向 workflow.pages 沒有的 Page，或 dependsOn 指向本批不存在的工項 id；
 *  - 前端 id 未依 workflow.json 的陣列索引推導。
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
    .map((p) => ({ page: p, count: feCountByKey.get(pageIdKey(p)) ?? 0, floor: Math.max(1, p.actions.length) }))
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
 * 由 workflow.json 與 AI 產出的前端／後端工項接合出並驗證一份 workitems 物件。
 * - 參照：每筆 sourcePage 必須指向 workflow.pages 內存在的 Page，否則丟 WorkitemsConsistencyError。
 * - 前端 id：逐筆等於 frontendWorkitemId(頁索引, 該頁工項索引)，不由 AI 自由編號（見 ADR-0013）。
 *   後端 id 刻意不受此約束。
 * - inferred 一律由陣列決定：前端 false、後端 true；sourcePage 取自 workflow.pages（單一真實來源）。
 * - 修訂：存檔前套上人工修訂（見 ADR-0012）。**人的校正壓過 AI 的新產出**；錨到已不存在的工項
 *   的修訂算孤兒：保留該筆、發 warning、其餘照套。
 * - 套用修訂之後仍跑全部把關：涵蓋／顆粒度底線／dependsOn 參照。跌破底線即丟錯、**不落地**。
 * - 通過契約驗證（欄位非空、id 全域唯一、前端 id 格式、inferred 旗標）才回傳，否則冒泡 ContractValidationError。
 */
export function buildWorkitems(
  workflow: Workflow,
  frontendItems: readonly WorkItemInput[],
  backendItems: readonly WorkItemInput[],
  revisions: readonly Revision[] = [],
): WorkitemsBuild {
  const pageByKey = new Map<string, PageId>(
    workflow.pages.map((p) => [
      pageIdKey(p),
      p.tab === undefined ? { route: p.route } : { route: p.route, tab: p.tab },
    ]),
  );
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

  // sourcePage 一律取自 workflow.pages（單一真實來源），修訂補進來的工項也一併正規化
  const canonical = (i: WorkItem): WorkItem => ({
    ...i,
    sourcePage: pageByKey.get(pageIdKey(i.sourcePage))!,
  });
  const validated: Workitems = {
    ...result,
    frontend: result.frontend.map(canonical),
    backend: result.backend.map(canonical),
  };

  return { workitems: parseWorkitems(validated), warnings };
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
