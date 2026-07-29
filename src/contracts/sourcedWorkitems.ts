import { readFileSync } from "node:fs";
import { z } from "zod";
import { validate } from "./validate";
import {
  BACKEND_INFERRED_MESSAGE,
  FRONTEND_NOT_INFERRED_MESSAGE,
  UNIQUE_WORKITEM_IDS_MESSAGE,
  workItemSchema,
} from "./workitems";

/** 四個來源桶：直接呼叫供應商／接回自建處理／自建／規格不明待查。 */
export const SOURCING_BUCKETS = [
  "vendor-direct",
  "vendor-adapted",
  "self-built",
  "needs-investigation",
] as const;

/** vendor-adapted 拆出的兩筆各自的角色：串接供應商端點／自建處理層。 */
export const ADAPTATION_ROLES = ["fetch", "process"] as const;

/** 契約層共用訊息：自建與待查不得攀附供應商。 */
export const SELF_BUILT_NO_VENDOR_MESSAGE =
  "self-built／needs-investigation 不得帶 vendor 或 vendorEndpoints";
/** 契約層共用訊息：靠供應商的桶必須指名供應商。 */
export const VENDOR_REQUIRED_MESSAGE = "vendor-direct／vendor-adapted 必須填 vendor";
/** 契約層共用訊息：直接呼叫與串接筆必須指出端點。 */
export const ENDPOINTS_REQUIRED_MESSAGE =
  "vendor-direct 與 adaptationRole=fetch 必須至少一條 vendorEndpoints";
/** 契約層共用訊息：自建處理層不列端點（它不呼叫供應商）。 */
export const PROCESS_NO_ENDPOINTS_MESSAGE = "adaptationRole=process 不得列 vendorEndpoints";
/** 契約層共用訊息：adaptationRole 與 vendor-adapted 互為充要。 */
export const ADAPTATION_ROLE_IFF_MESSAGE =
  "adaptationRole 存在的充要條件是 sourcing=vendor-adapted";
/** 契約層共用訊息：拆出的兩筆都要溯回原始工項。 */
export const ORIGIN_REQUIRED_MESSAGE = "vendor-adapted 的兩筆都必須填 originItemId";

/**
 * 帶來源決策的後端 Work item：在 workitems.ts 的內容型欄位上加供應商事實。
 * `sourcingConfirmed` 一律 false——AI 語意配對的結果，開工前要人核（見 ADR-0004）。
 * `originItemId` 純溯源（指回被拆前的後端工項 id），不參與 dependsOn 的參照校驗。
 */
export const sourcedBackendItemSchema = workItemSchema
  .extend({
    sourcing: z.enum(SOURCING_BUCKETS),
    vendor: z.string().min(1).optional(),
    vendorEndpoints: z.array(z.string().min(1)),
    sourcingConfirmed: z.literal(false),
    adaptationRole: z.enum(ADAPTATION_ROLES).optional(),
    originItemId: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      !(v.sourcing === "self-built" || v.sourcing === "needs-investigation") ||
      (v.vendor === undefined && v.vendorEndpoints.length === 0),
    { message: SELF_BUILT_NO_VENDOR_MESSAGE, path: ["vendor"] },
  )
  .refine(
    (v) =>
      !(v.sourcing === "vendor-direct" || v.sourcing === "vendor-adapted") ||
      v.vendor !== undefined,
    { message: VENDOR_REQUIRED_MESSAGE, path: ["vendor"] },
  )
  .refine(
    (v) =>
      !(v.sourcing === "vendor-direct" || v.adaptationRole === "fetch") ||
      v.vendorEndpoints.length > 0,
    { message: ENDPOINTS_REQUIRED_MESSAGE, path: ["vendorEndpoints"] },
  )
  .refine((v) => v.adaptationRole !== "process" || v.vendorEndpoints.length === 0, {
    message: PROCESS_NO_ENDPOINTS_MESSAGE,
    path: ["vendorEndpoints"],
  })
  .refine((v) => (v.adaptationRole !== undefined) === (v.sourcing === "vendor-adapted"), {
    message: ADAPTATION_ROLE_IFF_MESSAGE,
    path: ["adaptationRole"],
  })
  .refine((v) => v.sourcing !== "vendor-adapted" || v.originItemId !== undefined, {
    message: ORIGIN_REQUIRED_MESSAGE,
    path: ["originItemId"],
  });

/**
 * workitems-sourced.json（來源決策契約）：f2w-sourcing 產出的完整副本。
 * frontend 與 workitems.json 逐項相同（原封複製），backend 每筆多帶來源決策欄位。
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

export type SourcingBucket = (typeof SOURCING_BUCKETS)[number];
export type AdaptationRole = (typeof ADAPTATION_ROLES)[number];
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
