import { type PageId, pageIdKey } from "../contracts/page";
import type { Workflow, WorkflowAction, WorkflowPage } from "../contracts/workflow";

/** Navigation diagram 上會出現的 BPMN 節點種類。 */
export type BpmnNodeKind = "startEvent" | "endEvent" | "userTask" | "exclusiveGateway";

/** 單一 BPMN 節點：語意（id／種類／名稱／說明）＋ DI 座標與尺寸。 */
export interface BpmnNode {
  id: string;
  kind: BpmnNodeKind;
  name?: string;
  documentation?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 單一 sequenceFlow；name 為該操作的說明（由 gateway 出口帶出）。 */
export interface BpmnFlow {
  id: string;
  name?: string;
  sourceRef: string;
  targetRef: string;
}

/** 組好的 Navigation diagram：節點、邊，以及需要人回頭處理的提醒。 */
export interface BpmnDiagram {
  processId: string;
  nodes: BpmnNode[];
  flows: BpmnFlow[];
  /** 純循環無終點、孤立頁等情形；由 f2w-bpmn 原文回報給使用者。 */
  warnings: string[];
}

/** 操作去向指向 pages 裡不存在的 Page 時丟出——手改過的 workflow.json 有斷掉的去向。 */
export class BpmnConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BpmnConsistencyError";
  }
}

/** 唯一的 startEvent id。 */
export const START_EVENT_ID = "StartEvent_1";

/** 每頁一個 userTask，id 前綴固定。 */
const TASK_ID_PREFIX = "Page_";

/** 全圖每個 Page 都有換頁出口時的提醒（導覽為循環，畫不出 endEvent）。 */
export const NO_END_EVENT_WARNING =
  "此圖無終點：每個 Page 都有換頁出口，導覽為循環，因此未畫 endEvent。";

/** 孤立頁（從入口走不到）的提醒；列出 route 讓人回頭補 workflow.json 的操作去向。 */
export function isolatedPagesWarning(pages: readonly PageId[]): string {
  const labels = pages.map(pageLabel).join("、");
  return `以下 Page 從入口走不到，已另列一區且不接 startEvent：${labels}。若非本意，回頭補 workflow.json 中指向它們的操作去向（f2w-capture 的已知盲點：hash routing、非 <a> 導覽）。`;
}

// 節點尺寸與間距（像素），沿用 bpmn.io 預設比例，讓 Modeler 開起來大小正常。
const TASK_WIDTH = 100;
const TASK_HEIGHT = 80;
const EVENT_SIZE = 36;
const GATEWAY_SIZE = 50;
const COLUMN_SPACING = 180;
const ROW_SPACING = 140;
const BAND_GAP = 200; // 主圖與孤立頁區之間的留白
const ORIGIN_X = 60;
const ORIGIN_Y = 80;

/** 把 Page 識別轉成可讀標籤（含 tab）。 */
function pageLabel(id: PageId): string {
  return id.tab ? `${id.route}（${id.tab}）` : id.route;
}

/**
 * 轉成 BPMN id 可用的片段：保留字母（含中日文）／數字／底線，其餘一律換成底線並修掉頭尾。
 * BPMN id 是 xsd:ID（NCName），允許 Unicode 字母，故中文 tab 名可直接保留。
 */
function toIdSlug(raw: string): string {
  const slug = raw.replace(/[^\p{L}\p{N}_]+/gu, "_").replace(/^_+|_+$/g, "");
  return slug || "root";
}

/**
 * 為每個 Page 定 userTask 的 id：由正規化 route(+tab) 衍生，好從圖回溯到 Page。
 * 兩頁 slug 相同時（例如 tab 名去掉符號後撞在一起）依 workflow.json 順序補 _2、_3。
 */
function assignTaskIds(pages: readonly WorkflowPage[]): Map<string, string> {
  const used = new Set<string>();
  const ids = new Map<string, string>();
  for (const page of pages) {
    const base = `${TASK_ID_PREFIX}${toIdSlug(page.tab ? `${page.route}_${page.tab}` : page.route)}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
    used.add(id);
    ids.set(pageIdKey(page), id);
  }
  return ids;
}

/** 該頁的換頁操作（destination 非 null）；不換頁的操作不成邊。 */
function navigatingActions(page: WorkflowPage): Array<WorkflowAction & { destination: PageId }> {
  return page.actions.filter(
    (action): action is WorkflowAction & { destination: PageId } => action.destination !== null,
  );
}

/** 不換頁的操作寫進該 task 的 documentation：資訊不掉，但不增節點。 */
function stayingDocumentation(page: WorkflowPage): string | undefined {
  const staying = page.actions.filter((action) => action.destination === null);
  if (staying.length === 0) return undefined;
  return ["不換頁的操作：", ...staying.map((action) => `• ${action.label}`)].join("\n");
}

/** 操作去向必須指向 pages 內存在的 Page，否則畫不出邊。 */
function requireKnownDestinations(workflow: Workflow): void {
  const known = new Set(workflow.pages.map(pageIdKey));
  for (const page of workflow.pages) {
    for (const action of navigatingActions(page)) {
      if (!known.has(pageIdKey(action.destination))) {
        throw new BpmnConsistencyError(
          `Page ${pageLabel(page)} 的操作「${action.label}」指向不存在的 Page ${pageLabel(action.destination)}`,
        );
      }
    }
  }
}

/** 從入口（pages[0]）沿換頁操作做 BFS，回傳每個可達 Page 的層級；走不到的 Page 不在表內。 */
function bfsDepths(workflow: Workflow): Map<string, number> {
  const byKey = new Map(workflow.pages.map((page) => [pageIdKey(page), page] as const));
  const entry = pageIdKey(workflow.pages[0]!);
  const depths = new Map<string, number>([[entry, 0]]);
  const queue = [entry];
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i]!;
    for (const action of navigatingActions(byKey.get(key)!)) {
      const next = pageIdKey(action.destination);
      if (depths.has(next)) continue;
      depths.set(next, depths.get(key)! + 1);
      queue.push(next);
    }
  }
  return depths;
}

function sizeOf(kind: BpmnNodeKind): { width: number; height: number } {
  if (kind === "userTask") return { width: TASK_WIDTH, height: TASK_HEIGHT };
  if (kind === "exclusiveGateway") return { width: GATEWAY_SIZE, height: GATEWAY_SIZE };
  return { width: EVENT_SIZE, height: EVENT_SIZE };
}

/**
 * 由 Workflow description 組出 Navigation diagram（確定性核心，不碰 fs）。
 *
 * 語意映射：
 *  - 每個 Page 一個 `userTask`（id 由正規化 route(+tab) 衍生、name 為頁面用途）。
 *  - 每個換頁操作一條 `sequenceFlow`，name 為操作說明；不換頁的操作寫進 documentation。
 *  - 某頁有 ≥2 條換頁操作時插一個 `exclusiveGateway`（使用者選一條路），出口 flow 各帶操作說明。
 *  - `pages[0]` 接 startEvent；無換頁出口的 Page 各接一個 endEvent。
 *
 * layout：startEvent 為第 0 欄；可達 Page 依 BFS 層級決定欄、依 (層級, 原順序) 各占一列；
 * 孤立頁（從入口走不到）不接 startEvent、不分層，於主圖下方另一區堆疊。
 */
export function buildBpmn(workflow: Workflow): BpmnDiagram {
  requireKnownDestinations(workflow);

  const taskIds = assignTaskIds(workflow.pages);
  const depths = bfsDepths(workflow);
  const reachable = workflow.pages
    .map((page, index) => ({ page, index, depth: depths.get(pageIdKey(page)) }))
    .filter((e): e is { page: WorkflowPage; index: number; depth: number } => e.depth !== undefined)
    .sort((a, b) => a.depth - b.depth || a.index - b.index);
  const isolated = workflow.pages.filter((page) => !depths.has(pageIdKey(page)));

  const nodes: BpmnNode[] = [];
  const flows: BpmnFlow[] = [];

  const addNode = (
    node: Pick<BpmnNode, "id" | "kind" | "name" | "documentation">,
    column: number,
    centerY: number,
  ): void => {
    const { width, height } = sizeOf(node.kind);
    nodes.push({
      ...node,
      width,
      height,
      // 窄節點（事件、gateway）在欄內對齊 task 的中線，圖才不會歪
      x: ORIGIN_X + column * COLUMN_SPACING + (TASK_WIDTH - width) / 2,
      y: centerY - height / 2,
    });
  };

  const addFlow = (sourceRef: string, targetRef: string, name?: string): void => {
    flows.push({ id: `Flow_${flows.length + 1}`, sourceRef, targetRef, name });
  };

  const emitPage = (page: WorkflowPage, column: number, centerY: number): void => {
    const taskId = taskIds.get(pageIdKey(page))!;
    const suffix = taskId.slice(TASK_ID_PREFIX.length);
    addNode(
      {
        id: taskId,
        kind: "userTask",
        name: page.purpose,
        documentation: stayingDocumentation(page),
      },
      column,
      centerY,
    );

    const navigating = navigatingActions(page);
    if (navigating.length === 0) {
      const endId = `End_${suffix}`;
      addNode({ id: endId, kind: "endEvent" }, column + 1, centerY);
      addFlow(taskId, endId);
      return;
    }
    if (navigating.length === 1) {
      const only = navigating[0]!;
      addFlow(taskId, taskIds.get(pageIdKey(only.destination))!, only.label);
      return;
    }
    const gatewayId = `Gateway_${suffix}`;
    addNode({ id: gatewayId, kind: "exclusiveGateway" }, column + 1, centerY);
    addFlow(taskId, gatewayId);
    for (const action of navigating) {
      addFlow(gatewayId, taskIds.get(pageIdKey(action.destination))!, action.label);
    }
  };

  addNode({ id: START_EVENT_ID, kind: "startEvent" }, 0, ORIGIN_Y);
  addFlow(START_EVENT_ID, taskIds.get(pageIdKey(workflow.pages[0]!))!);
  for (const [row, entry] of reachable.entries()) {
    emitPage(entry.page, 1 + 2 * entry.depth, ORIGIN_Y + row * ROW_SPACING);
  }
  const isolatedBandY = ORIGIN_Y + reachable.length * ROW_SPACING + BAND_GAP;
  for (const [row, page] of isolated.entries()) {
    emitPage(page, 1, isolatedBandY + row * ROW_SPACING);
  }

  const warnings: string[] = [];
  if (!nodes.some((node) => node.kind === "endEvent")) warnings.push(NO_END_EVENT_WARNING);
  if (isolated.length > 0) warnings.push(isolatedPagesWarning(isolated));

  return { processId: `Process_${toIdSlug(workflow.project)}`, nodes, flows, warnings };
}
