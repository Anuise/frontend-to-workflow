import { readFileSync } from "node:fs";
import { z } from "zod";
import { validate } from "./validate";
import {
  BACKEND_INFERRED_MESSAGE,
  FRONTEND_NOT_INFERRED_MESSAGE,
  UNIQUE_WORKITEM_IDS_MESSAGE,
  workItemSchema,
} from "./workitems";

/** assignedParty 的保留逃生值：從泳道圖與 Vendor spec 都判不出誰做時填它。 */
export const NEEDS_INVESTIGATION = "needs-investigation";

/** 契約層共用訊息：待查工項不得攀附供應商端點。 */
export const NEEDS_INVESTIGATION_NO_VENDOR_MESSAGE =
  "needs-investigation 不得帶 vendor 或 vendorEndpoints";
/** 契約層共用訊息：vendor 與 vendorEndpoints 一有俱有、一空俱空。 */
export const VENDOR_ENDPOINTS_PAIR_MESSAGE =
  "vendor 與 vendorEndpoints 必須成對：指名供應商就要列端點，列端點就要指名供應商";

/**
 * 帶分工歸屬的後端 Work item：在 workitems.ts 的內容型欄位上加 Party assignment。
 * `assignedParty` 是分工方名（權責泳道圖的泳道名或 Vendor spec 檔名）或 needs-investigation；
 * 方名集合隨執行時輸入而定，契約層只驗形狀，集合成員資格由 buildSourcedWorkitems 把關。
 * `vendor`／`vendorEndpoints` 與 assignedParty 脫鉤：配到某份 spec 的端點才成對填上。
 * `sourcingConfirmed` 一律 false——AI 語意配對的結果，開工前要人核（見 ADR-0004、ADR-0007）。
 * `originItemId` 純溯源（指回被拆前的後端工項 id），不參與 dependsOn 的參照校驗。
 */
export const sourcedBackendItemSchema = workItemSchema
  .extend({
    assignedParty: z.string().min(1),
    vendor: z.string().min(1).optional(),
    vendorEndpoints: z.array(z.string().min(1)),
    sourcingConfirmed: z.literal(false),
    originItemId: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      v.assignedParty !== NEEDS_INVESTIGATION ||
      (v.vendor === undefined && v.vendorEndpoints.length === 0),
    { message: NEEDS_INVESTIGATION_NO_VENDOR_MESSAGE, path: ["vendor"] },
  )
  .refine((v) => (v.vendor !== undefined) === (v.vendorEndpoints.length > 0), {
    message: VENDOR_ENDPOINTS_PAIR_MESSAGE,
    path: ["vendorEndpoints"],
  });

/**
 * workitems-sourced.json（分工歸屬契約）：f2w-sourcing 產出的完整副本。
 * frontend 與 workitems.json 逐項相同（原封複製），backend 每筆多帶分工歸屬欄位。
 */
export const sourcedWorkitemsSchema = z
  .object({
    project: z.string().min(1),
    frontend: z.array(workItemSchema),
    backend: z.array(sourcedBackendItemSchema),
  })
  .refine(
    (v) => {
      const ids = [...v.frontend, ...v.backend].map((i) => i.id);
      return new Set(ids).size === ids.length;
    },
    { message: UNIQUE_WORKITEM_IDS_MESSAGE, path: ["backend"] },
  )
  .refine((v) => v.frontend.every((i) => i.inferred === false), {
    message: FRONTEND_NOT_INFERRED_MESSAGE,
    path: ["frontend"],
  })
  .refine((v) => v.backend.every((i) => i.inferred === true), {
    message: BACKEND_INFERRED_MESSAGE,
    path: ["backend"],
  });

export type SourcedBackendItem = z.infer<typeof sourcedBackendItemSchema>;
export type SourcedWorkitems = z.infer<typeof sourcedWorkitemsSchema>;

/** 驗證一個（已解析的）workitems-sourced 物件。 */
export function parseSourcedWorkitems(data: unknown): SourcedWorkitems {
  return validate("workitems-sourced.json", sourcedWorkitemsSchema, data);
}

/** 讀取並驗證 workitems-sourced.json 檔（JSON）。 */
export function loadSourcedWorkitems(path: string): SourcedWorkitems {
  return parseSourcedWorkitems(JSON.parse(readFileSync(path, "utf8")));
}
