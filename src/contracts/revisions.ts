import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { pageIdSchema } from "./page";
import { validate } from "./validate";
import { workflowActionSchema } from "./workflow";
import { partyLegSchema, workItemSchema } from "./workitems";

/**
 * 修訂檔檔名。**不進 CONTRACT_FILES**——那組常數與 contractPath／requireContract／
 * CONTRACT_PRODUCER 綁在一起，全部假設檔案在 output/<project>/；修訂檔在 workspace/ 底下
 * （內容作者是人，見 ADR-0011），另走一組路徑 helper。
 */
export const REVISIONS_FILE = "revisions.json";

/**
 * `--prune` 把同作用點被後寫覆蓋的筆搬去這裡。與 revisions.json 同目錄、同陣列格式。
 * `loadProjectRevisions` **不讀它**——搬走就是不生效，還原路徑是「把那一筆搬回去」。
 */
export const REVISIONS_ARCHIVE_FILE = "revisions.archive.json";

/** Overview 沒有 Page 可錨，以這個字面值當錨。 */
export const OVERVIEW_ANCHOR = "overview";

/** 每筆修訂共有的兩個欄位：人寫的理由（不參與套用）與純註記的日期（不參與排序）。 */
const annotations = {
  reason: z.string().min(1),
  at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "at 必須是 YYYY-MM-DD 格式的日期")
    .optional(),
};

const workflowSet = { target: z.literal("workflow"), op: z.literal("set") };
const workitemsSet = {
  target: z.literal("workitems"),
  op: z.literal("set"),
  anchor: z.string().min(1),
};

/**
 * `set` 的 value 型別**依 field 做 discriminated union**，不用 z.unknown() 讓下游契約兜底：
 * 「purpose 填成陣列」若由 workflow.json 的契約報出來，使用者會去沒問題的那個檔空找。
 */
const setRevisionSchema = z.discriminatedUnion("field", [
  z.object({
    ...workflowSet,
    field: z.literal("overview"),
    anchor: z.literal(OVERVIEW_ANCHOR),
    value: z.string().min(1),
    ...annotations,
  }),
  z.object({
    ...workflowSet,
    field: z.literal("purpose"),
    anchor: pageIdSchema,
    value: z.string().min(1),
    ...annotations,
  }),
  z.object({
    ...workflowSet,
    field: z.literal("content"),
    anchor: pageIdSchema,
    value: z.string().min(1),
    ...annotations,
  }),
  z.object({
    ...workflowSet,
    field: z.literal("actions"),
    anchor: pageIdSchema,
    value: z.array(workflowActionSchema),
    ...annotations,
  }),
  z.object({ ...workitemsSet, field: z.literal("title"), value: z.string().min(1), ...annotations }),
  z.object({ ...workitemsSet, field: z.literal("scope"), value: z.string().min(1), ...annotations }),
  z.object({
    ...workitemsSet,
    field: z.literal("acceptance"),
    value: z.string().min(1),
    ...annotations,
  }),
  z.object({ ...workitemsSet, field: z.literal("risk"), value: z.string(), ...annotations }),
  z.object({
    ...workitemsSet,
    field: z.literal("dependsOn"),
    value: z.array(z.string().min(1)),
    ...annotations,
  }),
  // 錨在工項 id 上時 value 是整組 leg 陣列；錨在 leg 標籤（`<id>#<leg序>`）上時
  // 給長度 1 的陣列即取代那一段——這是覆蓋 leg 的 party／vendor／vendorEndpoints 的途徑。
  // field 這個判別鍵仍然有效（partyChain 與既有九個 field literal 不重疊），
  // 所以 REVISION_SCHEMA_BY_OP 與前置篩一行未改。
  z.object({
    ...workitemsSet,
    field: z.literal("partyChain"),
    value: z.array(partyLegSchema).min(1),
    ...annotations,
  }),
]);

/** 契約層共用訊息：upsert 的 value.id 必須與 anchor 相同。 */
export const UPSERT_ANCHOR_MATCHES_ID_MESSAGE = "upsert 的 value.id 必須與 anchor 相同";

/**
 * `upsert` 與 `remove` **只對 workitems 開放**：workflow 的 Page 增刪與 buildWorkflow
 * 「描述與 pages.json 一一對應」的硬檢查打架，要增刪頁應回頭改 pages.json 再重跑。
 * target 寫成 literal("workitems") 即由契約層擋下 workflow 搭這兩個 op。
 */
const upsertRevisionSchema = z
  .object({
    target: z.literal("workitems"),
    op: z.literal("upsert"),
    anchor: z.string().min(1),
    value: workItemSchema,
    ...annotations,
  })
  .refine((v) => v.value.id === v.anchor, {
    message: UPSERT_ANCHOR_MATCHES_ID_MESSAGE,
    path: ["value", "id"],
  });

const removeRevisionSchema = z.object({
  target: z.literal("workitems"),
  op: z.literal("remove"),
  anchor: z.string().min(1),
  ...annotations,
});

export type SetRevision = z.infer<typeof setRevisionSchema>;
export type UpsertRevision = z.infer<typeof upsertRevisionSchema>;
export type RemoveRevision = z.infer<typeof removeRevisionSchema>;

/** 修訂錨在哪一支產出上。刻意是 union 而非布林——未來多一支產出可以修訂時只是多一個值。 */
export type RevisionTarget = "workflow" | "workitems";

/** 一筆錨定在 Page 或 Work item 上的人工校正，覆蓋 AI 產出的單一欄位或整筆工項。 */
export type Revision = SetRevision | UpsertRevision | RemoveRevision;

const REVISION_SCHEMA_BY_OP = {
  set: setRevisionSchema,
  upsert: upsertRevisionSchema,
  remove: removeRevisionSchema,
} as const;

/**
 * 驗證一份（已解析的）修訂陣列。
 * 先讀出每筆的 op、再以該 op 的 schema 逐筆驗——不用 z.union，否則 zod 只回一個
 * invalid_union，使用者看不到到底哪個欄位錯。訊息一律冠上修訂檔名與筆序。
 */
export function parseRevisions(data: unknown): Revision[] {
  const rows = validate(
    REVISIONS_FILE,
    z.array(z.object({ op: z.enum(["set", "upsert", "remove"]) }).passthrough()),
    data,
  );
  return rows.map((row, i) =>
    validate(
      `${REVISIONS_FILE}（第 ${i + 1} 筆）`,
      REVISION_SCHEMA_BY_OP[row.op] as z.ZodType<Revision>,
      row,
    ),
  );
}

/** 讀回修訂檔；**缺檔回空陣列**而不是報錯——修訂是可選的。 */
export function loadRevisionsFile(path: string): Revision[] {
  if (!existsSync(path)) return [];
  return parseRevisions(JSON.parse(readFileSync(path, "utf8")));
}
