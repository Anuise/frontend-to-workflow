import { readFileSync } from "node:fs";
import { z } from "zod";
import { type PageId, hasUniquePageIds, pageIdSchema } from "./page";
import { validate } from "./validate";

/**
 * 業主向的字數上限。圖是給業主看的，字一多就從「一眼看懂」退化成「讀說明書」，
 * 因此上限寫進契約由驗證擋下，而不是靠提示詞自律。
 */
export const STEP_TITLE_MAX = 12;
export const STEP_NOTE_MAX = 30;
export const EDGE_LABEL_MAX = 8;

/** 一條主線的步數區間：一個頂層 Page 分類就是一條主線，頁少時可只有一步；太多在單列橫排上看不完。 */
export const STEPS_MIN = 1;
export const STEPS_MAX = 20;

/**
 * 一條出口邊的事實憑據：畫面上真的有這顆按鈕／這個操作。
 * (route, tab, label) 必須逐字命中 workflow.json 的某個 actions[]（由 buildDiagram 驗）。
 *
 * 為什麼不拿「操作去向」當唯一憑據：純前端 demo 的寫入動作（核准、駁回、送出、刪除）
 * 一律只記錄不執行，destination 是 null——最該畫成分歧的那些操作，恰好一條去向都沒有。
 * 「這個畫面上有一顆叫『未通過』的按鈕」同樣是觀察得到、可回溯的事實。
 */
export const outcomeEvidenceSchema = pageIdSchema.extend({ label: z.string().min(1) });

/**
 * 一步的一個出口：條件措辭 ＋ 目標步號 ＋ 事實憑據。
 * 單出口就是長度 1 的 outcomes（一般推進），多出口即業務決策點（圖上長出菱形）。
 * target 是同一條主線裡的步號（1 起算），指回前面的步就是迴圈（例如退件後重新送件）。
 */
export const mainflowOutcomeSchema = z.object({
  condition: z.string().min(1).max(EDGE_LABEL_MAX),
  target: z.number().int(),
  evidence: outcomeEvidenceSchema,
});

export type MainflowOutcome = z.infer<typeof mainflowOutcomeSchema>;

/**
 * 主線上的一個 Step（步驟）：業務層級的一個動作。
 * 一步可收攏多個 Page（例如服務維護的五個 tab 收成「維運模型服務」一步），
 * 收攏的頁不上圖面、只進 tooltip。outcomes 是這一步走得出去的所有邊；**終點要明寫空陣列**，
 * 跟 excludedPages 一樣是「每一步都要表態」——漏寫和刻意走到底，讀者分得出來。
 */
export const mainflowStepSchema = z.object({
  title: z.string().min(1).max(STEP_TITLE_MAX),
  note: z.string().min(1).max(STEP_NOTE_MAX),
  pages: z.array(pageIdSchema).min(1),
  outcomes: z.array(mainflowOutcomeSchema),
});

export type MainflowStep = z.infer<typeof mainflowStepSchema>;

export const OUTCOME_TARGET_RULE_MESSAGE =
  "outcomes[].target 必須是同一條主線裡的合法步號（1 起算），且不得指向自己";

export const ORPHAN_STEP_MESSAGE =
  "除第 1 步外，每一步都必須被同主線的某條 outcomes[].target 指到，否則圖上是接不到的孤兒框";

/** 出口只能指向同一條主線裡真的存在的另一步。 */
function hasValidOutcomeTargets(steps: readonly MainflowStep[]): boolean {
  return steps.every((step, index) =>
    step.outcomes.every(
      (outcome) =>
        outcome.target >= 1 && outcome.target <= steps.length && outcome.target !== index + 1,
    ),
  );
}

/** 第 1 步是入口，其餘每一步都得有人指到它，否則畫出來是浮在圖上的孤兒。 */
function hasNoOrphanSteps(steps: readonly MainflowStep[]): boolean {
  const targeted = new Set(steps.flatMap((step) => step.outcomes.map((outcome) => outcome.target)));
  return steps.every((_, index) => index === 0 || targeted.has(index + 1));
}

/** 一條 Main flow（主線）：draw.io 的一個分頁。 */
export const mainflowFlowSchema = z
  .object({
    name: z.string().min(1),
    steps: z.array(mainflowStepSchema).min(STEPS_MIN).max(STEPS_MAX),
  })
  .refine((flow) => hasValidOutcomeTargets(flow.steps), {
    message: OUTCOME_TARGET_RULE_MESSAGE,
    path: ["steps"],
  })
  .refine((flow) => hasNoOrphanSteps(flow.steps), {
    message: ORPHAN_STEP_MESSAGE,
    path: ["steps"],
  });

/** 落選頁：不在任何主線上，圖上不畫，只在此處與對話回報交代。 */
export const excludedPageSchema = pageIdSchema.extend({ reason: z.string().min(1) });

export const UNIQUE_COVERAGE_MESSAGE =
  "每個 Page 只能出現一次：steps[].pages 與 excludedPages 合起來不得重複";

/** 所有主線步驟收攏的 Page，依主線與步驟順序。 */
export function assignedPages(mainflow: { flows: readonly MainflowFlow[] }): PageId[] {
  return mainflow.flows.flatMap((flow) => flow.steps.flatMap((step) => step.pages));
}

/** 主線收攏的 Page ∪ 落選頁：必須剛好等於 workflow.json 的頁集合（由 buildDiagram 驗）。 */
export function coveredPages(mainflow: {
  flows: readonly MainflowFlow[];
  excludedPages: readonly ExcludedPage[];
}): PageId[] {
  return [...assignedPages(mainflow), ...mainflow.excludedPages];
}

/**
 * mainflow.json（Main flow 契約）：f2w-diagram 的推論交接檔，是 Main flow diagram 的唯一版面依據。
 * 可手改；已存在就沿用、不重推論。
 */
export const mainflowSchema = z
  .object({
    project: z.string().min(1),
    flows: z.array(mainflowFlowSchema).min(1),
    excludedPages: z.array(excludedPageSchema),
  })
  .refine((v) => hasUniquePageIds(coveredPages(v)), { message: UNIQUE_COVERAGE_MESSAGE });

export type MainflowFlow = z.infer<typeof mainflowFlowSchema>;
export type ExcludedPage = z.infer<typeof excludedPageSchema>;
export type Mainflow = z.infer<typeof mainflowSchema>;

/** 驗證一個（已解析的）mainflow 物件。 */
export function parseMainflow(data: unknown): Mainflow {
  return validate("mainflow.json", mainflowSchema, data);
}

/** 讀取並驗證 mainflow.json 檔（JSON）。 */
export function loadMainflow(path: string): Mainflow {
  return parseMainflow(JSON.parse(readFileSync(path, "utf8")));
}
