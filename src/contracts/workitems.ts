import { readFileSync } from "node:fs";
import { z } from "zod";
import { pageIdSchema } from "./page";
import { validate } from "./validate";

/** party 的保留逃生值：從泳道圖與 Vendor spec 都判不出誰做時填它。 */
export const NEEDS_INVESTIGATION = "needs-investigation";

/** 交付物列標籤裡分隔工項 id 與 leg 序的字元；工項 id 因此不得含它。 */
export const PARTY_LEG_SEPARATOR = "#";

/** 契約層共用訊息：待查 leg 不得攀附供應商端點。 */
export const NEEDS_INVESTIGATION_NO_VENDOR_MESSAGE =
  "needs-investigation 不得帶 vendor 或 vendorEndpoints";
/** 契約層共用訊息：vendor 與 vendorEndpoints 一有俱有、一空俱空。 */
export const VENDOR_ENDPOINTS_PAIR_MESSAGE =
  "vendor 與 vendorEndpoints 必須成對：指名供應商就要列端點，列端點就要指名供應商";
/** 契約層共用訊息：待查不是接力鏈上的一段。 */
export const NEEDS_INVESTIGATION_SINGLE_LEG_MESSAGE =
  "needs-investigation 不得出現在多 leg 的分工鏈裡（它是整筆待查，不是接力的一段）";
/** 契約層共用訊息：工項 id 不得含分隔字元。 */
export const WORKITEM_ID_NO_HASH_MESSAGE = `工項 id 不得含「${PARTY_LEG_SEPARATOR}」——它保留給交付物的分工鏈列標籤`;
/** 契約層共用訊息：多 leg 時各 leg 必須自帶散文。 */
export const MULTI_LEG_PROSE_MESSAGE =
  "多 leg 的分工鏈，每個 leg 都必須自帶 title／scope／acceptance（各方要在自己那一列畫押）";
/** 契約層共用訊息：後端工項的 partyChain 全有全無。 */
export const BACKEND_PARTY_CHAIN_ALL_OR_NONE_MESSAGE =
  "後端工項的 partyChain 必須全有全無（有派工但漏掉幾筆是靜默半套，不是沒派工）";

/**
 * 分工鏈的一段（leg）：這一段由哪個 party 做、用到哪個供應商的哪些端點、以及**這一段自己的散文**。
 * `title`／`scope`／`acceptance` 為 optional：單 leg 時缺欄即繼承工項層；多 leg 時三欄必填——
 * 抽掉 leg 散文，中繼那一列會顯示下游方的活與下游方的驗收，各方就無從各自畫押（見 ADR-0016）。
 */
export const partyLegSchema = z
  .object({
    party: z.string().min(1),
    vendor: z.string().min(1).optional(),
    vendorEndpoints: z.array(z.string().min(1)),
    title: z.string().min(1).optional(),
    scope: z.string().min(1).optional(),
    acceptance: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      v.party !== NEEDS_INVESTIGATION || (v.vendor === undefined && v.vendorEndpoints.length === 0),
    { message: NEEDS_INVESTIGATION_NO_VENDOR_MESSAGE, path: ["vendor"] },
  )
  .refine((v) => (v.vendor !== undefined) === (v.vendorEndpoints.length > 0), {
    message: VENDOR_ENDPOINTS_PAIR_MESSAGE,
    path: ["vendorEndpoints"],
  });

/**
 * 單一 Work item（工項）。
 * 只含內容型欄位（由 AI 依畫面觀察或推論填寫）；承諾型欄位（估時／優先級／RACI／簽核／狀態）
 * 刻意不進 json——那些是多人協作的權責畫押值，只存在人工另存的工作副本裡。
 * `inferred` 標記此工項是觀察自畫面（前端，false）或 AI 推論而來（後端，true，即「推論·待確認」）。
 * `partyChain` 是後端工項的分工鏈：**一筆工項一份 id，多方接力只是多一個 leg，不拆項**——
 * 拆項會改寫 id、讓修訂錨不到交付物上的東西（見 ADR-0016）。多列只在交付物層展開。
 * `partyChain`／`sourcingConfirmed` 皆 optional：`upsert` 的 value 走的就是本 schema，
 * 設成必填會讓使用者補後端工項時過不了契約。
 */
export const workItemSchema = z
  .object({
    id: z.string().min(1),
    sourcePage: pageIdSchema,
    title: z.string().min(1),
    scope: z.string().min(1),
    acceptance: z.string().min(1),
    dependsOn: z.array(z.string().min(1)),
    risk: z.string(),
    inferred: z.boolean(),
    partyChain: z.array(partyLegSchema).min(1).optional(),
    sourcingConfirmed: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.id.includes(PARTY_LEG_SEPARATOR)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["id"],
        message: `${WORKITEM_ID_NO_HASH_MESSAGE}；不合格式：${v.id}`,
      });
    }
    const chain = v.partyChain;
    if (chain === undefined || chain.length < 2) return;
    chain.forEach((leg, i) => {
      const missing = (["title", "scope", "acceptance"] as const).filter(
        (f) => leg[f] === undefined,
      );
      if (missing.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["partyChain", i],
          message: `${MULTI_LEG_PROSE_MESSAGE}；leg ${i + 1} 缺：${missing.join("、")}`,
        });
      }
      if (leg.party === NEEDS_INVESTIGATION) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["partyChain", i, "party"],
          message: `${NEEDS_INVESTIGATION_SINGLE_LEG_MESSAGE}；leg ${i + 1}`,
        });
      }
    });
  });

/**
 * 前端工項 id 的確定性格式：`FE-<頁序>-<該頁工項序>`，兩段皆從 1 起、補零兩位。
 * 兩個序號取自 workflow.json 的陣列索引，所以 workflow 沒變、id 必定相同——
 * 錨在 id 上的 Revision 才撐得過一次 f2w-breakdown 重跑。
 * 後端工項刻意不受此格式約束（見 ADR-0013）：後端筆數由 AI 推論決定，無法確定性化。
 */
export const FRONTEND_WORKITEM_ID_PATTERN = /^FE-\d{2,}-\d{2,}$/;

/** 由 workflow.json 的陣列索引（皆 0-based）推導前端工項 id。 */
export function frontendWorkitemId(pageIndex: number, itemIndex: number): string {
  const seq = (n: number) => String(n + 1).padStart(2, "0");
  return `FE-${seq(pageIndex)}-${seq(itemIndex)}`;
}

/**
 * 交付物上一個 leg 的列標籤，由 (工項 id, leg 序) **確定性推導**：
 * 單 leg 就是裸工項 id，多 leg 是 `<工項id>#<leg序>`（leg 序從 1 起）。
 * 工項 id 由契約層保證不含 `#`，所以標籤永不撞號、也切得回去——
 * 它是合法的修訂錨，使用者照交付物抄下來就錨得到東西（見 ADR-0016）。
 * `chainLength` 預設等於 `legIndex`：只給兩個參數時即「這條鏈到此為止」，也就是單 leg 情形。
 */
export function partyLegLabel(itemId: string, legIndex: number, chainLength = legIndex): string {
  return chainLength > 1 ? `${itemId}${PARTY_LEG_SEPARATOR}${legIndex}` : itemId;
}

/**
 * 列標籤的反向：切回 (工項 id, leg 序)。沒有 `#` 就是整筆工項（legIndex 為 undefined）。
 * 切法無歧義的前提是工項 id 不含 `#`——那由 workItemSchema 的 refine 保證。
 */
export function parsePartyLegLabel(label: string): { itemId: string; legIndex?: number } {
  const at = label.indexOf(PARTY_LEG_SEPARATOR);
  if (at < 0) return { itemId: label };
  const seq = Number(label.slice(at + 1));
  if (!Number.isInteger(seq) || seq < 1) return { itemId: label };
  return { itemId: label.slice(0, at), legIndex: seq };
}

/** 契約層共用訊息：前端工項 id 必須是確定性格式。 */
export const FRONTEND_WORKITEM_ID_MESSAGE =
  "前端工項 id 必須為 FE-<頁序>-<該頁工項序>（兩段皆補零兩位、取自 workflow.json 的陣列索引）";

/** 契約層共用訊息：工項 id 必須全域唯一。 */
export const UNIQUE_WORKITEM_IDS_MESSAGE = "工項 id 必須全域唯一（跨 frontend 與 backend）";
/** 契約層共用訊息：前端工項一律非推論。 */
export const FRONTEND_NOT_INFERRED_MESSAGE = "前端工項的 inferred 必須為 false（觀察自畫面）";
/** 契約層共用訊息：後端工項一律推論。 */
export const BACKEND_INFERRED_MESSAGE = "後端工項的 inferred 必須為 true（推論·待確認）";

/**
 * workitems.json（Work breakdown 契約）：f2w-breakdown 產出，是 workitems.xlsx 每列的來源。
 * frontend 為觀察自畫面的前端工項，backend 為 AI 推論的後端工項（可帶分工鏈）。
 * refine 把守跨陣列 id 唯一、前端／後端的 inferred 旗標、以及後端 partyChain 全有全無——手改此檔時也擋得住。
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
  })
  .superRefine((v, ctx) => {
    // 逐筆加 issue（而非單一 refine）：訊息要指名是哪一筆 id 不合格式。
    v.frontend.forEach((item, i) => {
      if (FRONTEND_WORKITEM_ID_PATTERN.test(item.id)) return;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frontend", i, "id"],
        message: `${FRONTEND_WORKITEM_ID_MESSAGE}；不合格式：${item.id}`,
      });
    });
    // 後端 partyChain 全有全無：半套比沒派工更難察覺，所以要大聲。
    const withChain = v.backend.filter((i) => i.partyChain !== undefined);
    if (withChain.length === 0 || withChain.length === v.backend.length) return;
    const missing = v.backend.filter((i) => i.partyChain === undefined).map((i) => i.id);
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["backend"],
      message: `${BACKEND_PARTY_CHAIN_ALL_OR_NONE_MESSAGE}；缺 partyChain 的有：${missing.join("、")}`,
    });
  });

export type PartyLeg = z.infer<typeof partyLegSchema>;
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
