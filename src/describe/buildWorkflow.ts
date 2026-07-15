import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type PageId, pageIdKey } from "../contracts/page";
import type { Pages } from "../contracts/pages";
import { type Workflow, type WorkflowAction, parseWorkflow } from "../contracts/workflow";
import { contractPath } from "../output";

/**
 * 逐 Page 的使用者視角描述：頁面用途、主要內容、可執行操作（含操作去向）。
 * route/tab 用來對應到 pages.json 裡的某個截到的 Page；最終 route/tab 一律取自 pages.json。
 */
export interface PageDescription {
  route: string;
  tab?: string;
  purpose: string;
  content: string;
  actions: WorkflowAction[];
}

/**
 * 描述與截到的 Page 不一致時丟出：
 *  - 有截到的 Page 未被描述（漏頁），或描述了未截到的 Page（多頁／重複）；
 *  - 操作去向（destination）指向一個未被截到的 Page。
 */
export class WorkflowConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowConsistencyError";
  }
}

/** 把 Page 識別轉成可讀標籤，供錯誤訊息使用。 */
function label(id: PageId): string {
  return id.tab ? `${id.route}（${id.tab}）` : id.route;
}

/**
 * 由 pages.json 與 agent 的逐頁描述接合出並驗證一份 workflow 物件。
 * - 涵蓋：描述須與截到的 Page 一一對應——漏頁、多頁或重複描述皆丟 WorkflowConsistencyError。
 * - 操作去向：每個非 null 的 destination 必須指向 pages.json 內存在的 Page，否則丟 WorkflowConsistencyError。
 * - route/tab 一律取自 pages.json（單一真實來源），描述只提供 purpose/content/actions。
 * - 通過契約驗證（overview/purpose/label 非空、Page 識別唯一）才回傳，否則丟 ContractValidationError。
 */
export function buildWorkflow(
  pages: Pages,
  overview: string,
  descriptions: readonly PageDescription[],
): Workflow {
  const capturedKeys = pages.pages.map((p) => pageIdKey(p));
  const capturedKeySet = new Set(capturedKeys);
  const describedKeys = descriptions.map((d) => pageIdKey(d));
  const describedKeySet = new Set(describedKeys);

  // 涵蓋：截到卻沒描述、描述了卻沒截到、以及重複描述同一頁
  const missing = pages.pages.filter((p) => !describedKeySet.has(pageIdKey(p)));
  const extra = descriptions.filter((d) => !capturedKeySet.has(pageIdKey(d)));
  const duplicated = describedKeys.length !== describedKeySet.size;
  if (missing.length || extra.length || duplicated) {
    const parts: string[] = [];
    if (missing.length) parts.push(`未描述的 Page：${missing.map(label).join("、")}`);
    if (extra.length) parts.push(`描述了未截到的 Page：${extra.map(label).join("、")}`);
    if (duplicated) parts.push("有重複描述同一個 Page");
    throw new WorkflowConsistencyError(`workflow 描述未與 pages.json 一一對應——${parts.join("；")}`);
  }

  // 操作去向：非 null 的 destination 必須指向截到的 Page
  const badDestinations = descriptions
    .flatMap((d) => d.actions)
    .map((a) => a.destination)
    .filter((dest): dest is PageId => dest !== null && !capturedKeySet.has(pageIdKey(dest)));
  if (badDestinations.length) {
    throw new WorkflowConsistencyError(
      `操作去向指向未截到的 Page：${badDestinations.map(label).join("、")}`,
    );
  }

  // 以 pages.json 的 route/tab 為準組裝逐頁描述
  const byKey = new Map(descriptions.map((d) => [pageIdKey(d), d]));
  const workflowPages = pages.pages.map((p) => {
    const d = byKey.get(pageIdKey(p))!;
    const id: PageId = p.tab === undefined ? { route: p.route } : { route: p.route, tab: p.tab };
    return { ...id, purpose: d.purpose, content: d.content, actions: d.actions };
  });

  return parseWorkflow({ project: pages.project, overview, pages: workflowPages });
}

/**
 * 把（已描述的）workflow 驗證後保存成 output/<project>/workflow.json。
 * 契約驗證失敗即丟 ContractValidationError，且不落地任何檔案。
 */
export function saveWorkflow(outputRoot: string, project: string, workflow: unknown): string {
  const validated = parseWorkflow(workflow); // 於寫檔前擋下不合契約的值
  const path = contractPath(outputRoot, project, "workflow");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return path;
}
