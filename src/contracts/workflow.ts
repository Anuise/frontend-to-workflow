import { readFileSync } from "node:fs";
import { z } from "zod";
import { UNIQUE_PAGE_IDS_MESSAGE, hasUniquePageIds, pageIdSchema } from "./page";
import { validate } from "./validate";

/**
 * 單一可執行操作：操作說明 label ＋「操作去向」destination。
 * destination 為要前往的 Page（route + 可選 tab）；null 表示不換頁（停留原頁）。
 */
export const workflowActionSchema = z.object({
  label: z.string().min(1),
  destination: pageIdSchema.nullable(),
});

/** 逐 Page 的 Workflow description：頁面用途、主要內容、可執行操作。 */
export const workflowPageSchema = pageIdSchema.extend({
  purpose: z.string().min(1),
  content: z.string().min(1),
  actions: z.array(workflowActionSchema),
});

/**
 * workflow.json（Workflow description 契約）：f2w-describe 產出，是 Workbook 每列的來源。
 * 含一段獨立於逐 Page 描述的 Overview。
 */
export const workflowSchema = z
  .object({
    project: z.string().min(1),
    overview: z.string().min(1),
    pages: z.array(workflowPageSchema).min(1),
  })
  .refine((v) => hasUniquePageIds(v.pages), {
    message: UNIQUE_PAGE_IDS_MESSAGE,
    path: ["pages"],
  });

export type WorkflowAction = z.infer<typeof workflowActionSchema>;
export type WorkflowPage = z.infer<typeof workflowPageSchema>;
export type Workflow = z.infer<typeof workflowSchema>;

/** 驗證一個（已解析的）workflow 物件。 */
export function parseWorkflow(data: unknown): Workflow {
  return validate("workflow.json", workflowSchema, data);
}

/** 讀取並驗證 workflow.json 檔（JSON）。 */
export function loadWorkflow(path: string): Workflow {
  return parseWorkflow(JSON.parse(readFileSync(path, "utf8")));
}
