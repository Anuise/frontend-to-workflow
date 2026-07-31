import { pageIdKey } from "../contracts/page";
import { OVERVIEW_ANCHOR, type Revision } from "../contracts/revisions";
import type { Workflow } from "../contracts/workflow";
import { type WorkItem, type Workitems, parsePartyLegLabel } from "../contracts/workitems";

/** 只錨在 workflow.json 上的修訂。 */
export type WorkflowRevision = Extract<Revision, { target: "workflow" }>;
/** 只錨在 workitems.json 上的修訂。 */
export type WorkitemsRevision = Extract<Revision, { target: "workitems" }>;

/** 套用的結果：套過的物件，與需要向使用者交代的 warning（孤兒修訂）。 */
export interface RevisionApplication<T> {
  result: T;
  warnings: string[];
}

/**
 * 作用點：`set` 是 `(target, anchor, field)`；`upsert` 與 `remove` 是 `(target, itemId)`，
 * 兩者**共用同一個作用點空間**——`remove` 後又 `upsert` 同 id 則工項活著，反過來則被刪掉。
 */
export function actionPoint(r: Revision): string {
  const anchor = typeof r.anchor === "string" ? r.anchor : pageIdKey(r.anchor);
  return r.op === "set" ? `${r.target}|${anchor}|${r.field}` : `${r.target}|${anchor}`;
}

/**
 * 摺疊成有效修訂集：每個作用點只留陣列中最後出現的那一筆。
 * 這是唯一在乎順序的一步；摺疊之後套用對排列不敏感。
 */
export function foldRevisions<T extends Revision>(revisions: readonly T[]): T[] {
  const byPoint = new Map<string, T>();
  for (const r of revisions) byPoint.set(actionPoint(r), r);
  return [...byPoint.values()];
}

/** 錨指向的東西在當前 json 裡不存在時的 warning——保留該筆、其餘照套，不中止。 */
export function orphanRevisionWarning(r: Revision): string {
  const what = r.target === "workflow" ? "Page" : "工項";
  const anchor =
    typeof r.anchor === "string"
      ? r.anchor
      : r.anchor.tab
        ? `${r.anchor.route}（${r.anchor.tab}）`
        : r.anchor.route;
  const suffix = r.op === "set" ? `${r.op} ${r.field}` : r.op;
  return `孤兒修訂（錨定的${what}不存在於當前產出，已略過）：${anchor} → ${suffix}`;
}

/**
 * 把修訂套到一份 workflow 上。**純函式**：不讀檔、不改動傳入的物件。
 * workflow 只支援欄位覆蓋（`set`）——`upsert`／`remove` 在契約層就被擋下。
 * 空修訂集時回傳的物件與輸入相同。
 */
export function applyWorkflowRevisions(
  workflow: Workflow,
  revisions: readonly Revision[],
): RevisionApplication<Workflow> {
  const effective = foldRevisions(
    revisions.filter((r): r is WorkflowRevision => r.target === "workflow"),
  );
  const warnings: string[] = [];
  const pages = workflow.pages.map((p) => ({ ...p }));
  const pageByKey = new Map(pages.map((p) => [pageIdKey(p), p]));
  let overview = workflow.overview;

  for (const r of effective) {
    if (r.anchor === OVERVIEW_ANCHOR) {
      overview = r.value;
      continue;
    }
    const page = pageByKey.get(pageIdKey(r.anchor));
    if (!page) {
      warnings.push(orphanRevisionWarning(r));
      continue;
    }
    if (r.field === "purpose") page.purpose = r.value;
    else if (r.field === "content") page.content = r.value;
    else if (r.field === "actions") page.actions = r.value.map((a) => ({ ...a }));
  }

  return { result: { ...workflow, overview, pages }, warnings };
}

/**
 * 把一筆 `set` 寫進工項層欄位。
 * 抽成獨立函式是因為 leg 錨的分支也要落回這裡（`risk`／`dependsOn` 沒有 leg 層版本），
 * 而**漏掉一個 field 分支就是靜默 no-op**——`partyChain` 那條正是這樣差點漏掉的。
 */
function setItemField(item: WorkItem, r: Extract<WorkitemsRevision, { op: "set" }>): void {
  if (r.field === "title") item.title = r.value;
  else if (r.field === "scope") item.scope = r.value;
  else if (r.field === "acceptance") item.acceptance = r.value;
  else if (r.field === "risk") item.risk = r.value;
  else if (r.field === "dependsOn") item.dependsOn = [...r.value];
  else if (r.field === "partyChain") item.partyChain = r.value.map((l) => ({ ...l }));
}

/**
 * 把修訂套到一份 workitems 上。**純函式**：不讀檔、不改動傳入的物件。
 * 有效修訂集內按**固定序 `remove` → `upsert` → `set`** 套用（寫死的規則、不是檔案順序），
 * 所以 `set` 永遠作用在最終存在的物件上，而有效修訂集本身對排列不敏感。
 * 不做契約驗證與顆粒度把關——那是呼叫方（buildWorkitems 或乾跑）的事。
 */
export function applyWorkitemsRevisions(
  workitems: Workitems,
  revisions: readonly Revision[],
): RevisionApplication<Workitems> {
  const effective = foldRevisions(
    revisions.filter((r): r is WorkitemsRevision => r.target === "workitems"),
  );
  const warnings: string[] = [];
  const frontend = workitems.frontend.map((i) => ({ ...i }));
  const backend = workitems.backend.map((i) => ({ ...i }));

  /** 找出某個 id 現在落在哪個陣列的哪一格；inferred 一律由陣列決定，不由修訂覆蓋。 */
  const locate = (id: string): { list: WorkItem[]; index: number } | undefined => {
    const fi = frontend.findIndex((i) => i.id === id);
    if (fi >= 0) return { list: frontend, index: fi };
    const bi = backend.findIndex((i) => i.id === id);
    if (bi >= 0) return { list: backend, index: bi };
    return undefined;
  };

  for (const r of effective) {
    if (r.op !== "remove") continue;
    const found = locate(r.anchor);
    if (!found) {
      warnings.push(orphanRevisionWarning(r));
      continue;
    }
    found.list.splice(found.index, 1);
  }

  for (const r of effective) {
    if (r.op !== "upsert") continue;
    const found = locate(r.anchor);
    const list = r.value.inferred ? backend : frontend;
    if (found && found.list === list) {
      list[found.index] = { ...r.value };
      continue;
    }
    if (found) found.list.splice(found.index, 1);
    list.push({ ...r.value });
  }

  for (const r of effective) {
    if (r.op !== "set") continue;
    // 錨可能是交付物上的 leg 標籤 `<工項id>#<leg序>`——使用者照交付物抄下來的錨必須錨得到
    // 東西（見 ADR-0016）。工項 id 由契約層保證不含 `#`，所以切法無歧義。
    const { itemId, legIndex } = parsePartyLegLabel(r.anchor);
    const found = locate(itemId);
    if (!found) {
      warnings.push(orphanRevisionWarning(r));
      continue;
    }
    const item = found.list[found.index]!;
    if (legIndex !== undefined) {
      const chain = item.partyChain;
      if (chain === undefined || legIndex > chain.length) {
        warnings.push(orphanRevisionWarning(r)); // leg 序超出鏈長＝孤兒，不中止、不自動清除
        continue;
      }
      const legs = chain.map((l) => ({ ...l }));
      const leg = legs[legIndex - 1]!;
      // 錨在 leg 上時 partyChain 的 value 取第一段當整段取代——那是覆蓋該 leg 的
      // party／vendor／vendorEndpoints 的途徑；title／scope／acceptance 則逐欄覆蓋。
      if (r.field === "partyChain") {
        if (r.value.length > 1) {
          warnings.push(
            `錨在 leg 標籤 ${r.anchor} 的 set partyChain 只取代那一段，多給的 ${r.value.length - 1} 段被忽略——要換整條鏈請錨在工項 id ${itemId} 上。`,
          );
        }
        legs[legIndex - 1] = { ...r.value[0]! };
      }
      else if (r.field === "title") leg.title = r.value;
      else if (r.field === "scope") leg.scope = r.value;
      else if (r.field === "acceptance") leg.acceptance = r.value;
      else {
        setItemField(item, r); // risk／dependsOn 是工項層欄位，leg 上沒有
        continue;
      }
      item.partyChain = legs;
      continue;
    }
    setItemField(item, r);
  }

  return { result: { ...workitems, frontend, backend }, warnings };
}
