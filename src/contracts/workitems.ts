import { readFileSync } from "node:fs";
import { z } from "zod";
import { pageIdSchema } from "./page";
import { validate } from "./validate";

/**
 * 單一 Work item（工項）。
 * 只含內容型欄位（由 AI 依畫面觀察或推論填寫）；承諾型欄位（估時／優先級／RACI／簽核／狀態）
 * 刻意不進 json——那些是多人協作的權責畫押值，只存在人工另存的工作副本裡。
 * `inferred` 標記此工項是觀察自畫面（前端，false）或 AI 推論而來（後端，true，即「推論·待確認」）。
 */
export const workItemSchema = z.object({
  id: z.string().min(1),
  sourcePage: pageIdSchema,
  title: z.string().min(1),
  scope: z.string().min(1),
  acceptance: z.string().min(1),
  dependsOn: z.array(z.string().min(1)),
  risk: z.string(),
  inferred: z.boolean(),
});

/** 契約層共用訊息：工項 id 必須全域唯一。 */
export const UNIQUE_WORKITEM_IDS_MESSAGE = "工項 id 必須全域唯一（跨 frontend 與 backend）";
/** 契約層共用訊息：前端工項一律非推論。 */
export const FRONTEND_NOT_INFERRED_MESSAGE = "前端工項的 inferred 必須為 false（觀察自畫面）";
/** 契約層共用訊息：後端工項一律推論。 */
export const BACKEND_INFERRED_MESSAGE = "後端工項的 inferred 必須為 true（推論·待確認）";

/**
 * workitems.json（Work breakdown 契約）：f2w-breakdown 產出，是 workitems.xlsx 每列的來源。
 * frontend 為觀察自畫面的前端工項，backend 為 AI 推論的後端工項。
 * refine 把守跨陣列 id 唯一、以及前端／後端的 inferred 旗標——手改此檔時也擋得住。
 */
export const workitemsSchema = z
  .object({
    project: z.string().min(1),
    frontend: z.array(workItemSchema),
    backend: z.array(workItemSchema),
  })
  .refine(
    (v) => {
      const ids = [...v.frontend, ...v.backend].map((i) => i.id);
      return new Set(ids).size === ids.length;
    },
    { message: UNIQUE_WORKITEM_IDS_MESSAGE, path: ["frontend"] },
  )
  .refine((v) => v.frontend.every((i) => i.inferred === false), {
    message: FRONTEND_NOT_INFERRED_MESSAGE,
    path: ["frontend"],
  })
  .refine((v) => v.backend.every((i) => i.inferred === true), {
    message: BACKEND_INFERRED_MESSAGE,
    path: ["backend"],
  });

export type WorkItem = z.infer<typeof workItemSchema>;
export type Workitems = z.infer<typeof workitemsSchema>;

/** 驗證一個（已解析的）workitems 物件。 */
export function parseWorkitems(data: unknown): Workitems {
  return validate("workitems.json", workitemsSchema, data);
}

/** 讀取並驗證 workitems.json 檔（JSON）。 */
export function loadWorkitems(path: string): Workitems {
  return parseWorkitems(JSON.parse(readFileSync(path, "utf8")));
}
