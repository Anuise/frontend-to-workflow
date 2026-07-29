import { expect, test } from "vitest";
import {
  type SourcingDecision,
  buildSourcedWorkitems,
  loadWorkitemsForSourcing,
  parseVendorSpec,
  saveSourcedWorkitems,
} from "../src/sourcing";

// f2w-sourcing 驅動：讀回 workitems.json 與五份 Vendor spec，逐後端工項定來源決策，
// 經 buildSourcedWorkitems 硬底線把關後落地 workitems-sourced.json。
const OUTPUT_ROOT = "output";
const PROJECT = "new_0724_AI六大模組管理平台_桃園智發會_最新版";
const SPECS = [
  "workspace/spec/aidms-openapi.json",
  "workspace/spec/Gateway-API.json",
  "workspace/spec/AI-security.json",
  "workspace/spec/Model-Maintenance.json",
  "workspace/spec/IDP-service.json",
];

const AIDMS = "aidms-openapi";
const GATEWAY = "Gateway-API";
const SECURITY = "AI-security";
const MM = "Model-Maintenance";

/** 直接呼叫供應商。 */
const direct = (itemId: string, vendor: string, endpoints: string[]): SourcingDecision => ({
  itemId,
  sourcing: "vendor-direct",
  vendor,
  vendorEndpoints: endpoints,
});

/** 自建。 */
const self = (itemId: string): SourcingDecision => ({ itemId, sourcing: "self-built" });

/** 規格不明，待與供應商釐清。 */
const investigate = (itemId: string): SourcingDecision => ({
  itemId,
  sourcing: "needs-investigation",
});

type Part = { title: string; scope: string; acceptance: string };

/** 接回自建處理：拆成串接端點（-F）與自建處理層（-P）兩筆。 */
const adapted = (
  itemId: string,
  vendor: string,
  endpoints: string[],
  fetchPart: Part,
  processPart: Part,
): SourcingDecision => ({
  itemId,
  sourcing: "vendor-adapted",
  vendor,
  vendorEndpoints: endpoints,
  fetch: { id: `${itemId}-F`, ...fetchPart },
  process: { id: `${itemId}-P`, ...processPart },
});

const DECISIONS: SourcingDecision[] = [
  // 身分與權限：aidms 提供帳密登入與工作階段，SSO 本身五份 spec 都沒有。
  investigate("BE-AUTH-1"),
  direct("BE-AUTH-2", AIDMS, ["POST /api/v1/login"]),
  adapted(
    "BE-AUTH-3",
    GATEWAY,
    ["POST /rbac/v1/permissions/query"],
    {
      title: "串接權限查詢端點",
      scope: "呼叫 Gateway 的權限查詢取回該身分的密等與可用 API endpoint 清單。",
      acceptance: "取得的清單含密等與端點兩層資訊，逾時與錯誤有明確回應。",
    },
    {
      title: "可見選單與按鈕裁切層",
      scope: "把供應商回的權限事實映射成平台側欄模組與頁面操作的可見性。",
      acceptance: "申請者身分只映射出算力申請與審核，越權呼叫其他 API 被拒。",
    },
  ),
  direct("BE-AUTH-4", AIDMS, ["POST /api/v1/logout", "POST /api/v1/refresh_token"]),

  // 模型倉庫：aidms 管檔案與分段上傳，Model-Maintenance 管版本治理。
  direct("BE-MODEL-1", AIDMS, ["GET /api/v1/models"]),
  adapted(
    "BE-MODEL-2",
    AIDMS,
    [
      "POST /api/v1/models/chunks",
      "PATCH /api/v1/models/chunks/{chunkID}",
      "POST /api/v1/models/chunks/{id}/finalize",
    ],
    {
      title: "串接模型分段上傳端點",
      scope: "以 chunk 建立、續傳與 finalize 三段完成大檔上傳。",
      acceptance: "中斷後可從既有 chunk 續傳，finalize 後模型可見。",
    },
    {
      title: "上傳格式驗證與進度回饋層",
      scope: "副檔名白名單、校驗和比對與上傳進度回饋，皆為平台自訂規則。",
      acceptance: "副檔名與內容不符時在 finalize 前擋下，前端看得到進度。",
    },
  ),
  adapted(
    "BE-MODEL-3",
    AIDMS,
    [
      "GET /api/v1/projects/{projectID}/models/{modelID}/download",
      "GET /api/v1/projects/{projectID}/models/{modelID}/download/ws",
    ],
    {
      title: "串接模型下載端點",
      scope: "以 HTTP 或 WebSocket 兩種方式取回模型檔。",
      acceptance: "大檔可串流下載，連線中斷可重試。",
    },
    {
      title: "下載授權與短效連結層",
      scope: "下載前的權限判定、簽章網址發放與存取稽核。",
      acceptance: "無權者被拒，簽章網址有短效期且每次下載留紀錄。",
    },
  ),
  direct("BE-MODEL-4", MM, [
    "POST /model-registry/v1/models/",
    "POST /model-registry/v1/models/{model_id}/versions",
    "GET /model-registry/v1/models/{model_id}/versions/{model_version_id}",
    "PATCH /model-registry/v1/models/{model_id}/versions/{model_version_id}/status",
  ]),

  // 叢集資源：aidms 有節點配置與 Grafana proxy，推播頻率是平台自己的事。
  adapted(
    "BE-CLUSTER-1",
    AIDMS,
    ["GET /api/v1/grafana/{path}", "GET /api/v1/nodes/{nodeID}/allocation"],
    {
      title: "串接節點指標與 Grafana 查詢",
      scope: "透過 Grafana proxy 取時序指標，並讀節點配置作為配額基準。",
      acceptance: "指標時間軸連續，節點配置與指標可對齊。",
    },
    {
      title: "GPU 記憶體三態彙整層",
      scope: "把原始指標換算成畫面要的 used／reserved／free 與利用率序列。",
      acceptance: "三態相加不超過該卡總量，缺值明確標示。",
    },
  ),
  self("BE-CLUSTER-2"),
  direct("BE-CLUSTER-3", AIDMS, [
    "GET /api/v1/projects/{id}/resource_list/allocation",
    "GET /api/v1/nodes/disk-usage",
  ]),

  // 申請流程：AI-security 的 HITL 提供人工審核任務載體，申請單本身的欄位與狀態機是平台自有。
  adapted(
    "BE-APPLY-1",
    SECURITY,
    ["POST /hitl/v1/tasks"],
    {
      title: "串接 HITL 審核任務建立",
      scope: "案件成立時建立對應的人工審核任務並取回任務識別。",
      acceptance: "任務建立成功回 hitl_task_id，重送同案不重複建任務。",
    },
    {
      title: "申請單資料模型與狀態機",
      scope: "專案資訊、模型、Domain、來源 IP、人數與使用目的的持久化與待審核狀態。",
      acceptance: "建立成功回案件編號，案件與 HITL 任務一對一綁定。",
    },
  ),
  self("BE-APPLY-2"),
  self("BE-APPLY-3"),
  self("BE-APPLY-4"),
  self("BE-APPLY-5"),
  self("BE-APPLY-6"),
  direct("BE-APPLY-7", GATEWAY, [
    "DELETE /llm/v1/projects/{project_id}/clients/{client_id}",
    "PATCH /llm/v1/projects/{project_id}/clients/{client_id}",
  ]),

  // 審核與核發：Gateway 掌管 Project／Team／Client 與 Virtual Key，額度也在它身上。
  self("BE-REVIEW-1"),
  adapted(
    "BE-REVIEW-2",
    GATEWAY,
    [
      "PATCH /llm/v1/projects/{project_id}/team/limits",
      "PATCH /llm/v1/projects/{project_id}/clients/{client_id}/limits",
    ],
    {
      title: "串接額度設定端點",
      scope: "把核定的 TPM／RPM 寫進 Team 與 Client 的 limits。",
      acceptance: "設定後 Gateway 端的 limits 與核定值一致。",
    },
    {
      title: "有效期與審核備註保存層",
      scope: "有效期起訖與審核備註 Gateway 沒有對應欄位，由平台保存並在到期時撤銷額度。",
      acceptance: "逾期案件自動觸發撤銷，備註可回查。",
    },
  ),
  direct("BE-REVIEW-3", GATEWAY, [
    "POST /llm/v1/projects/create",
    "POST /llm/v1/projects/{project_id}/clients",
  ]),
  direct("BE-REVIEW-4", SECURITY, ["POST /hitl/v1/tasks/{hitl_task_id}/decisions"]),
  investigate("BE-REVIEW-5"),
  adapted(
    "BE-REVIEW-6",
    GATEWAY,
    ["GET /llm/v1/projects/{project_id}/clients"],
    {
      title: "串接 Client 與憑證查詢",
      scope: "讀回該案的 Client 清單與各自的 limits。",
      acceptance: "查得到端點與 Client 狀態。",
    },
    {
      title: "憑證遮罩與存取稽核層",
      scope: "預設遮罩、完整值需額外授權，每次讀取寫稽核。",
      acceptance: "未授權只看得到遮罩值，讀取行為皆留紀錄。",
    },
  ),

  // 專案與配額：aidms 的 project／node 就是算力專案。
  direct("BE-PROJ-1", AIDMS, [
    "GET /api/v1/projects",
    "GET /api/v1/projects/{id}/resource_list/allocation",
  ]),
  direct("BE-PROJ-2", AIDMS, ["POST /api/v1/projects"]),
  adapted(
    "BE-PROJ-3",
    AIDMS,
    ["PUT /api/v1/projects/{project_id}/resources", "GET /api/v1/nodes/{nodeID}/allocation"],
    {
      title: "串接專案資源配置端點",
      scope: "讀節點可用量並寫入專案的 GPU／CPU／RAM 配置。",
      acceptance: "配置寫入後讀回一致。",
    },
    {
      title: "GPU 併發搶佔與超賣防護層",
      scope: "配置寫入前的資料庫層鎖定與獨占／共享語意判定。",
      acceptance: "同一張卡不會被兩個專案同時獨占，併發只有一方成功。",
    },
  ),
  direct("BE-PROJ-4", AIDMS, [
    "GET /api/v1/projects/{id}",
    "GET /api/v1/projects/{projectID}/jobs/llm",
  ]),
  direct("BE-PROJ-5", AIDMS, ["PUT /api/v1/projects/{project_id}/resources"]),

  // 模型服務：對應 aidms 的 LLM job 生命週期。
  direct("BE-SVC-1", AIDMS, ["POST /api/v1/projects/{projectID}/jobs/llm"]),
  self("BE-SVC-2"),
  investigate("BE-SVC-3"),
  adapted(
    "BE-SVC-4",
    AIDMS,
    ["PATCH /api/v1/projects/{project_id}/jobs/llm/{job_id}"],
    {
      title: "串接 job 設定更新端點",
      scope: "把推論參數與旗標寫回 LLM job 的基本資訊。",
      acceptance: "更新後讀回一致，需重啟才生效的項目有標示。",
    },
    {
      title: "推論參數校驗與自動擴展策略層",
      scope: "依所選模型能力校驗 Temperature／Max Tokens／Context Window，並實作自動擴展上下界。",
      acceptance: "超界參數在送到供應商前被擋下，擴展有上下界。",
    },
  ),
  direct("BE-SVC-5", AIDMS, ["GET /api/v1/projects/{projectID}/jobs/llm/{jobID}"]),
  adapted(
    "BE-SVC-6",
    AIDMS,
    ["GET /api/v1/projects/{projectID}/jobs/llm/{jobID}/description", "GET /api/v1/grafana/{path}"],
    {
      title: "串接服務用量指標",
      scope: "讀 pod description 與 Grafana 時序取得該服務的資源用量。",
      acceptance: "取得的時序涵蓋 CPU／RAM／GPU 三類。",
    },
    {
      title: "服務用量對齊叢集指標層",
      scope: "把 pod 級指標對齊到叢集視角的時間軸與單位。",
      acceptance: "同一時間點的服務用量與叢集總量可對帳。",
    },
  ),
  direct("BE-SVC-7", SECURITY, ["GET /trace-link/v1/litellm/usage-summary"]),
  direct("BE-SVC-8", GATEWAY, ["PATCH /llm/v1/projects/{project_id}/clients/{client_id}"]),
  direct("BE-SVC-9", AIDMS, [
    "POST /api/v1/projects/{projectID}/jobs/llm/{jobID}/restart",
    "POST /api/v1/projects/{projectID}/jobs/llm/{jobID}/stop",
    "POST /api/v1/projects/{projectID}/jobs/llm/{jobID}/start",
  ]),
  direct("BE-SVC-10", AIDMS, ["PUT /api/v1/projects/{projectID}/jobs/llm/{jobID}/resources"]),
  direct("BE-SVC-11", AIDMS, ["DELETE /api/v1/projects/{projectID}/jobs/llm/{jobID}"]),
  direct("BE-SVC-12", AIDMS, ["GET /api/v1/projects/{projectID}/jobs/llm/{jobID}/logs"]),
  adapted(
    "BE-SVC-13",
    AIDMS,
    ["GET /api/v1/projects/{projectID}/jobs/llm/{jobID}/terminal"],
    {
      title: "串接容器終端機通道",
      scope: "取得 job 的終端連線並代理互動輸入輸出。",
      acceptance: "可開啟連線並看到回傳輸出，閒置自動斷線。",
    },
    {
      title: "終端權限控管與指令稽核層",
      scope: "開通道前的權限判定、指令留存與高風險指令封鎖。",
      acceptance: "無權者無法開啟通道，所有指令留紀錄。",
    },
  ),
  direct("BE-SVC-14", AIDMS, ["POST /api/v1/projects/{projectID}/jobs/llm/{jobID}/commit"]),

  // 安全監控：runtime-guard 是攔截執行點；關鍵字清單維護在五份 spec 內找不到對應。
  adapted(
    "BE-SEC-1",
    SECURITY,
    ["GET /audit/v1/events"],
    {
      title: "串接稽核事件查詢",
      scope: "以時間與類型條件讀回攔截與操作事件。",
      acceptance: "查詢支援分頁，區間邊界明確。",
    },
    {
      title: "安全事件統計彙總層",
      scope: "把事件彙總成攔截次數、類型分布與趨勢。",
      acceptance: "統計數字可回溯到原始事件。",
    },
  ),
  investigate("BE-SEC-2"),
  direct("BE-SEC-3", SECURITY, [
    "POST /runtime-guard/v1/input-scan",
    "POST /runtime-guard/v1/output-scan",
    "POST /runtime-guard/v1/rag-context-scan",
  ]),

  // 追蹤與報表：AI-security 的 trace 與 usage-summary 供資料，報表口徑與匯出自建。
  direct("BE-TRACE-1", SECURITY, ["GET /trace-link/v1/langfuse/traces"]),
  adapted(
    "BE-TRACE-2",
    SECURITY,
    [
      "GET /trace/v1/traces/{target_trace_id}/timeline",
      "GET /trace-payload/v1/traces/{target_trace_id}/payloads",
    ],
    {
      title: "串接追蹤明細與 payload",
      scope: "讀單筆追蹤的 timeline 與請求／回應 payload。",
      acceptance: "明細與清單該列一致。",
    },
    {
      title: "追蹤內容遮罩層",
      scope: "依權限對 payload 內的個資與憑證遮罩後才回前端。",
      acceptance: "未授權者看不到原始 payload 的敏感欄位。",
    },
  ),
  adapted(
    "BE-TRACE-3",
    SECURITY,
    ["GET /trace-link/v1/litellm/usage-summary"],
    {
      title: "串接用量彙總端點",
      scope: "依區間取回 LLM 用量彙總資料。",
      acceptance: "區間參數正確傳遞，回應含 Token 與呼叫數。",
    },
    {
      title: "三種管理報表口徑計算層",
      scope: "把用量與追蹤資料算成系統運作、系統成效與依賴狀況三種報表。",
      acceptance: "三種報表同區間數字互相一致且可回溯到原始追蹤。",
    },
  ),
  self("BE-TRACE-4"),

  // 帳號：aidms 的 users 就是自管帳號；公務系統介接在五份 spec 內沒有對應。
  investigate("BE-ACCT-1"),
  direct("BE-ACCT-2", AIDMS, ["GET /api/v1/users"]),
  direct("BE-ACCT-3", AIDMS, ["POST /api/v1/users"]),
  direct("BE-ACCT-4", AIDMS, [
    "PATCH /api/v1/users/{userID}",
    "PATCH /api/v1/projects/{project_id}/users/{user_id}/role",
  ]),
  adapted(
    "BE-ACCT-5",
    AIDMS,
    ["DELETE /api/v1/users/{userID}"],
    {
      title: "串接帳號刪除端點",
      scope: "呼叫供應商刪除帳號，並要求明確的確認參數。",
      acceptance: "沒帶確認參數不執行刪除。",
    },
    {
      title: "軟刪除與可復原層",
      scope: "先在平台標記停用並保留稽核痕跡，逾保留期才真的呼叫刪除。",
      acceptance: "停用後無法登入，保留期內誤刪可復原。",
    },
  ),

  // 橫切：稽核與限流落在供應商，錯誤契約是平台自訂。
  direct("BE-X-1", SECURITY, ["POST /audit/v1/events", "GET /audit/v1/events"]),
  self("BE-X-2"),
  direct("BE-X-3", GATEWAY, [
    "PATCH /llm/v1/projects/{project_id}/team/limits",
    "PATCH /llm/v1/projects/{project_id}/clients/{client_id}/limits",
  ]),
];

test("f2w-sourcing：對照 Vendor spec 定來源決策並落地 workitems-sourced.json", () => {
  const workitems = loadWorkitemsForSourcing(OUTPUT_ROOT, PROJECT);
  const capabilities = SPECS.flatMap((s) => parseVendorSpec(s));

  expect(DECISIONS).toHaveLength(workitems.backend.length);

  const sourced = buildSourcedWorkitems(workitems, capabilities, DECISIONS);

  const adaptedCount = DECISIONS.filter((d) => d.sourcing === "vendor-adapted").length;
  expect(sourced.backend).toHaveLength(workitems.backend.length + adaptedCount);
  expect(sourced.frontend).toEqual(workitems.frontend);

  saveSourcedWorkitems(OUTPUT_ROOT, PROJECT, sourced);
});
