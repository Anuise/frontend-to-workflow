import { describe, expect, it } from "vitest";
import { type PageDescription, buildWorkflow, loadCapturedPages, saveWorkflow } from "../src/describe";

const OUTPUT_ROOT = "output";
const PROJECT = "0729_AI六大模組管理平台_5E_AI平台最新版";

/** Page 識別捷徑：整站路由恆為 "/"，只用 tab 區分狀態。 */
const to = (tab: string) => ({ route: "/", tab });

// 側欄的導覽去向（模組首頁／首個分頁）
const NAV_MODEL = "模型倉庫";
const NAV_CLUSTER = "叢集資源總覽";
const NAV_WORKLOAD = "算力排程與工作負載";
const NAV_AGENT = "代理人治理";
const NAV_SECURITY = "安全監控";
const NAV_HITL = "人機協作";
const NAV_TRACE = "追蹤日誌";
const NAV_ACCOUNT = "帳號權限設定｜介接公務系統";
const NAV_SETTINGS = "系統設定";

/** 各模組頁共用的側欄導覽操作（系統管理群組內含帳號權限設定與系統設定）。 */
const sideNav = (self: string) =>
  [
    { label: "由側欄前往「模型倉庫」", destination: to(NAV_MODEL) },
    { label: "由側欄前往「叢集資源總覽」", destination: to(NAV_CLUSTER) },
    { label: "由側欄前往「算力排程與工作負載」", destination: to(NAV_WORKLOAD) },
    { label: "由側欄前往「代理人治理」", destination: to(NAV_AGENT) },
    { label: "由側欄前往「安全監控」", destination: to(NAV_SECURITY) },
    { label: "由側欄前往「人機協作」", destination: to(NAV_HITL) },
    { label: "由側欄前往「追蹤日誌」", destination: to(NAV_TRACE) },
    { label: "展開側欄「系統管理」前往「帳號權限設定」", destination: to(NAV_ACCOUNT) },
    { label: "展開側欄「系統管理」前往「系統設定」", destination: to(NAV_SETTINGS) },
  ].filter((a) => a.destination.tab !== self);

/** 算力排程「服務維護」的五個分頁。 */
const serviceTabs = (self: string) =>
  ["資訊", "資源", "設定", "日誌", "描述"]
    .filter((name) => name !== self)
    .map((name) => ({
      label: `切到「${name}」分頁`,
      destination: to(`算力排程與工作負載｜服務維護｜${name}`),
    }));

/** 代理人治理「服務維護」的三個分頁。 */
const agentTabs = (self: string) =>
  ["資料流水線", "流程管理", "版本／資料治理／部署歷程"]
    .filter((name) => name !== self)
    .map((name) => ({
      label: `切到「${name}」分頁`,
      destination: to(`代理人治理｜服務維護｜${name}`),
    }));

const OVERVIEW =
  "本平台為單頁式「AI Platform 開發管理中控平台」（5E AI 平台版），整站路由恆為 \"/\"，所有模組與其下狀態皆以 JS 切換，非 <a> 導覽；無登入頁，開站即落在代理人治理。" +
  "左側側欄分為七大模組：模型倉庫、算力管理（叢集資源總覽、算力排程與工作負載）、代理人治理、安全監控、人機協作、追蹤日誌，以及系統管理群組（帳號權限設定、系統設定）。" +
  "核心使用流程有五條主線：（1）模型供給——於「模型倉庫」檢視已註冊模型清單並可上傳新模型；" +
  "（2）算力供給與部署——於「叢集資源總覽」監看四座 NVIDIA B300 叢集的即時／歷史資源水位與 Kubernetes 專案隔離，於「算力排程與工作負載」新建專案、進入專案詳情在配額內新增模型服務（現有模型或新環境、選節點與 GPU），並由服務維護的資訊／資源／設定／日誌／描述五個分頁維運，含變更資源分配、啟停與刪除任務、TPM／RPM 用量限制；" +
  "（3）代理人治理——以專案為單位總覽 agent／model 服務的資源與 TPM／RPM 用量，可新增代理人服務、調整用量限制，並鑽入服務維護檢視資料流水線（文件來源與 Apache AGE 知識圖譜）、流程管理紀錄與版本／資料治理／部署歷程；" +
  "（4）安全治理與觀測——「安全監控」針對 Llama 4 Scout／GPT-4.1 等模型設定 PII、LLM Guard、Keyword Matching 三類防護的監控／攔截模式與攔截關鍵字並查看標記成效，「追蹤日誌」列出 Langfuse 追蹤（可開追蹤詳情與 AI 品質自動評估）與系統日誌；" +
  "（5）人工覆核——「人機協作」以審核佇列逐筆覆核使用者倒讚的 AI 回覆，可修改回覆內容並在未修改／已修改佇列間切換。" +
  "「帳號權限設定」分為唯讀同步的介接公務系統帳號與可新增、編輯的系統自管帳號；「系統設定」管理平台基礎參數、通知告警與角色權限。" +
  "整個系統為純前端原型，資料為 in-memory 假資料，送出、新增、編輯、刪除等寫入僅在前端即時生效。";

const DESCRIPTIONS: PageDescription[] = [
  {
    route: "/",
    tab: "模型倉庫",
    purpose: "模型註冊中心，總覽平台目前可用的模型版本與供應商，並作為上傳新模型的入口。",
    content:
      "「模型註冊中心」表格列出 Llama 3.3 70B、Llama-3.3-Nemotron、GPT-oss-120B、Gemma 3 27B 四個模型的類型（LLM／VLM）、版本、狀態（Active）、供應商（vLLM／Azure OpenAI／AWS Bedrock／HuggingFace）與 Context 長度，每列附「下載」按鈕；右上為「上傳模型」按鈕。",
    actions: [
      { label: "點「上傳模型」開啟上傳面板", destination: to("模型倉庫｜上傳模型") },
      { label: "點模型列「下載」取得模型檔（純前端原型未實際下載）", destination: null },
      ...sideNav(NAV_MODEL),
    ],
  },
  {
    route: "/",
    tab: "模型倉庫｜上傳模型",
    purpose: "以表單把新模型登錄到模型註冊中心，供後續部署選用。",
    content:
      "「上傳模型」面板：模型名稱、版本標籤（例如 v1.0.0）、模型描述，與「拖曳或點擊上傳模型檔案」的檔案區；底部為「取消」與「確認上傳」（未選檔前停用）。",
    actions: [
      { label: "填寫名稱／版本標籤／描述、拖放或點選模型檔", destination: null },
      { label: "點「確認上傳」送出（純前端即時新增）", destination: to(NAV_MODEL) },
      { label: "點「取消」或右上叉關閉面板", destination: to(NAV_MODEL) },
    ],
  },
  {
    route: "/",
    tab: "叢集資源總覽",
    purpose: "以叢集維度即時監看四座 NVIDIA B300 叢集的負載狀態，是算力管理的儀表板首頁。",
    content:
      "頂部「資料模式」提供「即時」與「歷史資料」切換，標示「即時監控中 — 資料每 30 秒自動更新」；主區為 NVIDIA B300 叢集 #1～#4 四張卡片，各標示高負載／正常／中載等狀態與資源圖表；往下為「專案隔離 (Kubernetes Namespaces)」區塊。",
    actions: [
      { label: "切到「歷史資料」模式查詢過往區間", destination: to("叢集資源總覽｜歷史資料") },
      { label: "往下捲動查看專案隔離 Namespaces", destination: to("叢集資源總覽｜往下") },
      ...sideNav(NAV_CLUSTER),
    ],
  },
  {
    route: "/",
    tab: "叢集資源總覽｜歷史資料",
    purpose: "查詢指定時間區間的叢集歷史資源數據，供事後追溯負載變化。",
    content:
      "「資料模式」切為「歷史資料」，出現日期區間選擇與「查詢」按鈕；下方仍為 B300 叢集 #1～#4 卡片與專案隔離區塊，改呈現查詢區間的數據。",
    actions: [
      { label: "選擇日期區間後點「查詢」載入歷史數據（停留原頁）", destination: null },
      { label: "切回「即時」模式", destination: to(NAV_CLUSTER) },
      ...sideNav(NAV_CLUSTER),
    ],
  },
  {
    route: "/",
    tab: "叢集資源總覽｜往下",
    purpose: "檢視 Kubernetes 專案隔離現況，掌握各專案 namespace 的資源配額與使用量。",
    content:
      "「專案隔離 (Kubernetes Namespaces)」四張卡：anti-fraud-165-ns（165防詐專案）、speech-recognition-ns（語音辨識模型）、document-creation-ns（文書製作模型，待命）、case-analysis-ns（案件分析模型），各列 Pods、CPU、Memory、GPUs（B300 C1～C4）與「配額／已使用」GPU 數。",
    actions: [
      { label: "往上捲動回叢集卡片區", destination: to(NAV_CLUSTER) },
      ...sideNav(NAV_CLUSTER),
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載",
    purpose: "以專案為單位管理算力排程：總覽各專案資源用量並作為新建專案與進入專案維護的入口。",
    content:
      "說明「先建立專案，再於專案維護頁面新增任務」；右上「新建專案」。四張專案卡：165防詐專案（運行中）、語音辨識模型（運行中）、文書製作模型（待命）、案件分析模型（運行中），各列 CPU／RAM／GPU 用量、管理員信箱、建立時間、任務數與「維護」按鈕，卡片下方有 CPU／RAM 使用率條。",
    actions: [
      { label: "點「新建專案」開啟建立專案彈窗", destination: to("算力排程與工作負載｜新建專案") },
      { label: "點專案卡「維護」進入專案詳情", destination: to("算力排程與工作負載｜專案詳情") },
      ...sideNav(NAV_WORKLOAD),
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜新建專案",
    purpose: "建立新的算力專案，設定基本資訊與節點資源配額。",
    content:
      "「新建專案」彈窗：專案名稱（例如 nlp-research-project）、專案管理員信箱、專案描述，以及「節點資源配額」設定區；內容較長可往下捲動，底部為「取消」與「建立專案」。",
    actions: [
      { label: "填寫專案名稱／管理員信箱／描述", destination: null },
      { label: "往下捲動設定節點資源配額", destination: to("算力排程與工作負載｜新建專案｜往下") },
      { label: "點「取消」關閉彈窗", destination: to(NAV_WORKLOAD) },
      { label: "點「建立專案」送出（純前端即時新增）", destination: to(NAV_WORKLOAD) },
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜新建專案｜往下",
    purpose: "完成新建專案彈窗下半部的節點資源配額設定並送出。",
    content:
      "「節點資源配額」區塊：逐節點設定 CPU 線程與 RAM 配額、選擇 GPU 配置；底部為「取消」與「建立專案」按鈕。",
    actions: [
      { label: "設定各節點 CPU／RAM 配額與 GPU 配置", destination: null },
      { label: "點「建立專案」送出（純前端即時新增）", destination: to(NAV_WORKLOAD) },
      { label: "點「取消」關閉彈窗", destination: to(NAV_WORKLOAD) },
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜專案詳情",
    purpose: "單一專案的維護頁：檢視專案資訊、資源使用與節點配置，並管理專案內的模型服務。",
    content:
      "以 165防詐專案為例：頂部「返回工作負載」與專案名稱、運行中標籤；「專案資訊」（名稱、狀態、管理員、建立時間、描述）、「資源使用」（CPU 16/32 線程、RAM 128/256 GB）、「節點配置」（CPU 配額 32 線程、RAM 配額 256 GB）；「模型服務列表」表格列出 Gemma4:31b 等服務的類型、CPU／RAM／GPU、TPM／RPM 用量、狀態與開始時間，每列附「維護」「用量限制」，右上「新增」。",
    actions: [
      { label: "點「返回工作負載」回專案卡列表", destination: to(NAV_WORKLOAD) },
      { label: "點「新增」開啟新增模型服務彈窗", destination: to("算力排程與工作負載｜專案詳情｜新增模型") },
      { label: "點服務列「維護」進入服務維護分頁", destination: to("算力排程與工作負載｜服務維護｜資訊") },
      { label: "點服務列「用量限制」開啟用量限制管理彈窗", destination: to("算力排程與工作負載｜專案詳情｜用量限制") },
      ...sideNav(NAV_WORKLOAD),
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜專案詳情｜新增模型",
    purpose: "在專案配額內新增一個模型服務（任務），設定來源模型、埠、磁碟區與節點資源。",
    content:
      "「新增模型」彈窗：任務名稱（例如 llm-training-task-001）、任務描述；「現有模型」與「新環境」單選（預設現有模型），現有模型模式提供模型與版本下拉；連接埠（內部／外部，例如 8888／30888）可多組新增、掛載磁碟區（例如 /workspace/data）可新增；往下為「節點配置」。",
    actions: [
      { label: "填寫任務名稱／描述、選擇模型與版本、設定連接埠與磁碟區", destination: null },
      { label: "切選「新環境」改用自帶環境模式", destination: to("算力排程與工作負載｜專案詳情｜新增模型｜新環境") },
      { label: "往下捲動設定節點配置與 GPU", destination: to("算力排程與工作負載｜專案詳情｜新增模型｜往下") },
      { label: "點「取消」關閉彈窗", destination: to("算力排程與工作負載｜專案詳情") },
      { label: "點「新增模型」送出（純前端即時新增）", destination: to("算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜專案詳情｜新增模型｜往下",
    purpose: "完成新增模型彈窗下半部的節點配置：挑選節點與可用 GPU 後送出。",
    content:
      "「節點配置 *」區塊：展開節點後以核取方塊選 GPU——B300 C1 GPU-0／GPU-1 標示「已滿載」不可選，GPU-2／GPU-3 標示「可用 288 GiB」可勾選；底部為「取消」與「新增模型」。",
    actions: [
      { label: "勾選可用 GPU（已滿載者停用）", destination: null },
      { label: "點「新增模型」送出（純前端即時新增）", destination: to("算力排程與工作負載｜專案詳情") },
      { label: "點「取消」關閉彈窗", destination: to("算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜專案詳情｜新增模型｜新環境",
    purpose: "以「新環境」模式新增任務：不掛現有模型，改自帶映像／環境設定。",
    content:
      "同一「新增模型」彈窗，「新環境」單選被選取，模型／版本下拉改為新環境對應欄位；其餘任務名稱、描述、連接埠、磁碟區與節點配置區塊相同。",
    actions: [
      { label: "填寫新環境設定與任務欄位", destination: null },
      { label: "切回「現有模型」模式", destination: to("算力排程與工作負載｜專案詳情｜新增模型") },
      { label: "點「新增模型」送出（純前端即時新增）", destination: to("算力排程與工作負載｜專案詳情") },
      { label: "點「取消」關閉彈窗", destination: to("算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜專案詳情｜用量限制",
    purpose: "管理單一模型服務對外的 TPM／RPM 用量上限。",
    content:
      "「用量限制管理」彈窗：API 端點資訊附「複製」鈕；TPM 上限滑桿（現值 50000）與 RPM 上限滑桿（現值 1000）；底部為「取消」與「儲存限制」。",
    actions: [
      { label: "拖動滑桿調整 TPM／RPM 上限", destination: null },
      { label: "點「儲存限制」套用（純前端即時生效）", destination: to("算力排程與工作負載｜專案詳情") },
      { label: "點「取消」或「✕」關閉彈窗", destination: to("算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜服務維護｜資訊",
    purpose: "模型服務維護的主分頁：提供終端機操作與模型版本封裝提交。",
    content:
      "頂部「返回專案」與 165防詐專案／筆錄製作任務／運行中；分頁列（資訊、資源、設定、日誌、描述）。左側為 bash 終端機視窗（提示可輸入指令、點「提交」把程式碼封裝為新模型版本）；右側「模型資訊」（模型名稱 Mistral、模型標籤 v1.0、模型描述、「提交」「取消」）與「連接埠 / 磁碟區」（內部 8888／外部 30888、6006／30606；掛載 /workspace/data、/models/output）。",
    actions: [
      { label: "點「返回專案」回專案詳情", destination: to("算力排程與工作負載｜專案詳情") },
      { label: "在終端機輸入指令（停留原頁）", destination: null },
      { label: "填模型標籤／描述後點「提交」封裝新版本（純前端示意）", destination: null },
      ...serviceTabs("資訊"),
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜服務維護｜資源",
    purpose: "監看此模型服務的資源使用狀況。",
    content: "「資源」分頁：呈現服務的 CPU／RAM／GPU 等資源使用圖表與數值；頂部同為返回專案與五分頁列。",
    actions: [
      { label: "點「返回專案」回專案詳情", destination: to("算力排程與工作負載｜專案詳情") },
      ...serviceTabs("資源"),
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜服務維護｜設定",
    purpose: "維護此任務的名稱、狀態與資源配置，並提供刪除任務的危險操作入口。",
    content:
      "「設定」分頁：任務名稱／任務描述各附「編輯」；狀態（運行中）與「啟動」（停用）「重新啟動」「停止」；模型名稱 Mistral、模型標籤 v1.0、任務擁有者、任務建立時間；「資源配置」（節點 gpu-node-01、CPU 16 線程、RAM 128 GB、GPU B300-1-0／B300-1-1）附「變更分配」；底部紅色「刪除任務」區塊警示操作無法復原。",
    actions: [
      { label: "點「編輯」修改任務名稱／描述（停留原頁）", destination: null },
      { label: "點「重新啟動」或「停止」變更服務狀態（純前端即時生效）", destination: null },
      { label: "點「變更分配」開啟變更資源分配彈窗", destination: to("算力排程與工作負載｜服務維護｜設定｜變更資源分配") },
      { label: "點「刪除任務」開啟確認刪除彈窗", destination: to("算力排程與工作負載｜服務維護｜設定｜確認刪除任務") },
      { label: "點「返回專案」回專案詳情", destination: to("算力排程與工作負載｜專案詳情") },
      ...serviceTabs("設定"),
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜服務維護｜設定｜變更資源分配",
    purpose: "調整此任務占用的節點資源分配。",
    content: "「變更資源分配」彈窗：可調整節點、CPU、RAM 與 GPU 分配；底部為「取消」與「儲存」。",
    actions: [
      { label: "調整資源欄位", destination: null },
      { label: "點「儲存」套用（純前端即時生效）", destination: to("算力排程與工作負載｜服務維護｜設定") },
      { label: "點「取消」關閉彈窗", destination: to("算力排程與工作負載｜服務維護｜設定") },
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜服務維護｜設定｜確認刪除任務",
    purpose: "刪除任務前的二次確認，防止誤刪。",
    content: "「確認刪除任務」彈窗：警示此操作無法復原、將永久移除任務與相關資料；底部為「取消」與紅色「確認刪除」。",
    actions: [
      { label: "點「取消」放棄刪除", destination: to("算力排程與工作負載｜服務維護｜設定") },
      { label: "點「確認刪除」永久移除任務（純前端即時生效）", destination: to("算力排程與工作負載｜專案詳情") },
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜服務維護｜日誌",
    purpose: "檢視此模型服務的執行日誌，供除錯與稽核。",
    content: "「日誌」分頁：滾動列出服務執行期間的日誌訊息，右下角顯示目前時間；頂部同為返回專案與五分頁列。",
    actions: [
      { label: "點「返回專案」回專案詳情", destination: to("算力排程與工作負載｜專案詳情") },
      ...serviceTabs("日誌"),
    ],
  },
  {
    route: "/",
    tab: "算力排程與工作負載｜服務維護｜描述",
    purpose: "檢視此模型服務的說明文件與描述內容。",
    content: "「描述」分頁：呈現服務的文字描述／說明；頂部同為返回專案與五分頁列。",
    actions: [
      { label: "點「返回專案」回專案詳情", destination: to("算力排程與工作負載｜專案詳情") },
      ...serviceTabs("描述"),
    ],
  },
  {
    route: "/",
    tab: "代理人治理",
    purpose: "平台預設首頁：以清單治理全平台的 Agent／模型服務，總覽數量與資源、用量水位。",
    content:
      "「專案篩選」下拉（全部專案／165防詐專案／語音辨識模型／文書製作模型／案件分析模型）與「新增代理人服務」；統計卡：服務總數 8、運行中 7、等待中 1、已停止 0；「服務列表」表格列出各服務的專案、服務名稱、描述、類型（agent／model）、CPU、RAM、GPU、TPM 用量、RPM 用量、狀態、開始時間，每列附「維護」「用量調整」。",
    actions: [
      { label: "以「專案篩選」下拉過濾清單（停留原頁）", destination: null },
      { label: "點「新增代理人服務」開啟新增彈窗", destination: to("代理人治理｜新增代理人服務") },
      { label: "點服務列「維護」進入代理人服務維護", destination: to("代理人治理｜服務維護｜資料流水線") },
      { label: "點服務列「用量調整」開啟用量限制管理彈窗", destination: to("代理人治理｜用量調整") },
      ...sideNav(NAV_AGENT),
    ],
  },
  {
    route: "/",
    tab: "代理人治理｜新增代理人服務",
    purpose: "建立新的代理人服務並綁定專案、服務類型與模型。",
    content:
      "「新增代理人服務」彈窗：專案下拉、服務類型（即時推論／批次處理／訓練模型）、服務名稱（例如 anti-fraud-agent-001）、服務描述、模型下拉；底部為「取消」與「新增代理人服務」（未填妥前停用）。",
    actions: [
      { label: "選專案與服務類型、填名稱／描述、選模型", destination: null },
      { label: "點「新增代理人服務」送出（純前端即時新增）", destination: to(NAV_AGENT) },
      { label: "點「取消」或右上叉關閉彈窗", destination: to(NAV_AGENT) },
    ],
  },
  {
    route: "/",
    tab: "代理人治理｜用量調整",
    purpose: "調整單一代理人服務的 TPM／RPM 用量上限。",
    content:
      "「用量限制管理」彈窗：API 端點附「複製」鈕、TPM 與 RPM 上限滑桿；底部為「取消」與「儲存限制」。",
    actions: [
      { label: "拖動滑桿調整 TPM／RPM 上限", destination: null },
      { label: "點「儲存限制」套用（純前端即時生效）", destination: to(NAV_AGENT) },
      { label: "點「取消」或「✕」關閉彈窗", destination: to(NAV_AGENT) },
    ],
  },
  {
    route: "/",
    tab: "代理人治理｜服務維護｜資料流水線",
    purpose: "檢視代理人服務的知識供給流水線：已納管文件與其建構出的知識圖譜。",
    content:
      "頂部「返回代理人服務列表」、服務名稱（筆錄製作任務、運行中、165防詐專案），標示「歷程資料僅供檢視」；分頁列（資料流水線、流程管理、版本／資料治理／部署歷程）。「文件來源」列出金融監管法規 2024.pdf、企業內部政策手冊.pdf、醫療器材認證標準.docx、產品技術規格書.pdf（皆已完成，合計 4 份文件、8,490 個知識分塊）；「知識圖譜 (Apache AGE)」呈現 156 節點的關聯圖。",
    actions: [
      { label: "點「返回代理人服務列表」回服務清單", destination: to(NAV_AGENT) },
      ...agentTabs("資料流水線"),
    ],
  },
  {
    route: "/",
    tab: "代理人治理｜服務維護｜流程管理",
    purpose: "檢視代理人服務的流程管理紀錄。",
    content: "「流程管理紀錄」清單：列出此服務歷次流程事件與狀態；頂部同為返回鈕與三分頁列，標示歷程資料僅供檢視。",
    actions: [
      { label: "點「返回代理人服務列表」回服務清單", destination: to(NAV_AGENT) },
      ...agentTabs("流程管理"),
    ],
  },
  {
    route: "/",
    tab: "代理人治理｜服務維護｜版本／資料治理／部署歷程",
    purpose: "追溯代理人服務的版本演進、資料治理與部署歷程。",
    content: "「版本／資料治理／部署歷程」分頁：以時間軸／清單呈現版本與部署事件；頂部同為返回鈕與三分頁列。",
    actions: [
      { label: "點「返回代理人服務列表」回服務清單", destination: to(NAV_AGENT) },
      ...agentTabs("版本／資料治理／部署歷程"),
    ],
  },
  {
    route: "/",
    tab: "安全監控",
    purpose: "針對各模型設定 LLM 安全防護（監控或攔截）並查看標記成效。",
    content:
      "頂部服務下拉與模型分頁（Llama 4 Scout／GPT-4.1）；防護區塊各有「監控／攔截」運作模式切換與「儲存設定」：PII 個資防護、LLM Guard（偵測模式 3 已啟用，可展開逐項啟用）、Keyword Matching（依自訂攔截關鍵字標記）；各區塊顯示輸入／輸出標記成效百分比。",
    actions: [
      { label: "切換各防護的「監控／攔截」模式後點「儲存設定」（停留原頁）", destination: null },
      { label: "切到「GPT-4.1」模型分頁", destination: to("安全監控｜GPT-4.1") },
      { label: "往下捲動查看 Keyword Matching 關鍵字表與標記成效說明", destination: to("安全監控｜往下") },
      ...sideNav(NAV_SECURITY),
    ],
  },
  {
    route: "/",
    tab: "安全監控｜往下",
    purpose: "維護 Keyword Matching 攔截關鍵字並理解標記成效指標的意義。",
    content:
      "Keyword Matching 關鍵字表（機密 34 次、內部文件 12 次、密碼 8 次、帳號 21 次，各可啟用／停用與編輯，底部「新增關鍵字…」輸入）；輸入標記成效 0.26%（已檢查 18,240、已標記 48）、輸出標記成效 0.08%（已檢查 18,192、已標記 14）；最下方「標記成效說明」解釋輸入／輸出標記的檢查時點。",
    actions: [
      { label: "新增、啟用／停用或編輯攔截關鍵字後點「儲存設定」（停留原頁）", destination: null },
      { label: "往上捲動回防護設定區", destination: to(NAV_SECURITY) },
      ...sideNav(NAV_SECURITY),
    ],
  },
  {
    route: "/",
    tab: "安全監控｜GPT-4.1",
    purpose: "檢視並設定 GPT-4.1 模型的安全防護組態。",
    content:
      "同安全監控版面，模型分頁切至 GPT-4.1：PII、LLM Guard、Keyword Matching 三類防護的監控／攔截模式、關鍵字與標記成效改呈現 GPT-4.1 的資料。",
    actions: [
      { label: "調整 GPT-4.1 的防護模式與關鍵字後點「儲存設定」（停留原頁）", destination: null },
      { label: "切回「Llama 4 Scout」模型分頁", destination: to(NAV_SECURITY) },
      ...sideNav(NAV_SECURITY),
    ],
  },
  {
    route: "/",
    tab: "人機協作",
    purpose: "人工覆核 AI 回覆：從審核佇列挑出使用者倒讚的對話，覆核並校正回覆內容。",
    content:
      "「所屬專案」與「AGENT 服務」下拉篩選；左側「審核佇列」分「未修改 3」「已修改 1」，列出倒讚對話（如自稱銀行客服要驗證碼、匯保證金領獎金、LINE 私下交易），各附倒讚原因與時間；右側「對話審核」呈現選中對話的使用者提問與 AI 回覆，底部「修改回覆」。",
    actions: [
      { label: "以專案／AGENT 服務下拉篩選佇列（停留原頁）", destination: null },
      { label: "點佇列項目載入該筆對話（停留原頁）", destination: null },
      { label: "點「修改回覆」進入編輯狀態", destination: to("人機協作｜修改回覆") },
      { label: "切到「已修改」佇列", destination: to("人機協作｜已修改") },
      ...sideNav(NAV_HITL),
    ],
  },
  {
    route: "/",
    tab: "人機協作｜修改回覆",
    purpose: "編輯 AI 的不當回覆內容，儲存後成為校正版本。",
    content:
      "「對話審核」面板進入編輯狀態：AI 回覆改為可編輯文字框（示例為誤導性的銀行驗證碼建議），底部為「取消」與「儲存修改」。",
    actions: [
      { label: "編輯回覆文字", destination: null },
      { label: "點「儲存修改」保存校正（該筆移入已修改佇列）", destination: to("人機協作｜已修改") },
      { label: "點「取消」放棄編輯", destination: to(NAV_HITL) },
    ],
  },
  {
    route: "/",
    tab: "人機協作｜已修改",
    purpose: "檢視已完成人工校正的對話清單與其修改結果。",
    content:
      "「審核佇列」切至「已修改 1」：列出已校正的對話，右側對話審核呈現修改前後的回覆內容。",
    actions: [
      { label: "點佇列項目查看修改結果（停留原頁）", destination: null },
      { label: "切回「未修改」佇列", destination: to(NAV_HITL) },
      ...sideNav(NAV_HITL),
    ],
  },
  {
    route: "/",
    tab: "追蹤日誌",
    purpose: "檢視 Langfuse 追蹤日誌：逐筆追查 AI 呼叫的輸入、模型、Tokens 與品質，並可回饋正確性。",
    content:
      "頂部「追蹤日誌／系統日誌」分頁與時間快選（今／昨／本月／本季／本年／自選）、「匯出報表」；「追蹤日誌 (Langfuse Traces)」表格列出時間、TRACE ID（trace-001～006，可點）、輸入、概述、模型、Tokens、品質（百分比鈕）、狀態與操作（「正確」「需修正」回饋鈕）。",
    actions: [
      { label: "以時間快選切換統計區間（停留原頁）", destination: null },
      { label: "點「匯出報表」輸出目前區間報表（純前端示意）", destination: null },
      { label: "點 TRACE ID 開啟追蹤詳情", destination: to("追蹤日誌｜追蹤詳情") },
      { label: "點品質百分比開啟 AI 品質自動評估", destination: to("追蹤日誌｜品質評估") },
      { label: "點「正確」或「需修正」回饋單筆品質（純前端即時生效）", destination: null },
      { label: "切到「系統日誌」分頁", destination: to("追蹤日誌｜系統日誌") },
      ...sideNav(NAV_TRACE),
    ],
  },
  {
    route: "/",
    tab: "追蹤日誌｜追蹤詳情",
    purpose: "鑽入單筆 Langfuse 追蹤，檢視完整的呼叫細節。",
    content:
      "「追蹤詳情 (Trace Details)」面板：呈現該 trace 的輸入輸出內容、模型、Tokens 與各步驟耗時等細節，右上有關閉鈕。",
    actions: [{ label: "點右上關閉鈕回追蹤清單", destination: to(NAV_TRACE) }],
  },
  {
    route: "/",
    tab: "追蹤日誌｜品質評估",
    purpose: "查看單筆追蹤的 AI 品質自動評估細項，作為人工回饋的依據。",
    content:
      "「AI 品質自動評估 — trace-001」彈窗：列出評估維度與得分（總分 92%）與評估說明，附「正確」「需修正」回饋鈕；底部「關閉」。",
    actions: [
      { label: "點「正確」或「需修正」回饋評估結果（純前端即時生效）", destination: null },
      { label: "點「關閉」回追蹤清單", destination: to(NAV_TRACE) },
    ],
  },
  {
    route: "/",
    tab: "追蹤日誌｜系統日誌",
    purpose: "稽核平台操作行為：檢視各人員操作的等級、對象、IP 與結果。",
    content:
      "「系統日誌」分頁：時間快選與「匯出日誌」；統計卡總操作數 12、成功 3、警告 2、錯誤 2（可點過濾）；日誌表格列出時間、等級、類別、操作、操作人員、操作對象、IP 位址、結果。",
    actions: [
      { label: "點統計卡或時間快選過濾日誌（停留原頁）", destination: null },
      { label: "點「匯出日誌」輸出日誌（純前端示意）", destination: null },
      { label: "切回「追蹤日誌」分頁", destination: to(NAV_TRACE) },
      ...sideNav(NAV_TRACE),
    ],
  },
  {
    route: "/",
    tab: "帳號權限設定｜介接公務系統",
    purpose: "檢視由公務系統同步而來的唯讀帳號清單。",
    content:
      "「介接公務系統 7」與「系統自管帳號 3」兩個分頁；表格列出使用者名稱、電子郵件、部門、角色、帳號來源、狀態、最後登入，操作欄為停用的「公務系統帳號唯讀」鈕（不可編輯）。",
    actions: [
      { label: "切到「系統自管帳號」分頁", destination: to("帳號權限設定｜系統自管帳號") },
      ...sideNav(NAV_ACCOUNT),
    ],
  },
  {
    route: "/",
    tab: "帳號權限設定｜系統自管帳號",
    purpose: "管理系統自建帳號：新增使用者與編輯既有帳號。",
    content:
      "「系統自管帳號 3」分頁：右上「新增使用者」；表格列出三筆自管帳號的使用者名稱、電子郵件、部門、角色、帳號來源、狀態、最後登入，每列附「編輯」。",
    actions: [
      { label: "點「新增使用者」開啟新增彈窗", destination: to("帳號權限設定｜系統自管帳號｜新增使用者") },
      { label: "點帳號列「編輯」開啟編輯彈窗", destination: to("帳號權限設定｜系統自管帳號｜編輯帳號資訊") },
      { label: "切回「介接公務系統」分頁", destination: to(NAV_ACCOUNT) },
      ...sideNav("帳號權限設定｜系統自管帳號"),
    ],
  },
  {
    route: "/",
    tab: "帳號權限設定｜系統自管帳號｜新增使用者",
    purpose: "建立新的系統自管帳號並指派部門與角色。",
    content: "「新增自管使用者」彈窗：填寫使用者名稱、電子郵件、部門與角色等欄位；底部為「取消」與確認新增鈕。",
    actions: [
      { label: "填寫帳號欄位並送出（純前端即時新增）", destination: to("帳號權限設定｜系統自管帳號") },
      { label: "點「取消」關閉彈窗", destination: to("帳號權限設定｜系統自管帳號") },
    ],
  },
  {
    route: "/",
    tab: "帳號權限設定｜系統自管帳號｜編輯帳號資訊",
    purpose: "修改既有自管帳號的基本資料、角色或狀態。",
    content: "「編輯帳號資訊」彈窗：帶入該帳號現值可修改；底部為「取消」與「儲存變更」。",
    actions: [
      { label: "修改欄位後點「儲存變更」（純前端即時生效）", destination: to("帳號權限設定｜系統自管帳號") },
      { label: "點「取消」關閉彈窗", destination: to("帳號權限設定｜系統自管帳號") },
    ],
  },
  {
    route: "/",
    tab: "系統設定",
    purpose: "管理平台層級組態：基礎參數、通知告警與角色權限。",
    content:
      "右上「儲存設定」；「平台基礎參數」設定平台名稱與門檻等欄位；「通知與告警設定」四個開關（模組異常時發送通知、資源使用超過門檻時發送通知、每日彙整報表 Email 通知、部署完成後通知負責單位）；「角色權限設定」列出各角色的權限配置。",
    actions: [
      { label: "調整參數與通知開關後點「儲存設定」（純前端即時生效）", destination: null },
      ...sideNav(NAV_SETTINGS),
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
