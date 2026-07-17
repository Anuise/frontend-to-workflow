import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type PageId, pageIdKey } from "../contracts/page";
import type { Workflow } from "../contracts/workflow";
import { type WorkItem, type Workitems, parseWorkitems } from "../contracts/workitems";
import { contractPath } from "../output";

/**
 * 組裝 buildWorkitems 的單筆輸入：一筆 Work item 的內容型欄位。
 * `inferred` 不在此——它由工項落在 frontend 或 backend 陣列決定（單一真實來源）。
 */
export type WorkItemInput = Omit<WorkItem, "inferred">;

/**
 * 工項劃分與 workflow.json 不一致時丟出：
 *  - 涵蓋：某個 Page 沒有任何前端工項；
 *  - 參照：某筆 sourcePage 指向 workflow.pages 沒有的 Page，或 dependsOn 指向本批不存在的工項 id。
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
 * 由 workflow.json 與 AI 產出的前端／後端工項接合出並驗證一份 workitems 物件。
 * - 參照：每筆 sourcePage 必須指向 workflow.pages 內存在的 Page，否則丟 WorkitemsConsistencyError。
 * - 涵蓋：每個 workflow.pages 的 Page 至少要有一筆前端工項，否則丟 WorkitemsConsistencyError。
 * - 參照：dependsOn 每個 id 必須存在於本批工項（前端＋後端），否則丟 WorkitemsConsistencyError。
 * - inferred 一律由陣列決定：前端 false、後端 true；sourcePage 取自 workflow.pages（單一真實來源）。
 * - 通過契約驗證（欄位非空、id 全域唯一、inferred 旗標）才回傳，否則冒泡 ContractValidationError。
 */
export function buildWorkitems(
  workflow: Workflow,
  frontendItems: readonly WorkItemInput[],
  backendItems: readonly WorkItemInput[],
): Workitems {
  const pageByKey = new Map<string, PageId>(
    workflow.pages.map((p) => [
      pageIdKey(p),
      p.tab === undefined ? { route: p.route } : { route: p.route, tab: p.tab },
    ]),
  );
  const all = [...frontendItems, ...backendItems];

  // 參照：sourcePage 必須指向 workflow.pages 內存在的 Page
  const badSource = all.filter((i) => !pageByKey.has(pageIdKey(i.sourcePage)));
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
  for (const i of frontendItems) {
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

  // inferred 由陣列決定；sourcePage 取自 workflow.pages
  const canonical = (i: WorkItemInput, inferred: boolean): WorkItem => ({
    ...i,
    sourcePage: pageByKey.get(pageIdKey(i.sourcePage))!,
    inferred,
  });
  const frontend = frontendItems.map((i) => canonical(i, false));
  const backend = backendItems.map((i) => canonical(i, true));

  return parseWorkitems({ project: workflow.project, frontend, backend });
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
