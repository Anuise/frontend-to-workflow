import { describe, expect, it } from "vitest";
import { type PageDescription, buildWorkflow, loadCapturedPages, saveWorkflow } from "../src/describe";

const OUTPUT_ROOT = "output";
const PROJECT = "new_0724_AI六大模組管理平台_桃園智發會_最新版";

/** Page 識別捷徑：整站路由恆為 "/"，只用 tab 區分狀態。 */
const to = (tab: string) => ({ route: "/", tab });

// SSO 側欄的七個導覽去向（模組首頁／首個分頁）
const NAV_MODEL = "SSO｜模型倉庫";
const NAV_APPLY = "SSO｜算力申請與審核｜申請者｜提出申請";
const NAV_WORKLOAD = "SSO｜算力排程與工作負載";
const NAV_CLUSTER = "SSO｜叢集資源總覽";
const NAV_SECURITY = "SSO｜安全監控";
const NAV_TRACE = "SSO｜追蹤日誌";
const NAV_ACCOUNT = "SSO｜帳號與權限管理｜介接公務系統";

/** SSO 各模組頁共用的側欄／登出操作。 */
const ssoNav = (self: string) =>
  [
    { label: "由側欄前往「模型倉庫」", destination: to(NAV_MODEL) },
    { label: "由側欄前往「算力申請與審核」", destination: to(NAV_APPLY) },
    { label: "由側欄前往「算力排程與工作負載」", destination: to(NAV_WORKLOAD) },
    { label: "由側欄前往「叢集資源總覽」", destination: to(NAV_CLUSTER) },
    { label: "由側欄前往「安全監控」", destination: to(NAV_SECURITY) },
    { label: "由側欄前往「追蹤日誌」", destination: to(NAV_TRACE) },
    { label: "由側欄前往「帳號與權限管理」", destination: to(NAV_ACCOUNT) },
    { label: "點右上「登出」結束工作階段回到登入頁", destination: to("登入") },
    { label: "點側欄底部箭頭收合或展開側欄", destination: null },
  ].filter((a) => a.destination === null || a.destination.tab !== self);

/** 算力申請與審核的三個分頁列（一般登入只有前兩個，另行處理）。 */
const applyTabs = (self: string) =>
  [
    { label: "切到「申請者｜提出申請」分頁", destination: to("SSO｜算力申請與審核｜申請者｜提出申請") },
    { label: "切到「申請者｜進度追蹤」分頁", destination: to("SSO｜算力申請與審核｜申請者｜進度追蹤") },
    { label: "切到「管理者｜審核」分頁", destination: to("SSO｜算力申請與審核｜管理者｜審核") },
  ].filter((a) => a.destination.tab !== self);

/** 模型服務詳情的六個分頁。 */
const serviceTabs = (self: string) =>
  ["資訊", "資源", "API監控", "設定", "日誌", "描述"]
    .filter((name) => name !== self)
    .map((name) => ({
      label: `切到「${name}」分頁`,
      destination: to(`SSO｜算力排程與工作負載｜模型服務詳情｜${name}`),
    }));

const OVERVIEW =
  "本平台為單頁式「AI Platform 開發管理中控平台」，整站路由恆為 \"/\"，所有模組與其下狀態皆以 JS 切換，非 <a> 導覽。" +
  "使用者一律先在登入頁選擇身分：「SSO 單一簽入」進入完整平台（預設落在叢集資源總覽），「一般登入」則只保留算力申請與審核一個模組，供外部申請者提案與追蹤案件。" +
  "SSO 身分的左側側欄分為六大區塊：模型倉庫、算力管理（算力申請與審核、算力排程與工作負載、叢集資源總覽）、安全監控、追蹤日誌、帳號與權限管理。" +
  "核心使用流程有四條主線：（1）模型供給——於「模型倉庫」檢視已註冊模型清單、上傳新模型，供後續申請與部署選用；" +
  "（2）模型服務申請與審核——申請者在「算力申請與審核」填寫專案名稱、申請模型、Domain 與來源 IP、使用人數與使用目的送出申請，於進度追蹤查看核定結果、API 端點與 API Key，未通過的案件可編輯後重新送件；" +
  "管理者在審核分頁以清單篩選案件，開啟「模型服務審核」彈窗核定 TPM／RPM 與有效期、勾選該案要啟用的安全監控項目後核定開通或退回，已開通案件則從「模型服務詳細資料」檢視憑證、調整監控設定或停用 API 與 API Key；" +
  "（3）算力供給與部署——於「算力排程與工作負載」新建專案並設定 CPU／RAM 配額與 GPU 配置，點「維護」進入專案詳情，在專案上限內建立模型服務（可選現有模型或自帶 Docker 新環境，設定連接埠、掛載磁碟區、節點資源與推論參數），" +
  "再由模型服務詳情的資訊／資源／API監控／設定／日誌／描述六個分頁監看與維運，包含變更資源分配、啟停服務與刪除模型；" +
  "（4）治理與觀測——「安全監控」呈現 PII 個資監控、LLM Guard、Keyword Matching 三項標記成效並可維護攔截關鍵字，「追蹤日誌」列出 Langfuse 追蹤、鑽入單筆追蹤的 waterfall 詳情，並開啟管理報表（系統運作／系統成效／依賴狀況）。" +
  "「帳號與權限管理」分為唯讀同步的介接公務系統帳號與可新增、編輯、停用的系統自管帳號。" +
  "整個系統為純前端原型，資料為 in-memory 假資料，送出、核定、新增、編輯、刪除等寫入僅在前端即時生效。";

const DESCRIPTIONS: PageDescription[] = [
  {
    route: "/",
    tab: "登入",
    purpose: "平台入口，選擇以哪一種身分進入工作空間；示範環境不需輸入帳密或驗證碼。",
    content:
      "左半為「AI Compute Control 企業級算力服務平台」品牌區塊與 H200／TPM／API 三張說明卡；右半為「登入工作空間」，提供「SSO 單一簽入（企業帳號・使用完整平台功能）」與「一般登入（提出申請與追蹤案件處理進度）」兩個按鈕，下方提示此為示範環境，頁尾標示版本 v2.4.0。",
    actions: [
      { label: "點「SSO 單一簽入」以完整權限進入平台（預設落在叢集資源總覽）", destination: to(NAV_CLUSTER) },
      {
        label: "點「一般登入」以申請者身分進入（側欄只保留算力申請與審核）",
        destination: to("一般登入｜算力申請與審核｜申請者｜提出申請"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜模型倉庫",
    purpose: "模型註冊中心，總覽平台目前可用的模型版本與供應商，並作為上傳新模型的入口。",
    content:
      "「模型註冊中心」表格列出 Llama 3.3 70B、Llama-3.3-Nemotron、GPT-oss-120B、Gemma 3 27B 四個模型的類型（LLM／VLM）、版本、狀態（Active）、供應商（vLLM／Azure OpenAI／AWS Bedrock／HuggingFace）與 Context 長度，每列附「下載」按鈕；右上為「上傳模型」按鈕。",
    actions: [
      { label: "點「上傳模型」開啟上傳彈窗", destination: to("SSO｜模型倉庫｜上傳模型") },
      { label: "點模型列「下載」取得模型檔（純前端原型未實際下載）", destination: null },
      ...ssoNav(NAV_MODEL),
    ],
  },
  {
    route: "/",
    tab: "SSO｜模型倉庫｜上傳模型",
    purpose: "以彈窗表單把新模型登錄到模型註冊中心，供申請與部署時選用。",
    content:
      "「上傳模型」彈窗：模型類型（Instance／LLM 二選一）、模型名稱、模型標籤（版本）、模型描述，以及支援 .bin／.pt／.safetensors／.gguf／.onnx／.pkl 的檔案拖放區；底部為「關閉」與「上傳模型」。",
    actions: [
      { label: "選擇模型類型、填寫名稱／標籤／描述、選檔或拖放模型檔", destination: null },
      { label: "點「上傳模型」送出（純前端即時新增，未實際執行）", destination: to(NAV_MODEL) },
      { label: "點「關閉」或右上叉關掉彈窗", destination: to(NAV_MODEL) },
    ],
  },
  {
    route: "/",
    tab: "SSO｜叢集資源總覽",
    purpose: "SSO 登入後的預設頁，即時監看兩座 GPU 叢集的資源水位與 Kubernetes 專案隔離狀態。",
    content:
      "NVIDIA H200 叢集（大規模訓練，8 GPUs，141 GiB/GPU）與 NVIDIA L40 叢集（視覺推論、圖形與生成式工作負載，4 GPUs，48 GiB/GPU）兩張可展開卡片，每張 GPU 各有「GPU 記憶體使用量」面積圖（used／reserved／free）與「GPU 利用率」折線圖，標示即時更新 30 秒頻率；下方「專案隔離（Kubernetes Namespaces）」四張卡（pilot-project-ns、fintech-ml-ns、text-analysis-ns、vision-prod-ns）顯示運行狀態、Pods／CPU／Memory 與 GPU 配額及已使用量。",
    actions: [
      { label: "展開或收合 H200／L40 叢集圖表卡", destination: null },
      ...ssoNav(NAV_CLUSTER),
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力申請與審核｜申請者｜提出申請",
    purpose: "申請者填寫並送出一筆模型服務申請，是整條申請審核流程的起點。",
    content:
      "三個分頁（申請者｜提出申請、申請者｜進度追蹤、管理者｜審核）下的「提出模型服務申請」表單：專案名稱（必填）、專案類型（模型推論等下拉）、申請模型（選單依模型倉庫已註冊模型提供）、Domain Name 與來源 IP（必填）、最大／平均使用人數、使用目的（必填），右下為「清除」與「送出申請」。",
    actions: [
      { label: "填寫專案名稱／類型、選申請模型、填 Domain 與來源 IP、人數與使用目的", destination: null },
      { label: "點「清除」清空表單欄位", destination: null },
      {
        label: "點「送出申請」建立待審核案件（寫入動作，僅記錄未執行）",
        destination: to("SSO｜算力申請與審核｜申請者｜進度追蹤"),
      },
      ...applyTabs("SSO｜算力申請與審核｜申請者｜提出申請"),
      ...ssoNav(NAV_APPLY),
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力申請與審核｜申請者｜進度追蹤",
    purpose: "申請者追蹤自己送出的案件處理進度，並取得已核定案件的 API 端點與 API Key。",
    content:
      "案件卡片列表：A2026-001 行政智慧助理（已開通，附核定說明、API 端點與 API Key 及複製鈕、核定用量 TPM 50,000／RPM 1,000 與有效期）、A2026-002 語音辨識服務（待審核）、A2026-003 知識庫問答（未通過，附退件說明「請補充模型預計呼叫量與使用情境後重新送件」）、A2026-006 知識庫語意檢索服務（已開通）；各卡依狀態顯示「查看」「停用」或「編輯申請」「取消申請」按鈕。",
    actions: [
      {
        label: "點案件「查看」開啟申請案件內容彈窗",
        destination: to("SSO｜算力申請與審核｜申請者｜進度追蹤｜申請案件內容"),
      },
      {
        label: "點未通過案件的「編輯申請」載入原內容重新編輯",
        destination: to("SSO｜算力申請與審核｜申請者｜進度追蹤｜編輯申請"),
      },
      { label: "點「取消申請」撤回案件（破壞性動作，僅記錄未執行）", destination: null },
      { label: "點已開通案件的「停用」關閉該服務（破壞性動作，僅記錄未執行）", destination: null },
      { label: "點端點或 API Key 旁的「複製」複製憑證（含機敏資訊，僅記錄未執行）", destination: null },
      ...applyTabs("SSO｜算力申請與審核｜申請者｜進度追蹤"),
      ...ssoNav(NAV_APPLY),
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力申請與審核｜申請者｜進度追蹤｜申請案件內容",
    purpose: "以唯讀彈窗檢視單一申請案件當初送出的完整內容。",
    content:
      "「申請案件內容」彈窗，逐項列出案件編號與名稱（A2026-001｜行政智慧助理）、申請模型（Gemma4:31b）、Domain Name、來源 IP、最大／平均使用人數（120／45 人）與使用目的。",
    actions: [
      {
        label: "點右上叉關掉彈窗回到進度追蹤",
        destination: to("SSO｜算力申請與審核｜申請者｜進度追蹤"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力申請與審核｜申請者｜進度追蹤｜編輯申請",
    purpose: "修正被退回的案件內容後重新送件，欄位與提出申請相同但帶入原申請值。",
    content:
      "分頁切回「申請者｜提出申請」並顯示「編輯申請」表單，帶入 A2026-003 知識庫問答的原始內容：專案類型「資料處理」、申請模型 Qwen2.5-72B-Instruct、Domain knowledge.company.gov.tw、來源 IP 10.20.52.0/24、最大／平均使用人數 40／15、使用目的「建立部門知識庫摘要與問答。」；右下為「清除」與「重新送出申請」。",
    actions: [
      { label: "修改專案資訊、模型、Domain／來源 IP、使用人數或使用目的", destination: null },
      { label: "點「清除」清空表單欄位", destination: null },
      {
        label: "點「重新送出申請」把案件改回待審核（寫入動作，僅記錄未執行）",
        destination: to("SSO｜算力申請與審核｜申請者｜進度追蹤"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力申請與審核｜管理者｜審核",
    purpose: "管理者集中檢視所有申請案件並進入個別案件的審核或詳細資料。",
    content:
      "「申請案件」面板，說明特殊模型申請核准後會由管理者從模型服務列表自由分配模型；上方四個篩選條件（案件名稱或編號、申請模型、申請者、狀態）與「搜尋」「清除」；下方表格共 4 筆，列出案件名稱與編號、申請模型、申請者、狀態（已開通／待審核／未通過）與操作按鈕（待審核為「審核」，其餘為「查看」）。",
    actions: [
      { label: "輸入案件、模型、申請者或狀態條件後點「搜尋」篩選清單", destination: null },
      { label: "點「清除」重置篩選條件", destination: null },
      {
        label: "點待審核案件的「審核」開啟模型服務審核彈窗",
        destination: to("SSO｜算力申請與審核｜管理者｜審核｜模型服務審核"),
      },
      {
        label: "點已開通或未通過案件的「查看」開啟模型服務詳細資料彈窗",
        destination: to("SSO｜算力申請與審核｜管理者｜審核｜模型服務詳細資料"),
      },
      ...applyTabs("SSO｜算力申請與審核｜管理者｜審核"),
      ...ssoNav(NAV_APPLY),
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力申請與審核｜管理者｜審核｜模型服務審核",
    purpose: "管理者核定一筆待審核案件的用量上限、有效期與安全監控項目，並決定開通或退回。",
    content:
      "「模型服務審核」彈窗：上方唯讀顯示案件資訊（語音辨識服務、Whisper-Large-v3、Domain speech.company.gov.tw、來源 IP、最大／平均使用人數 80／30 人）；可編輯核定 TPM（10000）、核定 RPM（200）、有效期起日與迄日（2026/07/24～2027/07/24）、審核備註；「案件安全監控設定」可個別勾選 PII 個資監控、LLM Guard、Keyword Matching；底部為「未通過」與「核定並開通」。",
    actions: [
      { label: "調整核定 TPM／RPM、有效期起訖與審核備註", destination: null },
      { label: "勾選此案要啟用的 PII 個資監控／LLM Guard／Keyword Matching", destination: null },
      { label: "點「核定並開通」核發 API 端點與 API Key（寫入動作，僅記錄未執行）", destination: null },
      { label: "點「未通過」退回案件並附備註（寫入動作，僅記錄未執行）", destination: null },
      {
        label: "點右上叉關掉彈窗回到審核清單",
        destination: to("SSO｜算力申請與審核｜管理者｜審核"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力申請與審核｜管理者｜審核｜模型服務詳細資料",
    purpose: "檢視已開通案件核發的服務憑證，維護該案的安全監控設定或停用其 API。",
    content:
      "「模型服務詳細資料」彈窗：案件資訊（行政智慧助理、Gemma4:31b、Domain assistant.company.gov.tw、來源 IP、最大／平均使用人數 120／45 人）；「已開通服務憑證」區塊顯示 API 端點與 API Key 及兩個「複製」鈕；「案件安全監控設定」三個勾選項與「儲存設定」；底部為「停用 API 與 API Key」。",
    actions: [
      { label: "勾選或取消此案的安全監控項目", destination: null },
      { label: "點「儲存設定」保存監控設定（寫入動作，僅記錄未執行）", destination: null },
      { label: "點「停用 API 與 API Key」關閉該服務（破壞性動作，僅記錄未執行）", destination: null },
      { label: "點端點或 API Key 旁的「複製」複製憑證（含機敏資訊，僅記錄未執行）", destination: null },
      {
        label: "點右上叉關掉彈窗回到審核清單",
        destination: to("SSO｜算力申請與審核｜管理者｜審核"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載",
    purpose: "以專案為單位管理算力，列出所有專案的資源配額與使用狀況，是新建專案與進入專案維護的入口。",
    content:
      "頁首「新建專案」按鈕與提示「先建立專案，再於專案維護頁面新增任務」；四張專案卡（Pilot Project 領航案、金融風控模型、文本分析系統、醫療影像辨識）顯示狀態（運行中／待命）、CPU／RAM／GPU 用量、管理員信箱、建立時間與任務數，可展開檢視 CPU／RAM 使用率長條並附「維護」按鈕。",
    actions: [
      { label: "展開或收合專案卡片", destination: null },
      { label: "點「新建專案」開啟建立專案彈窗", destination: to("SSO｜算力排程與工作負載｜新建專案") },
      { label: "點專案「維護」進入專案詳情頁", destination: to("SSO｜算力排程與工作負載｜專案詳情") },
      ...ssoNav(NAV_WORKLOAD),
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜新建專案",
    purpose: "以彈窗表單建立新專案並設定資源配額上限，其下模型服務的配置不得超過此上限。",
    content:
      "「新建專案」彈窗上半：專案名稱、專案管理員、狀態（Active，系統自動設定）、建立時間（系統自動抓取）、專案描述，以及「節點資源配額」的 CPU（線程，0.5～128）與 RAM（GB，1～1024）滑桿；下方開始顯示 GPU 配置的 H200 GPU-0～GPU-7 勾選項；底部為「取消」與「建立專案」。",
    actions: [
      { label: "填寫專案名稱／管理員／描述、拖動 CPU 與 RAM 配額滑桿", destination: null },
      { label: "向下捲動彈窗檢視完整 GPU 配置清單", destination: to("SSO｜算力排程與工作負載｜新建專案｜往下") },
      { label: "點「建立專案」送出（寫入動作，僅記錄未執行）", destination: to(NAV_WORKLOAD) },
      { label: "點「取消」或右上叉關掉彈窗", destination: to(NAV_WORKLOAD) },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜新建專案｜往下",
    purpose: "新建專案彈窗捲動後的下半段，選擇這個專案可使用的 GPU 卡。",
    content:
      "同一彈窗捲動後顯示專案描述、節點資源配額（CPU 4 線程／RAM 16 GB）與完整「GPU 配置」：NVIDIA H200 叢集的 GPU-0～GPU-7 與 NVIDIA L40 叢集的 GPU-0～GPU-3 共 12 個勾選項；底部仍為「取消」與「建立專案」。",
    actions: [
      { label: "勾選要分配給此專案的 H200／L40 GPU 卡", destination: null },
      { label: "向上捲回填寫專案基本資訊", destination: to("SSO｜算力排程與工作負載｜新建專案") },
      { label: "點「建立專案」送出（寫入動作，僅記錄未執行）", destination: to(NAV_WORKLOAD) },
      { label: "點「取消」或右上叉關掉彈窗", destination: to(NAV_WORKLOAD) },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜專案詳情",
    purpose: "單一專案的維護頁，檢視專案資訊與節點配置，並管理其下的模型服務。",
    content:
      "麵包屑「返回工作負載 › Pilot Project 領航案 › 運行中」；「專案資訊」卡（名稱、狀態、管理員 pilot-admin@company.com、建立時間、描述）與「資源使用」卡（CPU 16/32 線程、RAM 128/256 GB）；「節點配置」區塊顯示 CPU 配額 32 線程、RAM 配額 256 GB 與 H200 GPU-0～GPU-3 的顯存占用，右上有「編輯資源」；「模型服務列表」表格列出 Gemma4:31b（大語言模型、推論服務、16 線／128 GB／2 張 GPU、運行中、開始時間 14:32）與「維護」按鈕，右上為「建立模型服務」。",
    actions: [
      {
        label: "點「編輯資源」開啟節點配置彈窗",
        destination: to("SSO｜算力排程與工作負載｜專案詳情｜編輯節點配置"),
      },
      {
        label: "點「建立模型服務」開啟建立表單",
        destination: to("SSO｜算力排程與工作負載｜專案詳情｜建立模型服務"),
      },
      {
        label: "點模型服務列「維護」進入模型服務詳情",
        destination: to("SSO｜算力排程與工作負載｜模型服務詳情｜資訊"),
      },
      { label: "點「返回工作負載」回到專案列表", destination: to(NAV_WORKLOAD) },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜專案詳情｜編輯節點配置",
    purpose: "調整此專案可使用的 CPU 與 RAM 資源上限。",
    content:
      "「編輯節點配置」彈窗：CPU 配額滑桿（32 線程）、RAM 配額滑桿（256 GB），提示「GPU 配置會依模型服務配置與專案配額顯示於本頁」；底部為「取消」與「儲存配置」。",
    actions: [
      { label: "拖動 CPU 與 RAM 配額滑桿", destination: null },
      { label: "點「儲存配置」套用新配額（寫入動作，僅記錄未執行）", destination: null },
      {
        label: "點「取消」或右上叉關掉彈窗",
        destination: to("SSO｜算力排程與工作負載｜專案詳情"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務",
    purpose: "在專案配額內部署一個新的模型服務，第一段填寫服務識別、模型來源與存取設定。",
    content:
      "「建立模型服務」彈窗（標頭顯示專案 Pilot Project 領航案與 CPU 剩餘 16 線程／RAM 剩餘 128 GB）：模型服務名稱與描述（必填）、模型來源二選一（現有模型／新環境，預設現有模型並提供搜尋模型名稱與標籤）、可新增多組的「連接埠配置」（內部／外部連接埠）、可新增多筆的「掛載磁碟區」（附覆蓋風險提醒）與磁碟大小滑桿；底部為「取消」與「建立模型服務」。",
    actions: [
      { label: "填寫模型服務名稱與描述、搜尋並選定現有模型與標籤", destination: null },
      {
        label: "切到「新環境」改用自帶 Docker 映像",
        destination: to("SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜新環境"),
      },
      { label: "點連接埠或掛載磁碟區的「新增」增列一組設定、或按叉移除", destination: null },
      {
        label: "向下捲動填寫節點配置與 GPU",
        destination: to("SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜往下"),
      },
      { label: "點「建立模型服務」送出（寫入動作，僅記錄未執行）", destination: null },
      {
        label: "點「取消」或右上叉關掉彈窗",
        destination: to("SSO｜算力排程與工作負載｜專案詳情"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜往下",
    purpose: "建立模型服務彈窗的中段，配置這個服務要占用的節點資源與 GPU。",
    content:
      "捲動後顯示「節點配置」：CPU 滑桿（0.5～16 線程，須為 0.5 的倍數，上限為專案配額）、RAM 滑桿（1～128 GB）、「臨時儲存空間」開關（容器重啟後資料將清除），以及 GPU 區塊——H200 GPU-0／GPU-1 標示「已滿載」不可勾選，GPU-2／GPU-3 顯示「可用 141 GiB」可勾選；下方露出「模型效能與進階配置」區塊標題。",
    actions: [
      { label: "拖動 CPU／RAM 滑桿、切換臨時儲存空間開關", destination: null },
      { label: "勾選可用的 GPU 卡（已滿載者無法選取）", destination: null },
      {
        label: "繼續向下捲到推論參數與送出區",
        destination: to("SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜底部"),
      },
      {
        label: "向上捲回填寫服務名稱與模型來源",
        destination: to("SSO｜算力排程與工作負載｜專案詳情｜建立模型服務"),
      },
      {
        label: "點「取消」或右上叉關掉彈窗",
        destination: to("SSO｜算力排程與工作負載｜專案詳情"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜底部",
    purpose: "建立模型服務彈窗的最後一段，由管理者設定推論行為與擴展策略後送出。",
    content:
      "捲到底顯示「模型效能與進階配置」：Temperature 滑桿（0.7）、Max Tokens（4096）、Context Window（32K 下拉），以及「是否啟用自動擴展」（未勾）與「是否啟用詳細日誌」（已勾）兩個核取方塊；上方仍可見 CPU／RAM 滑桿與 GPU 勾選區，底部為「取消」與「建立模型服務」。",
    actions: [
      { label: "調整 Temperature、Max Tokens 與 Context Window", destination: null },
      { label: "勾選是否啟用自動擴展與詳細日誌", destination: null },
      { label: "點「建立模型服務」送出（寫入動作，僅記錄未執行）", destination: null },
      {
        label: "點「取消」或右上叉關掉彈窗",
        destination: to("SSO｜算力排程與工作負載｜專案詳情"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜新環境",
    purpose: "建立模型服務時改以自帶 Docker 映像部署，而非選用模型倉庫的既有模型。",
    content:
      "同一彈窗把模型來源切到「新環境」後，原本的搜尋模型名稱／標籤欄位改為「輸入 Docker 映像」（例如 tensorflow/tensorflow）與「輸入 Docker 標籤」（例如 nightly-jupyter）；其餘連接埠配置、掛載磁碟區與磁碟大小欄位不變。",
    actions: [
      { label: "輸入 Docker 映像與標籤", destination: null },
      {
        label: "切回「現有模型」改選模型倉庫的既有模型",
        destination: to("SSO｜算力排程與工作負載｜專案詳情｜建立模型服務"),
      },
      {
        label: "向下捲動填寫節點配置與 GPU",
        destination: to("SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜往下"),
      },
      {
        label: "點「取消」或右上叉關掉彈窗",
        destination: to("SSO｜算力排程與工作負載｜專案詳情"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜模型服務詳情｜資訊",
    purpose: "模型服務詳情的預設分頁，用終端機操作容器並把程式碼封裝為新的模型版本。",
    content:
      "麵包屑「返回專案 › Pilot Project 領航案 › Gemma4:31b › 運行中」與六個分頁（資訊／資源／API監控／設定／日誌／描述）；左側為 bash 終端機視窗，提示可輸入程式碼並點「提交」封裝為新模型版本，底部有指令輸入列；右側「模型資訊」卡（模型名稱 LLaMA 3、模型標籤 v1.0、模型描述）附「提交」與「取消」，下方「連接埠／磁碟區」卡列出內部 8888→外部 30888、6006→30606 與掛載點 /workspace/data、/models/output。",
    actions: [
      { label: "在終端機輸入指令操作容器", destination: null },
      { label: "填寫模型名稱／標籤／描述後點「提交」封裝新版本（寫入動作，僅記錄未執行）", destination: null },
      { label: "點「取消」清除模型資訊表單", destination: null },
      ...serviceTabs("資訊"),
      { label: "點「返回專案」回到專案詳情", destination: to("SSO｜算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜模型服務詳情｜資源",
    purpose: "監看此模型服務容器層級的 CPU、記憶體與 I/O 即時指標。",
    content:
      "九張時間序列圖卡，各附當前值：CPU 利用率（73.6%）、CPU 使用量（13325.3m）、RAM 使用量限制內已用（71.9%）、RAM 使用量已用記憶體（85972.0 MiB）、記憶體頁面錯誤（8.2/s）、記憶體使用量（78478.3 MiB）、回寫記憶體（222.0 KiB）、I/O 操作節流服務 OPS（48.2 OPS）與 I/O 吞吐量節流 I/O 頻寬（1032.9 KiB/s）。",
    actions: [
      ...serviceTabs("資源"),
      { label: "點「返回專案」回到專案詳情", destination: to("SSO｜算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜模型服務詳情｜API監控",
    purpose: "監看此模型服務對外 API 閘道的流量、延遲與錯誤，並管理已開放 API Key 的專案。",
    content:
      "「統一 API 閘道監控」標示服務正常，顯示服務端點、推論引擎 vLLM Engine、P95 延遲與錯誤率；四張圖表：Input Tokens／分鐘（8316.5）、Output Tokens／分鐘（2705.4）、P95 API 延遲（241.7 ms）、API 錯誤率（0.3%）；下方「已開放 API Key 的專案列表」表格列出 A2026-001 行政智慧助理與 A2026-006 知識庫語意檢索服務的 API Key、TPM／RPM 使用量、狀態（已啟用）與「停用」按鈕。",
    actions: [
      { label: "點專案列「停用」關閉該 API Key（破壞性動作，僅記錄未執行）", destination: null },
      ...serviceTabs("API監控"),
      { label: "點「返回專案」回到專案詳情", destination: to("SSO｜算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜模型服務詳情｜設定",
    purpose: "維運此模型服務：改名稱與描述、啟停服務、調整資源與推論參數，或刪除整個模型。",
    content:
      "任務名稱 Gemma4:31b 與任務描述「大語言模型」各附「編輯」；狀態列為運行中並有「啟動」（停用中）、「重新啟動」、「停止」；唯讀的模型名稱 LLaMA 3、模型標籤 v1.0、任務擁有者與建立時間；「資源配置」卡顯示節點 gpu-node-01、CPU 16 線程、RAM 128 GB 與 GPU H200-0／H200-1，右上「變更分配」；「模型效能與進階配置」卡含 Temperature 0.7、Max Tokens 4096、Context Window 32K 與兩個核取方塊，右上「儲存配置」；頁尾紅色「刪除模型」區塊警告此操作無法復原。",
    actions: [
      { label: "點任務名稱或描述旁的「編輯」修改欄位（寫入動作，僅記錄未執行）", destination: null },
      { label: "點「重新啟動」或「停止」改變服務狀態（破壞性動作，僅記錄未執行）", destination: null },
      {
        label: "點「變更分配」開啟資源分配彈窗",
        destination: to("SSO｜算力排程與工作負載｜模型服務詳情｜設定｜變更資源分配"),
      },
      { label: "調整推論參數後點「儲存配置」（寫入動作，僅記錄未執行）", destination: null },
      {
        label: "點「刪除模型」開啟刪除確認彈窗",
        destination: to("SSO｜算力排程與工作負載｜模型服務詳情｜設定｜確認刪除模型"),
      },
      ...serviceTabs("設定"),
      { label: "點「返回專案」回到專案詳情", destination: to("SSO｜算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜模型服務詳情｜設定｜變更資源分配",
    purpose: "調整這個模型服務占用的 CPU 與 RAM。",
    content: "「變更資源分配」彈窗：CPU（線程）滑桿顯示 16、RAM（GB）滑桿顯示 128 GB；底部為「取消」與「儲存」。",
    actions: [
      { label: "拖動 CPU 與 RAM 滑桿", destination: null },
      { label: "點「儲存」套用新配置（寫入動作，僅記錄未執行）", destination: null },
      {
        label: "點「取消」關掉彈窗回到設定分頁",
        destination: to("SSO｜算力排程與工作負載｜模型服務詳情｜設定"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜模型服務詳情｜設定｜確認刪除模型",
    purpose: "刪除模型前的二次確認，避免誤刪整個模型服務與其相關資料。",
    content:
      "「確認刪除模型」警示彈窗，副標「此操作無法復原」，內文「確定要刪除模型「Gemma4:31b」嗎？所有相關資料將一併移除。」；底部為「取消」與紅色「確認刪除」。",
    actions: [
      { label: "點「確認刪除」永久移除模型（破壞性動作，僅記錄未執行）", destination: null },
      {
        label: "點「取消」放棄刪除回到設定分頁",
        destination: to("SSO｜算力排程與工作負載｜模型服務詳情｜設定"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜模型服務詳情｜日誌",
    purpose: "檢視此模型服務容器的執行日誌，追查訓練進度與異常。",
    content:
      "整頁 bash 樣式的日誌視窗，依時間列出 INFO／WARN 訊息：任務啟動、容器初始化完成、GPU H200-0 與 H200-1 已掛載、模型載入、訓練迴圈各 epoch 的 loss 與 acc、記憶體使用率 87% 接近警戒值的 WARN、checkpoint 儲存路徑，以及最新的 batch 進度與 GPU 利用率。",
    actions: [
      ...serviceTabs("日誌"),
      { label: "點「返回專案」回到專案詳情", destination: to("SSO｜算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "SSO｜算力排程與工作負載｜模型服務詳情｜描述",
    purpose: "以 kubectl describe 風格檢視此服務底層 Pod 的規格與事件。",
    content:
      "終端機視窗列出 IP、Start Time、Status（Running）、Restart Count、Labels（app／project／job-type）、Resource Requests（cpu 16000m、memory 128Gi、nvidia.com/gpu 2）、Volumes（/workspace ReadWriteMany、/models ReadWriteOnce）與 Events（Scheduled、Pulling、Pulled、Created、Started）。",
    actions: [
      { label: "捲動終端機檢視完整規格與事件", destination: null },
      ...serviceTabs("描述"),
      { label: "點「返回專案」回到專案詳情", destination: to("SSO｜算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "SSO｜安全監控",
    purpose: "總覽三項輸入／輸出標記監控的啟用狀態與成效，協助管理模型服務的安全風險。",
    content:
      "頁首標示「三項監控服務正常運作」；三張啟用中的監控卡——PII 個資監控（輸入標記成效 0.35%／已檢查 18,240／已標記 63，輸出 0.12%）、LLM Guard（偵測提示注入、越獄與不安全模型行為，輸入 0.20%／輸出 0.09%）、Keyword Matching（依自訂攔截關鍵字比對，輸入 0.26%／輸出 0.08%，附「編輯攔截關鍵字」按鈕）；下方「標記成效說明」解釋輸入標記在請求送往模型前檢查、輸出標記在回覆送回使用者前檢查。",
    actions: [
      {
        label: "點「編輯攔截關鍵字」開啟關鍵字維護彈窗",
        destination: to("SSO｜安全監控｜編輯攔截關鍵字"),
      },
      ...ssoNav(NAV_SECURITY),
    ],
  },
  {
    route: "/",
    tab: "SSO｜安全監控｜編輯攔截關鍵字",
    purpose: "維護 Keyword Matching 用來比對輸入與輸出內容的自訂攔截字詞清單。",
    content:
      "「編輯攔截關鍵字」彈窗，說明 Keyword Matching 將針對輸入與輸出內容進行比對；上方為關鍵字輸入框與「新增」按鈕，下方為現有關鍵字標籤（機密文件、身分證字號、內部專案代碼、未公開財報、API Secret），每個標籤附刪除圖示；右下為「完成」。",
    actions: [
      { label: "輸入關鍵字後點「新增」加入清單（寫入動作，僅記錄未執行）", destination: null },
      { label: "點關鍵字標籤上的垃圾桶移除該字詞（破壞性動作，僅記錄未執行）", destination: null },
      { label: "點「完成」或右上叉關掉彈窗", destination: to(NAV_SECURITY) },
    ],
  },
  {
    route: "/",
    tab: "SSO｜追蹤日誌",
    purpose: "以 Langfuse 追蹤檢視每一筆模型請求的處理結果與安全標記狀態。",
    content:
      "上方時間區間切換（今／昨／本月／本季／本年／自訂日期）與右上「管理報表」「匯出報表」；四張統計卡（總請求數 1,247、成功 1,221、已攔截 26、平均延遲 397ms）；「追蹤日誌 (Langfuse Traces)」表格列出 trace-001～trace-006 的時間、Trace ID、案件（含案號）、模型、Tokens 與輸入／輸出狀態（安全／已攔截）。",
    actions: [
      { label: "切換今／昨／本月／本季／本年或自訂日期篩選追蹤", destination: null },
      { label: "點某筆 Trace ID 展開右側追蹤詳情", destination: to("SSO｜追蹤日誌｜追蹤詳情") },
      { label: "點「管理報表」開啟管理報表彈窗", destination: to("SSO｜追蹤日誌｜管理報表｜系統運作") },
      { label: "點「匯出報表」下載報表（下載動作，僅記錄未執行）", destination: null },
      ...ssoNav(NAV_TRACE),
    ],
  },
  {
    route: "/",
    tab: "SSO｜追蹤日誌｜追蹤詳情",
    purpose: "鑽入單筆追蹤，檢視該次請求的輸入輸出、各階段耗時與模型用量。",
    content:
      "右側「攔截詳情 (Trace Details)」抽屜，標示 trace-001 與關聯算力申請案件（行政智慧助理 A2026-001）；INPUT「查詢客戶資料庫中的訂單記錄」與 OUTPUT「已找到 15 筆符合條件的訂單記錄」；TRACE WATERFALL 五個階段（User Input 12ms、Guardrail Check 45ms、LLM Call 234ms、Output Guardrail 28ms、Final Response 8ms）；METADATA 顯示模型 Llama-3.3-Nemotron、Tokens 123、Latency 234ms、Cost $0.023。",
    actions: [
      { label: "點右上叉關掉抽屜回到追蹤清單", destination: to(NAV_TRACE) },
    ],
  },
  {
    route: "/",
    tab: "SSO｜追蹤日誌｜管理報表｜系統運作",
    purpose: "管理報表的第一個分頁，檢視系統層級的查詢效能、資源監控與異常事件。",
    content:
      "「追蹤日誌管理報表」彈窗，含自身的時間區間切換（目前為本月）與「匯出報表」，以及三個分頁（系統運作／系統成效／依賴狀況）；系統運作分頁分三欄表格——系統運作（每日查詢數 312ms、最大查詢數 923ms、平均查詢比率 89.5%、平均查詢大小 218ms、P95 延遲 487ms 與門檻值和狀態）、資源監控（CPU／GPU 使用率、A100 GPU 使用率、系統負載，其中相關指標 GPU 使用率 72.15 為警告）、異常狀態（GPU_UTIL、儲存警告、儲存空間、記憶體、異常流量的發生次數與應對序數）。",
    actions: [
      { label: "切換報表時間區間（今／昨／本月／本季／本年／自訂日期）", destination: null },
      { label: "切到「系統成效」分頁", destination: to("SSO｜追蹤日誌｜管理報表｜系統成效") },
      { label: "切到「依賴狀況」分頁", destination: to("SSO｜追蹤日誌｜管理報表｜依賴狀況") },
      { label: "點「匯出報表」下載報表（下載動作，僅記錄未執行）", destination: null },
      { label: "點右上叉關掉報表彈窗", destination: to(NAV_TRACE) },
    ],
  },
  {
    route: "/",
    tab: "SSO｜追蹤日誌｜管理報表｜系統成效",
    purpose: "管理報表的第二個分頁，以指標卡呈現模型回應品質與治理成效。",
    content:
      "六張指標卡：平均回應品質 92.4%、幻覺偵測率 7.8%、毒性攔截數 26、PII 攔截率 100%、正向回饋比率 84.3%、P95 延遲 487ms；上方仍為時間區間切換與「匯出報表」。",
    actions: [
      { label: "切換報表時間區間", destination: null },
      { label: "切到「系統運作」分頁", destination: to("SSO｜追蹤日誌｜管理報表｜系統運作") },
      { label: "切到「依賴狀況」分頁", destination: to("SSO｜追蹤日誌｜管理報表｜依賴狀況") },
      { label: "點「匯出報表」下載報表（下載動作，僅記錄未執行）", destination: null },
      { label: "點右上叉關掉報表彈窗", destination: to(NAV_TRACE) },
    ],
  },
  {
    route: "/",
    tab: "SSO｜追蹤日誌｜管理報表｜依賴狀況",
    purpose: "管理報表的第三個分頁，檢視平台各依賴服務的健康度。",
    content:
      "表格列出 Langfuse API（正常、23ms、99.98%）、Vector Store（正常、8ms、100%）、Model Registry（正常、41ms、99.95%）、GPU Scheduler（警告、312ms、97.2%）、Object Storage（正常、15ms、100%）的狀態、延遲與可用率。",
    actions: [
      { label: "切換報表時間區間", destination: null },
      { label: "切到「系統運作」分頁", destination: to("SSO｜追蹤日誌｜管理報表｜系統運作") },
      { label: "切到「系統成效」分頁", destination: to("SSO｜追蹤日誌｜管理報表｜系統成效") },
      { label: "點「匯出報表」下載報表（下載動作，僅記錄未執行）", destination: null },
      { label: "點右上叉關掉報表彈窗", destination: to(NAV_TRACE) },
    ],
  },
  {
    route: "/",
    tab: "SSO｜帳號與權限管理｜介接公務系統",
    purpose: "檢視由公務系統同步而來的唯讀帳號及其平台角色。",
    content:
      "四張統計卡（總帳號數 10／公務 7・自管 3、作用中 8／已停用 2、管理者 2、專案申請者 3）；兩個分頁「介接公務系統 7」與「系統自管帳號 3」，右側標示最後同步 2026-07-09 06:00（唯讀）；表格列出七名公務帳號的使用者名稱、電子郵件、部門、角色（管理者／專案申請者／一般使用者）、帳號來源、狀態與最後登入，操作欄的編輯與刪除圖示為灰階不可用。",
    actions: [
      { label: "在搜尋框輸入使用者名稱、部門或郵件過濾清單", destination: null },
      { label: "切到「系統自管帳號」分頁", destination: to("SSO｜帳號與權限管理｜系統自管帳號") },
      ...ssoNav(NAV_ACCOUNT),
    ],
  },
  {
    route: "/",
    tab: "SSO｜帳號與權限管理｜系統自管帳號",
    purpose: "管理平台自建的帳號，可新增、編輯或刪除。",
    content:
      "同樣的四張統計卡與分頁列，右上多了「新增使用者」；表格列出 admin_sys（平台維運、管理者、啟用中）、contractor_01（外包廠商 A、一般使用者、啟用中）、test_user_beta（測試帳號、一般使用者、已停用）三筆自管帳號，操作欄有可用的編輯與刪除圖示。",
    actions: [
      { label: "在搜尋框輸入使用者名稱、部門或郵件過濾清單", destination: null },
      {
        label: "點「新增使用者」開啟新增自管使用者彈窗",
        destination: to("SSO｜帳號與權限管理｜系統自管帳號｜新增使用者"),
      },
      {
        label: "點帳號列的鉛筆圖示開啟編輯帳號資訊彈窗",
        destination: to("SSO｜帳號與權限管理｜系統自管帳號｜編輯帳號資訊"),
      },
      { label: "點帳號列的垃圾桶圖示刪除帳號（破壞性動作且無二次確認，僅記錄未執行）", destination: null },
      { label: "切到「介接公務系統」分頁", destination: to(NAV_ACCOUNT) },
      ...ssoNav(NAV_ACCOUNT),
    ],
  },
  {
    route: "/",
    tab: "SSO｜帳號與權限管理｜系統自管帳號｜新增使用者",
    purpose: "建立一個平台自管帳號並指定其角色。",
    content:
      "「新增自管使用者」彈窗：使用者名稱（必填）、電子郵件（必填）、所屬部門、角色下拉（預設一般使用者）；底部為「取消」與「確認新增」（必填欄位未填時為停用狀態）。",
    actions: [
      { label: "填寫使用者名稱、電子郵件、所屬部門並選擇角色", destination: null },
      {
        label: "點「確認新增」建立帳號（寫入動作，僅記錄未執行）",
        destination: to("SSO｜帳號與權限管理｜系統自管帳號"),
      },
      {
        label: "點「取消」或右上叉關掉彈窗",
        destination: to("SSO｜帳號與權限管理｜系統自管帳號"),
      },
    ],
  },
  {
    route: "/",
    tab: "SSO｜帳號與權限管理｜系統自管帳號｜編輯帳號資訊",
    purpose: "修改既有自管帳號的基本資料與角色。",
    content:
      "「編輯帳號資訊」彈窗，帶入 admin_sys 的現有值：使用者名稱 admin_sys、電子郵件 admin@aiplatform.tw、所屬部門「平台維運」、角色「管理者」；底部為「取消」與「儲存變更」。",
    actions: [
      { label: "修改使用者名稱、電子郵件、部門或角色", destination: null },
      {
        label: "點「儲存變更」更新帳號（寫入動作，僅記錄未執行）",
        destination: to("SSO｜帳號與權限管理｜系統自管帳號"),
      },
      {
        label: "點「取消」或右上叉關掉彈窗",
        destination: to("SSO｜帳號與權限管理｜系統自管帳號"),
      },
    ],
  },
  {
    route: "/",
    tab: "一般登入｜算力申請與審核｜申請者｜提出申請",
    purpose: "一般登入身分的落地頁，供外部申請者提出模型服務申請；此身分看不到其他模組。",
    content:
      "側欄只剩「算力管理｜算力申請與審核」一項，分頁列也只有「申請者｜提出申請」與「申請者｜進度追蹤」（無管理者審核）；主區為與 SSO 相同的「提出模型服務申請」表單：專案名稱、專案類型、申請模型、Domain Name、來源 IP、最大／平均使用人數與使用目的，右下為「清除」與「送出申請」。",
    actions: [
      { label: "填寫申請表單各欄位", destination: null },
      { label: "點「清除」清空表單欄位", destination: null },
      {
        label: "點「送出申請」建立待審核案件（寫入動作，僅記錄未執行）",
        destination: to("一般登入｜算力申請與審核｜申請者｜進度追蹤"),
      },
      {
        label: "切到「申請者｜進度追蹤」分頁",
        destination: to("一般登入｜算力申請與審核｜申請者｜進度追蹤"),
      },
      { label: "點右上「登出」回到登入頁", destination: to("登入") },
    ],
  },
  {
    route: "/",
    tab: "一般登入｜算力申請與審核｜申請者｜進度追蹤",
    purpose: "一般登入身分追蹤自己案件的處理進度並取得已核定的 API 憑證。",
    content:
      "側欄與分頁列同樣只保留算力申請與審核的兩個申請者分頁；案件卡片內容與 SSO 身分一致：A2026-001 行政智慧助理（已開通，附端點、API Key 與核定用量）、A2026-002 語音辨識服務（待審核）、A2026-003 知識庫問答（未通過並附退件說明）、A2026-006 知識庫語意檢索服務（已開通），依狀態顯示查看／停用／編輯申請／取消申請按鈕。",
    actions: [
      { label: "點案件「查看」開啟申請案件內容彈窗（內容與 SSO 身分相同）", destination: null },
      { label: "點未通過案件的「編輯申請」載入原內容重新編輯（表單與 SSO 身分相同）", destination: null },
      { label: "點「取消申請」撤回案件（破壞性動作，僅記錄未執行）", destination: null },
      { label: "點已開通案件的「停用」關閉該服務（破壞性動作，僅記錄未執行）", destination: null },
      { label: "點端點或 API Key 旁的「複製」複製憑證（含機敏資訊，僅記錄未執行）", destination: null },
      {
        label: "切到「申請者｜提出申請」分頁",
        destination: to("一般登入｜算力申請與審核｜申請者｜提出申請"),
      },
      { label: "點右上「登出」回到登入頁", destination: to("登入") },
    ],
  },
];

describe("f2w-describe", () => {
  it("組裝 workflow.json：逐頁描述涵蓋所有截到的 Page 且操作去向皆有效", () => {
    const pages = loadCapturedPages(OUTPUT_ROOT, PROJECT);
    expect(DESCRIPTIONS).toHaveLength(pages.pages.length);

    const workflow = buildWorkflow(pages, OVERVIEW, DESCRIPTIONS);
    expect(workflow.pages).toHaveLength(pages.pages.length);

    saveWorkflow(OUTPUT_ROOT, PROJECT, workflow);
  });
});
