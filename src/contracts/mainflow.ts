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
export const STEPS_MAX = 10;

/**
 * 主線上的一個 Step（步驟）：業務層級的一個動作。
 * 一步可收攏多個 Page（例如服務維護的五個 tab 收成「維運模型服務」一步），
 * 收攏的頁不上圖面、只進 tooltip。edgeLabel 是「往下一步」那條邊的 label。
 */
export const mainflowStepSchema = z.object({
  title: z.string().min(1).max(STEP_TITLE_MAX),
  note: z.string().min(1).max(STEP_NOTE_MAX),
  pages: z.array(pageIdSchema).min(1),
  edgeLabel: z.string().min(1).max(EDGE_LABEL_MAX).optional(),
});

export type MainflowStep = z.infer<typeof mainflowStepSchema>;

export const EDGE_LABEL_RULE_MESSAGE =
  "除最後一步外每一步都要有 edgeLabel（往下一步的業務轉場動作），最後一步不得有";

/** edgeLabel 掛在來源步：最後一步沒有下一步，所以不得有。 */
function hasWellPlacedEdgeLabels(steps: readonly MainflowStep[]): boolean {
  return steps.every((step, index) =>
    index === steps.length - 1 ? step.edgeLabel === undefined : step.edgeLabel !== undefined,
  );
}

/** 一條 Main flow（主線）：draw.io 的一個分頁。 */
export const mainflowFlowSchema = z
  .object({
    name: z.string().min(1),
    steps: z.array(mainflowStepSchema).min(STEPS_MIN).max(STEPS_MAX),
  })
  .refine((flow) => hasWellPlacedEdgeLabels(flow.steps), {
    message: EDGE_LABEL_RULE_MESSAGE,
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
