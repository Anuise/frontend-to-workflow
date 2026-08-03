import { expect, test } from "vitest";
import {
  buildWorkitems,
  discoverPartyInputs,
  endpointsByVendor,
  loadWorkflowForBreakdown,
  saveWorkitems,
  WorkitemsConsistencyError,
} from "../src/breakdown";
import type { WorkItemInput } from "../src/breakdown";
import {
  BACKEND_SHEET,
  BACKEND_SOURCED_COLUMNS,
  FRONTEND_SHEET,
  OVERVIEW_SHEET,
  SOURCING_STATUS_LABEL,
  buildWorkitemsWorkbook,
  hasPartyChains,
  loadWorkitemsForExport,
  saveWorkitemsWorkbook,
} from "../src/breakdown-export";
import { NEEDS_INVESTIGATION, type PartyLeg } from "../src/contracts/workitems";
import { loadProjectRevisions } from "../src/revise";

// new_0724 實跑驅動：一支跑完 f2w-breakdown（含派工）＋ f2w-breakdown-export。
// 讀回 workflow.json，逐操作產出前端工項＋推論後端工項與分工鏈，經 buildWorkitems
// 把關後落地 workitems.json，再組出 workitems.xlsx。
//
// 本檔**只驅動、不扛政策**：分工方名與宣告鏈都來自 workspace/spec/<project>/ 的目錄慣例
// 與泳道圖，driver 不再有 SPEC_OWNER 那種政策常數；下面的 POLICY 只保留「這筆工項的
// 目標方與端點」，鏈的形狀交給宣告鏈硬底線把關。
const OUTPUT_ROOT = "output";
const WORKSPACE_ROOT = "workspace";
const SPEC_ROOT = "workspace/spec";
const PROJECT = "new_0724_AI六大模組管理平台_桃園智發會_最新版";

/** 單筆工項的內容型欄位（id／sourcePage／inferred 由產生器補齊）。 */
type Raw = { t: string; s: string; a: string; r?: string };

// 側欄導覽、登出、收合、頁籤切換這類重複操作：由 workflow.json 的 label 直接推導工項，
// 不手抄——保證與描述逐字對齊，也不會漏算顆粒度底線。
const NAV = /^由側欄前往|^點右上「登出」|^點側欄底部箭頭|^切到「/;

function navItem(label: string): Raw {
  const sidebar = label.match(/^由側欄前往「(.+)」$/);
  if (sidebar) {
    return {
      t: `側欄前往${sidebar[1]}`,
      s: `此頁側欄「${sidebar[1]}」項目的導覽觸發。`,
      a: `點擊後主內容切換到${sidebar[1]}，側欄該項高亮，其他模組狀態不受影響。`,
    };
  }
  const tab = label.match(/^切到「(.+?)」/);
  if (tab) {
    return {
      t: `切換至${tab[1]}`,
      s: `此頁頁籤列切到「${tab[1]}」。`,
      a: `點擊後顯示${tab[1]}的內容且頁籤高亮同步，未儲存的表單狀態行為需明確。`,
    };
  }
  if (label.startsWith("點右上「登出」")) {
    return {
      t: "登出回登入頁",
      s: "右上「登出」結束工作階段。",
      a: "點擊後清除身分狀態並回到登入頁，返回上一頁無法取回原工作階段。",
    };
  }
  return {
    t: "側欄收合展開",
    s: "側欄底部箭頭切換收合／展開。",
    a: "點擊後側欄寬度切換，主內容區隨之伸縮，圖表不破版。",
  };
}

// 逐頁「非導覽」操作的前端工項，順序逐字對齊 workflow.json 該頁 actions 中非導覽的順序。
const SPECIFIC: Record<string, Raw[]> = {
  登入: [
    {
      t: "登入－SSO 單一簽入入口",
      s: "「SSO 單一簽入」按鈕：建立完整權限工作階段，落在叢集資源總覽，側欄顯示七個模組。",
      a: "點擊後進入叢集資源總覽且側欄七項齊備。",
      r: "示範環境不驗帳密；接真 SSO 後登入流程會改為外部重導與回呼，前端流程需改寫。",
    },
    {
      t: "登入－一般登入入口",
      s: "「一般登入」按鈕：建立申請者工作階段，側欄僅保留算力申請與審核。",
      a: "點擊後落在提出申請頁且側欄只有一個模組項目。",
      r: "可見選單須由後端權限決定，不可只靠前端裁切。",
    },
  ],
  "SSO｜模型倉庫": [
    { t: "模型倉庫－開啟上傳模型彈窗", s: "右上「上傳模型」按鈕開啟上傳彈窗。", a: "點擊後彈出上傳模型表單，背景清單保持不變。" },
    {
      t: "模型倉庫－模型列下載",
      s: "每列「下載」按鈕觸發模型檔取得。",
      a: "點擊後發起下載並在進行中／失敗時給使用者回饋。",
      r: "原型未實際下載；模型檔可達數十 GB，需串流與續傳設計。",
    },
  ],
  "SSO｜模型倉庫｜上傳模型": [
    {
      t: "上傳模型－表單與檔案選取",
      s: "模型類型（Instance／LLM）、名稱、標籤、描述輸入，及限 .bin／.pt／.safetensors／.gguf／.onnx／.pkl 的拖放區。",
      a: "各欄位可輸入，拖放或選檔後顯示檔名，副檔名不符時擋下並提示。",
    },
    { t: "上傳模型－送出上傳", s: "「上傳模型」送出並回到模型註冊中心。", a: "必填齊全才可送出，送出後關閉彈窗並在清單看到新模型。", r: "寫入動作；大檔上傳需進度與失敗重試。" },
    { t: "上傳模型－關閉彈窗", s: "「關閉」或右上叉關掉彈窗。", a: "點擊後不新增資料並回到模型註冊中心。" },
  ],
  "SSO｜叢集資源總覽": [
    {
      t: "叢集總覽－叢集卡展開收合與圖表",
      s: "H200／L40 兩張叢集卡的展開收合，內含每張 GPU 的記憶體使用量面積圖（used／reserved／free）與利用率折線圖。",
      a: "點卡片標題可展開收合，展開後圖表以 30 秒頻率更新且座標軸單位正確。",
      r: "多 GPU 同時渲染時序圖，資料點多易掉幀。",
    },
  ],
  "SSO｜算力申請與審核｜申請者｜提出申請": [
    {
      t: "提出申請－表單填寫",
      s: "專案名稱／類型、申請模型下拉、Domain、來源 IP、使用人數、使用目的。",
      a: "各欄位可輸入與選擇，Domain 與 IP 格式錯誤時即時提示。",
      r: "IP 可能為多筆或 CIDR，格式規則需與後端一致。",
    },
    { t: "提出申請－清除表單", s: "「清除」把所有欄位還原為空。", a: "點擊後欄位全清空且既有錯誤提示消失。" },
    {
      t: "提出申請－送出申請",
      s: "「送出申請」建立待審核案件並轉到進度追蹤。",
      a: "必填齊全才可送出，送出後進度追蹤出現該案且狀態為待審核。",
      r: "寫入動作；重複點擊需防重送。",
    },
  ],
  "SSO｜算力申請與審核｜申請者｜進度追蹤": [
    { t: "進度追蹤－查看案件內容", s: "案件列「查看」開啟申請案件內容彈窗。", a: "點擊後彈出該案唯讀明細，內容與送出時一致。" },
    { t: "進度追蹤－編輯未通過案件", s: "未通過案件的「編輯申請」載入原內容重新編輯。", a: "點擊後開啟編輯表單且欄位預填原申請內容。" },
    { t: "進度追蹤－取消申請", s: "「取消申請」撤回案件。", a: "點擊後案件狀態轉為已取消且不可再編輯。", r: "破壞性動作且畫面無二次確認，需補確認步驟。" },
    { t: "進度追蹤－停用已開通服務", s: "已開通案件的「停用」關閉該服務。", a: "點擊後服務狀態轉停用，端點停止服務。", r: "破壞性動作；停用會即時中斷線上流量。" },
    {
      t: "進度追蹤－複製端點與 API Key",
      s: "端點與 API Key 旁的「複製」把憑證寫入剪貼簿。",
      a: "點擊後複製成功有提示，畫面預設遮罩僅顯示部分字元。",
      r: "機敏資訊；不應在畫面完整明碼常駐。",
    },
  ],
  "SSO｜算力申請與審核｜申請者｜進度追蹤｜申請案件內容": [
    { t: "申請案件內容－唯讀明細與關閉", s: "彈窗呈現該案完整申請欄位，右上叉關閉回到進度追蹤。", a: "所有欄位唯讀不可改，關閉後回到進度追蹤且清單狀態不變。" },
  ],
  "SSO｜算力申請與審核｜申請者｜進度追蹤｜編輯申請": [
    { t: "編輯申請－修改欄位", s: "專案資訊、模型、Domain／來源 IP、使用人數、使用目的皆可改。", a: "開啟時預填原內容，修改後即時校驗。" },
    { t: "編輯申請－清除表單", s: "「清除」清空所有欄位。", a: "點擊後欄位全空，可重新填寫。" },
    { t: "編輯申請－重新送出申請", s: "「重新送出申請」把未通過案件改回待審核。", a: "送出後案件狀態回到待審核並帶新內容。", r: "寫入動作；需保留歷史版本供審核比對。" },
  ],
  "SSO｜算力申請與審核｜管理者｜審核": [
    { t: "審核清單－條件搜尋", s: "案件、模型、申請者、狀態條件加「搜尋」過濾清單。", a: "輸入條件後點搜尋，清單只留符合列，無結果顯示空狀態。" },
    { t: "審核清單－清除條件", s: "「清除」重置所有篩選條件。", a: "點擊後條件全空且清單回到完整列表。" },
    { t: "審核清單－開啟模型服務審核", s: "待審核案件的「審核」開啟審核彈窗。", a: "點擊後彈出該案審核表單，帶入申請內容。" },
    { t: "審核清單－查看服務詳細資料", s: "已開通或未通過案件的「查看」開啟詳細資料彈窗。", a: "點擊後彈出該案詳細資料，含核定值與監控設定。" },
  ],
  "SSO｜算力申請與審核｜管理者｜審核｜模型服務審核": [
    {
      t: "模型服務審核－核定額度與期限",
      s: "核定 TPM／RPM、有效期起訖與審核備註輸入。",
      a: "額度為正整數，起訖日期先後合理，違規時擋下送出。",
      r: "TPM／RPM 語意需與實際限流實作一致。",
    },
    { t: "模型服務審核－安全監控項目勾選", s: "PII 個資監控／LLM Guard／Keyword Matching 逐項啟用切換。", a: "勾選狀態可切換並隨核定一併保存。" },
    {
      t: "模型服務審核－核定並開通",
      s: "「核定並開通」核發 API 端點與 API Key。",
      a: "點擊後案件轉已開通，申請者側可見端點與 Key。",
      r: "寫入動作；Key 只應顯示一次，需明確保管與重發流程。",
    },
    { t: "模型服務審核－退回未通過", s: "「未通過」退回案件並附備註。", a: "點擊後案件轉未通過，申請者可看到退回備註並編輯重送。", r: "寫入動作；備註應為必填以說明退回原因。" },
    { t: "模型服務審核－關閉彈窗", s: "右上叉關掉彈窗回到審核清單。", a: "點擊後不保存變更並回到清單。" },
  ],
  "SSO｜算力申請與審核｜管理者｜審核｜模型服務詳細資料": [
    { t: "服務詳細資料－調整監控項目", s: "已開通案件的安全監控項目勾選或取消。", a: "切換後狀態即時反映在畫面。" },
    { t: "服務詳細資料－儲存監控設定", s: "「儲存設定」保存監控設定變更。", a: "儲存後重開彈窗仍為新設定。", r: "寫入動作；設定變更會影響線上攔截行為。" },
    { t: "服務詳細資料－停用 API 與 Key", s: "「停用 API 與 API Key」關閉該服務。", a: "點擊後服務轉停用且 Key 失效。", r: "破壞性動作；無二次確認即中斷線上服務。" },
    { t: "服務詳細資料－複製憑證", s: "端點與 API Key 旁的「複製」。", a: "複製成功有提示，畫面預設遮罩。", r: "機敏資訊外洩風險。" },
    { t: "服務詳細資料－關閉彈窗", s: "右上叉關掉彈窗回到審核清單。", a: "點擊後回到清單且未儲存的勾選不生效。" },
  ],
  "SSO｜算力排程與工作負載": [
    { t: "工作負載－專案卡展開收合", s: "專案卡片展開檢視配額用量與模型服務數。", a: "點擊可展開收合，用量數字與配額一致。" },
    { t: "工作負載－開啟新建專案", s: "「新建專案」按鈕開啟建立專案彈窗。", a: "點擊後彈出新建專案表單。" },
    { t: "工作負載－進入專案詳情", s: "專案卡「維護」導向該專案詳情頁。", a: "點擊後進入對應專案詳情且標題為該專案。" },
  ],
  "SSO｜算力排程與工作負載｜新建專案": [
    { t: "新建專案－基本資訊與配額滑桿", s: "專案名稱／管理員／描述輸入，CPU 與 RAM 配額滑桿。", a: "欄位可輸入、滑桿可拖動，上限不可超過叢集剩餘量。", r: "配額上限規則需與後端一致。" },
    { t: "新建專案－捲動至 GPU 配置", s: "彈窗內容超過首屏，需向下捲動看完整 GPU 清單。", a: "捲動後可見 GPU 配置區且底部操作鍵不被遮蔽。" },
    { t: "新建專案－送出建立", s: "「建立專案」送出並回到專案列表。", a: "必填齊全才可送出，送出後列表出現新專案卡。", r: "寫入動作；需防重複建立同名專案。" },
    { t: "新建專案－取消關閉", s: "「取消」或右上叉關掉彈窗。", a: "點擊後不建立資料並回到專案列表。" },
  ],
  "SSO｜算力排程與工作負載｜新建專案｜往下": [
    { t: "新建專案－GPU 卡勾選", s: "H200／L40 可用 GPU 卡逐張勾選分配給此專案。", a: "已被其他專案占用者不可選，勾選數即分配數。", r: "GPU 獨占與共享語意需釐清，否則超賣。" },
    { t: "新建專案－捲回基本資訊", s: "向上捲回專案基本資訊區。", a: "捲回後先前填的欄位值仍保留。" },
    { t: "新建專案－底部送出建立", s: "捲動後的「建立專案」送出。", a: "與上方送出行為一致，送出後回到專案列表。", r: "寫入動作。" },
    { t: "新建專案－底部取消關閉", s: "捲動後的「取消」或右上叉。", a: "點擊後不建立並關閉彈窗。" },
  ],
  "SSO｜算力排程與工作負載｜專案詳情": [
    { t: "專案詳情－開啟編輯節點配置", s: "「編輯資源」開啟節點配置彈窗。", a: "點擊後彈出配額表單並帶入現值。" },
    { t: "專案詳情－開啟建立模型服務", s: "「建立模型服務」開啟建立表單。", a: "點擊後彈出建立模型服務表單。" },
    { t: "專案詳情－進入模型服務詳情", s: "模型服務列「維護」導向服務詳情資訊分頁。", a: "點擊後進入該服務詳情且落在資訊分頁。" },
    { t: "專案詳情－返回工作負載", s: "「返回工作負載」回到專案列表。", a: "點擊後回到列表且捲動位置合理。" },
  ],
  "SSO｜算力排程與工作負載｜專案詳情｜編輯節點配置": [
    { t: "編輯節點配置－配額滑桿", s: "CPU 與 RAM 配額滑桿調整。", a: "滑桿可拖動，超過叢集剩餘量時擋下。" },
    { t: "編輯節點配置－儲存配置", s: "「儲存配置」套用新配額。", a: "儲存後專案詳情顯示新配額。", r: "寫入動作；縮小配額可能影響執行中服務。" },
    { t: "編輯節點配置－取消關閉", s: "「取消」或右上叉關掉彈窗。", a: "點擊後配額不變並回到專案詳情。" },
  ],
  "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務": [
    { t: "建立模型服務－服務名稱與模型來源", s: "服務名稱、描述，以及搜尋並選定模型倉庫的既有模型與標籤。", a: "可搜尋模型，選定後顯示模型名與標籤。" },
    { t: "建立模型服務－連接埠與掛載增刪", s: "連接埠與掛載磁碟區的「新增」增列、按叉移除。", a: "可增列多組、可逐組移除，埠號重複時提示。" },
    { t: "建立模型服務－捲動至節點配置", s: "向下捲動到節點配置與 GPU 區。", a: "捲動後可見配額滑桿與 GPU 勾選區。" },
    { t: "建立模型服務－送出建立", s: "「建立模型服務」送出部署。", a: "必填齊全才可送出，送出後專案詳情出現該服務。", r: "寫入動作；部署為長時間非同步作業，需狀態回饋。" },
    { t: "建立模型服務－取消關閉", s: "「取消」或右上叉關掉彈窗。", a: "點擊後不建立並回到專案詳情。" },
  ],
  "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜往下": [
    { t: "建立模型服務－節點配額與臨時儲存", s: "CPU／RAM 滑桿與臨時儲存空間開關。", a: "滑桿受專案剩餘配額限制，開關狀態隨表單送出。" },
    { t: "建立模型服務－GPU 卡勾選", s: "可用 GPU 卡勾選，已滿載者不可選。", a: "滿載卡呈禁用樣式且點擊無效。", r: "滿載判定需即時，否則送出才失敗。" },
    { t: "建立模型服務－捲到推論參數區", s: "繼續向下捲到推論參數與送出區。", a: "捲動後可見推論參數欄位與底部送出鍵。" },
    { t: "建立模型服務－捲回模型來源", s: "向上捲回服務名稱與模型來源區。", a: "捲回後已填欄位保留。" },
    { t: "建立模型服務－中段取消關閉", s: "捲動後的「取消」或右上叉。", a: "點擊後不建立並關閉彈窗。" },
  ],
  "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜底部": [
    { t: "建立模型服務－推論參數調整", s: "Temperature、Max Tokens、Context Window 調整。", a: "數值在合法範圍內，超界時擋下並提示。", r: "上限受所選模型能力限制，需依模型帶入。" },
    { t: "建立模型服務－自動擴展與詳細日誌", s: "自動擴展與詳細日誌兩個開關。", a: "開關可切換並隨表單送出保存。" },
    { t: "建立模型服務－底部送出建立", s: "底部「建立模型服務」送出。", a: "與上方送出行為一致，成功後回到專案詳情。", r: "寫入動作。" },
    { t: "建立模型服務－底部取消關閉", s: "底部「取消」或右上叉。", a: "點擊後不建立並關閉彈窗。" },
  ],
  "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜新環境": [
    { t: "新環境－Docker 映像輸入", s: "自帶環境模式下輸入 Docker 映像與標籤。", a: "可輸入映像與標籤，格式不合時提示。", r: "外部映像需來源信任與漏洞掃描。" },
    { t: "新環境－切回現有模型", s: "切回「現有模型」改選模型倉庫既有模型。", a: "切換後顯示模型搜尋區，已填的映像值行為需明確。" },
    { t: "新環境－捲動至節點配置", s: "向下捲動填寫節點配置與 GPU。", a: "捲動後可見配額與 GPU 區。" },
    { t: "新環境－取消關閉", s: "「取消」或右上叉關掉彈窗。", a: "點擊後不建立並回到專案詳情。" },
  ],
  "SSO｜算力排程與工作負載｜模型服務詳情｜資訊": [
    { t: "服務資訊－容器終端機輸入", s: "資訊分頁內嵌終端機可輸入指令操作容器。", a: "可輸入並看到回傳輸出，斷線時有提示。", r: "等同容器內執行權，須嚴格權限控管與指令稽核。" },
    { t: "服務資訊－提交封裝新模型版本", s: "填模型名稱／標籤／描述後「提交」把當前容器封裝成新模型版本。", a: "必填齊全才可提交，提交後模型倉庫出現新版本。", r: "寫入動作；封裝為長時作業，需進度與失敗處理。" },
    { t: "服務資訊－取消清除表單", s: "「取消」清除模型資訊表單。", a: "點擊後三個欄位清空，不影響服務狀態。" },
    { t: "服務資訊－返回專案", s: "「返回專案」回到專案詳情。", a: "點擊後回到該服務所屬專案詳情。" },
  ],
  "SSO｜算力排程與工作負載｜模型服務詳情｜資源": [
    { t: "服務資源－用量圖表與返回專案", s: "資源分頁呈現該服務 CPU／RAM／GPU 用量圖表，「返回專案」回到專案詳情。", a: "圖表數值與時間軸正確，返回後回到專案詳情。" },
  ],
  "SSO｜算力排程與工作負載｜模型服務詳情｜API監控": [
    { t: "API 監控－停用專案 API Key", s: "專案列「停用」關閉該 API Key。", a: "點擊後該 Key 轉停用且呼叫被拒。", r: "破壞性動作；會即時中斷該專案的呼叫。" },
    { t: "API 監控－返回專案", s: "「返回專案」回到專案詳情。", a: "點擊後回到專案詳情。" },
  ],
  "SSO｜算力排程與工作負載｜模型服務詳情｜設定": [
    { t: "服務設定－編輯名稱與描述", s: "任務名稱與描述旁的「編輯」就地修改。", a: "點擊後欄位可編輯，保存後顯示新值。", r: "寫入動作。" },
    { t: "服務設定－重新啟動與停止", s: "「重新啟動」與「停止」改變服務執行狀態。", a: "點擊後狀態轉換有中間狀態顯示，完成後狀態正確。", r: "破壞性動作；無二次確認即中斷線上服務。" },
    { t: "服務設定－開啟變更資源分配", s: "「變更分配」開啟資源分配彈窗。", a: "點擊後彈出配額表單並帶入現值。" },
    { t: "服務設定－儲存推論配置", s: "調整推論參數後「儲存配置」。", a: "儲存後重載仍為新參數。", r: "寫入動作；變更可能需重啟服務才生效。" },
    { t: "服務設定－開啟刪除確認", s: "「刪除模型」開啟刪除確認彈窗。", a: "點擊後彈出確認彈窗，尚未刪除任何資料。" },
    { t: "服務設定－返回專案", s: "「返回專案」回到專案詳情。", a: "點擊後回到專案詳情。" },
  ],
  "SSO｜算力排程與工作負載｜模型服務詳情｜設定｜變更資源分配": [
    { t: "變更資源分配－配額滑桿", s: "CPU 與 RAM 滑桿調整此服務配額。", a: "滑桿受專案剩餘配額限制。" },
    { t: "變更資源分配－儲存套用", s: "「儲存」套用新配置。", a: "儲存後設定分頁顯示新配額。", r: "寫入動作；縮小配額可能觸發重新排程。" },
    { t: "變更資源分配－取消關閉", s: "「取消」關掉彈窗回到設定分頁。", a: "點擊後配額不變並回到設定分頁。" },
  ],
  "SSO｜算力排程與工作負載｜模型服務詳情｜設定｜確認刪除模型": [
    { t: "確認刪除模型－確認執行", s: "「確認刪除」永久移除模型服務。", a: "確認後服務自專案詳情消失且資源釋放。", r: "破壞性且不可復原；需明示連帶刪除範圍。" },
    { t: "確認刪除模型－取消放棄", s: "「取消」放棄刪除回到設定分頁。", a: "點擊後不刪除任何資料並回到設定分頁。" },
  ],
  "SSO｜算力排程與工作負載｜模型服務詳情｜日誌": [
    { t: "服務日誌－日誌檢視與返回專案", s: "日誌分頁呈現該服務執行日誌，「返回專案」回到專案詳情。", a: "日誌可捲動且時間序正確，返回後回到專案詳情。", r: "長日誌需分頁或虛擬捲動，否則卡頓。" },
  ],
  "SSO｜算力排程與工作負載｜模型服務詳情｜描述": [
    { t: "服務描述－捲動檢視規格與事件", s: "描述分頁的終端機區塊可捲動看完整規格與事件。", a: "可捲到最末筆且內容不截斷。" },
    { t: "服務描述－返回專案", s: "「返回專案」回到專案詳情。", a: "點擊後回到專案詳情。" },
  ],
  "SSO｜安全監控": [
    { t: "安全監控－開啟關鍵字維護", s: "「編輯攔截關鍵字」開啟關鍵字維護彈窗。", a: "點擊後彈出關鍵字清單與新增欄位。" },
  ],
  "SSO｜安全監控｜編輯攔截關鍵字": [
    { t: "攔截關鍵字－新增字詞", s: "輸入關鍵字後「新增」加入清單。", a: "新增後清單出現該標籤，空字串或重複時擋下。", r: "寫入動作；即時影響線上攔截。" },
    { t: "攔截關鍵字－移除字詞", s: "關鍵字標籤上的垃圾桶移除該字詞。", a: "點擊後該標籤消失。", r: "破壞性動作且無二次確認，移除即放行原本被攔的內容。" },
    { t: "攔截關鍵字－完成關閉", s: "「完成」或右上叉關掉彈窗。", a: "點擊後回到安全監控頁。" },
  ],
  "SSO｜追蹤日誌": [
    { t: "追蹤日誌－時間區間篩選", s: "今／昨／本月／本季／本年與自訂日期切換。", a: "切換後清單只留區間內追蹤，自訂日期需起訖合理。" },
    { t: "追蹤日誌－展開追蹤詳情", s: "點某筆 Trace ID 展開右側追蹤詳情抽屜。", a: "點擊後抽屜顯示該筆追蹤明細。" },
    { t: "追蹤日誌－開啟管理報表", s: "「管理報表」開啟報表彈窗（預設系統運作分頁）。", a: "點擊後彈出報表並落在系統運作分頁。" },
    { t: "追蹤日誌－匯出報表", s: "「匯出報表」下載追蹤報表檔。", a: "點擊後產生檔案並有進行中與完成回饋。", r: "下載動作；大區間匯出需非同步產檔。" },
  ],
  "SSO｜追蹤日誌｜追蹤詳情": [
    { t: "追蹤詳情－明細呈現與關閉", s: "抽屜呈現該筆追蹤的請求、回應與耗用明細，右上叉關閉。", a: "明細與清單該列一致，關閉後回到清單且篩選條件保留。" },
  ],
  "SSO｜追蹤日誌｜管理報表｜系統運作": [
    { t: "系統運作報表－時間區間切換", s: "今／昨／本月／本季／本年／自訂日期切換報表區間。", a: "切換後圖表與數字重算，載入中有骨架或載入態。" },
    { t: "系統運作報表－匯出", s: "「匯出報表」下載當前區間報表。", a: "匯出檔內容與畫面區間一致。", r: "下載動作。" },
    { t: "系統運作報表－關閉彈窗", s: "右上叉關掉報表彈窗。", a: "點擊後回到追蹤日誌清單。" },
  ],
  "SSO｜追蹤日誌｜管理報表｜系統成效": [
    { t: "系統成效報表－時間區間切換", s: "報表區間切換後重算成效指標。", a: "切換後指標與圖表隨區間更新。" },
    { t: "系統成效報表－匯出", s: "「匯出報表」下載當前區間報表。", a: "匯出檔內容與畫面區間一致。", r: "下載動作。" },
    { t: "系統成效報表－關閉彈窗", s: "右上叉關掉報表彈窗。", a: "點擊後回到追蹤日誌清單。" },
  ],
  "SSO｜追蹤日誌｜管理報表｜依賴狀況": [
    { t: "依賴狀況報表－時間區間切換", s: "報表區間切換後重算依賴狀況。", a: "切換後依賴圖表與清單隨區間更新。" },
    { t: "依賴狀況報表－匯出", s: "「匯出報表」下載當前區間報表。", a: "匯出檔內容與畫面區間一致。", r: "下載動作。" },
    { t: "依賴狀況報表－關閉彈窗", s: "右上叉關掉報表彈窗。", a: "點擊後回到追蹤日誌清單。" },
  ],
  "SSO｜帳號與權限管理｜介接公務系統": [
    { t: "介接公務系統－帳號搜尋過濾", s: "搜尋框以使用者名稱、部門或郵件過濾介接帳號清單。", a: "輸入後清單即時過濾，無結果顯示空狀態。", r: "此清單為外部系統同步而來，前端不應提供編輯入口。" },
  ],
  "SSO｜帳號與權限管理｜系統自管帳號": [
    { t: "自管帳號－帳號搜尋過濾", s: "搜尋框以使用者名稱、部門或郵件過濾自管帳號清單。", a: "輸入後清單即時過濾，無結果顯示空狀態。" },
    { t: "自管帳號－開啟新增使用者", s: "「新增使用者」開啟新增彈窗。", a: "點擊後彈出空白新增表單。" },
    { t: "自管帳號－開啟編輯帳號", s: "帳號列鉛筆圖示開啟編輯彈窗。", a: "點擊後彈出表單並帶入該帳號現值。" },
    { t: "自管帳號－刪除帳號", s: "帳號列垃圾桶圖示刪除該帳號。", a: "刪除後該列自清單消失。", r: "破壞性動作且無二次確認；需補確認與軟刪除。" },
  ],
  "SSO｜帳號與權限管理｜系統自管帳號｜新增使用者": [
    { t: "新增使用者－填寫帳號資料", s: "使用者名稱、電子郵件、所屬部門與角色選擇。", a: "郵件格式錯誤時提示，角色為必選。" },
    { t: "新增使用者－確認新增", s: "「確認新增」建立帳號並回到清單。", a: "必填齊全才可送出，成功後清單出現新帳號。", r: "寫入動作；郵件重複需擋下。" },
    { t: "新增使用者－取消關閉", s: "「取消」或右上叉關掉彈窗。", a: "點擊後不建立並回到清單。" },
  ],
  "SSO｜帳號與權限管理｜系統自管帳號｜編輯帳號資訊": [
    { t: "編輯帳號－修改欄位", s: "使用者名稱、電子郵件、部門或角色皆可改。", a: "開啟時帶入現值，修改後即時校驗。" },
    { t: "編輯帳號－儲存變更", s: "「儲存變更」更新帳號並回到清單。", a: "儲存後清單顯示新值。", r: "寫入動作；角色調降會即時改變該使用者可見範圍。" },
    { t: "編輯帳號－取消關閉", s: "「取消」或右上叉關掉彈窗。", a: "點擊後不更新並回到清單。" },
  ],
  "一般登入｜算力申請與審核｜申請者｜提出申請": [
    { t: "一般登入提出申請－表單填寫", s: "申請者身分下的申請表單各欄位輸入。", a: "欄位與校驗與 SSO 身分一致。" },
    { t: "一般登入提出申請－清除表單", s: "「清除」清空所有欄位。", a: "點擊後欄位全空。" },
    { t: "一般登入提出申請－送出申請", s: "「送出申請」建立待審核案件並轉到進度追蹤。", a: "送出後進度追蹤出現該案且狀態為待審核。", r: "寫入動作；申請者僅能看到自己的案件。" },
  ],
  "一般登入｜算力申請與審核｜申請者｜進度追蹤": [
    {
      t: "一般登入進度追蹤－查看案件內容",
      s: "案件列「查看」開啟申請案件內容彈窗（內容與 SSO 身分相同）。",
      a: "點擊後彈出該案唯讀明細。",
      r: "此身分下的彈窗未列為獨立 Page，需回頭補截以確認一致。",
    },
    {
      t: "一般登入進度追蹤－編輯未通過案件",
      s: "未通過案件的「編輯申請」載入原內容重新編輯（表單與 SSO 身分相同）。",
      a: "點擊後開啟編輯表單且欄位預填原內容。",
      r: "此身分下的表單未列為獨立 Page，需回頭補截以確認一致。",
    },
    { t: "一般登入進度追蹤－取消申請", s: "「取消申請」撤回案件。", a: "點擊後案件狀態轉為已取消。", r: "破壞性動作且無二次確認。" },
    { t: "一般登入進度追蹤－停用已開通服務", s: "已開通案件的「停用」關閉該服務。", a: "點擊後服務狀態轉停用。", r: "破壞性動作；申請者可自行中斷線上服務。" },
    { t: "一般登入進度追蹤－複製端點與 API Key", s: "端點與 API Key 旁的「複製」。", a: "複製成功有提示，畫面預設遮罩。", r: "機敏資訊外洩風險。" },
  ],
};

// 後端工項：workflow.json 沒有後端資訊，以下全為從畫面操作推論而來（inferred: true，推論·待確認）。
type Be = { id: string; page: string; t: string; s: string; a: string; r?: string; d?: string[] };

const BACKEND: Be[] = [
  { id: "BE-AUTH-1", page: "登入", t: "SSO 單一簽入整合", s: "與企業 IdP 完成單一簽入（重導、回呼、憑證驗證），發出平台工作階段。", a: "合法企業帳號可換得工作階段，失效或偽造憑證被拒。", r: "示範前端不驗身分，接真 IdP 後登入流程需整體改寫。" },
  { id: "BE-AUTH-2", page: "登入", t: "一般登入身分驗證", s: "申請者身分的登入驗證與工作階段發放。", a: "正確憑證得到申請者角色工作階段，錯誤憑證回一致錯誤訊息。" },
  { id: "BE-AUTH-3", page: "登入", t: "角色權限與可見選單 API", s: "依角色回傳可見模組與可執行操作，供前端側欄與按鈕裁切。", a: "申請者取得的清單只含算力申請與審核，越權呼叫其他 API 被拒。", d: ["BE-AUTH-1", "BE-AUTH-2"] },
  { id: "BE-AUTH-4", page: "登入", t: "工作階段維持與登出", s: "工作階段效期、續期與登出撤銷。", a: "登出後原憑證立即失效，過期後需重新登入。", d: ["BE-AUTH-3"] },
  { id: "BE-MODEL-1", page: "SSO｜模型倉庫", t: "模型清單查詢 API", s: "回傳模型名稱、類型、版本、狀態、供應商與 Context 長度。", a: "清單欄位齊全，支援分頁與排序。" },
  { id: "BE-MODEL-2", page: "SSO｜模型倉庫｜上傳模型", t: "模型上傳與格式驗證", s: "接收 .bin／.pt／.safetensors／.gguf／.onnx／.pkl 大檔，分段上傳與校驗和檢查。", a: "副檔名與內容不符時拒收，中斷後可續傳。", r: "檔案可達數十 GB，需儲存容量與逾時規劃。" },
  { id: "BE-MODEL-3", page: "SSO｜模型倉庫", t: "模型檔下載授權與串流", s: "驗證下載權限並以串流或簽章網址提供模型檔。", a: "無權者被拒，簽章網址有短效期。", d: ["BE-AUTH-3"] },
  { id: "BE-MODEL-4", page: "SSO｜模型倉庫｜上傳模型", t: "模型 metadata 與版本管理", s: "模型名稱／標籤唯一性、版本沿革與狀態轉換。", a: "同名同標籤重複時擋下，版本可追溯。", d: ["BE-MODEL-2"] },
  { id: "BE-CLUSTER-1", page: "SSO｜叢集資源總覽", t: "GPU 指標時序查詢", s: "提供每張 GPU 的記憶體 used／reserved／free 與利用率時序資料。", a: "時間軸連續、單位一致，缺值明確標示。" },
  { id: "BE-CLUSTER-2", page: "SSO｜叢集資源總覽", t: "30 秒即時指標更新機制", s: "以輪詢或推送提供 30 秒頻率的指標更新。", a: "更新頻率穩定，連線中斷可自動恢復。", d: ["BE-CLUSTER-1"] },
  { id: "BE-CLUSTER-3", page: "SSO｜叢集資源總覽", t: "Kubernetes namespace 配額查詢", s: "回傳各專案 namespace 的 Pods／CPU／Memory 與 GPU 配額及已用量。", a: "配額與實際叢集狀態一致。" },
  { id: "BE-APPLY-1", page: "SSO｜算力申請與審核｜申請者｜提出申請", t: "申請單建立 API", s: "接收專案資訊、模型、Domain、來源 IP、人數與使用目的，建立待審核案件。", a: "建立成功回案件編號，重送同內容不產生重複案件。" },
  { id: "BE-APPLY-2", page: "SSO｜算力申請與審核｜申請者｜提出申請", t: "申請欄位驗證規則", s: "Domain 與來源 IP（含多筆／CIDR）格式、人數上限、必填檢查。", a: "非法輸入被拒並回可對應欄位的錯誤，規則與前端一致。", d: ["BE-APPLY-1"] },
  { id: "BE-APPLY-3", page: "SSO｜算力申請與審核｜申請者｜進度追蹤", t: "案件清單與狀態查詢", s: "依身分回傳案件清單與待審核／已開通／未通過／已取消狀態。", a: "申請者只看到自己的案件，狀態與審核結果一致。", d: ["BE-AUTH-3"] },
  { id: "BE-APPLY-4", page: "SSO｜算力申請與審核｜申請者｜進度追蹤｜申請案件內容", t: "案件明細查詢", s: "回傳單一案件完整申請內容與審核歷程。", a: "明細與送出內容一致，越權查他人案件被拒。", d: ["BE-APPLY-3"] },
  { id: "BE-APPLY-5", page: "SSO｜算力申請與審核｜申請者｜進度追蹤｜編輯申請", t: "未通過案件更新重送", s: "更新案件內容並把狀態改回待審核，保留歷史版本。", a: "僅未通過案件可重送，重送後審核端看得到新舊差異。", d: ["BE-APPLY-1"] },
  { id: "BE-APPLY-6", page: "SSO｜算力申請與審核｜申請者｜進度追蹤", t: "取消申請", s: "把案件轉為已取消並封鎖後續編輯。", a: "僅本人或有權者可取消，已開通案件不得直接取消。", d: ["BE-APPLY-3"] },
  { id: "BE-APPLY-7", page: "SSO｜算力申請與審核｜申請者｜進度追蹤", t: "已開通服務停用", s: "停用該案的 API 端點與 Key。", a: "停用後呼叫立即被拒，操作留稽核紀錄。", d: ["BE-REVIEW-3"] },
  { id: "BE-REVIEW-1", page: "SSO｜算力申請與審核｜管理者｜審核", t: "審核清單搜尋 API", s: "依案件、模型、申請者與狀態組合查詢，支援分頁。", a: "多條件交集正確，無結果回空集合。", d: ["BE-AUTH-3"] },
  { id: "BE-REVIEW-2", page: "SSO｜算力申請與審核｜管理者｜審核｜模型服務審核", t: "核定額度與有效期", s: "保存核定 TPM／RPM、有效期起訖與審核備註。", a: "額度為正整數、起訖合理，逾期案件自動失效。" },
  { id: "BE-REVIEW-3", page: "SSO｜算力申請與審核｜管理者｜審核｜模型服務審核", t: "API 端點與 Key 核發與保管", s: "核定後產生端點與 API Key，Key 僅雜湊保存並只回傳一次。", a: "資料庫不存明碼 Key，遺失只能重發不能取回。", r: "機敏憑證；洩漏等同服務被盜用。", d: ["BE-REVIEW-2"] },
  { id: "BE-REVIEW-4", page: "SSO｜算力申請與審核｜管理者｜審核｜模型服務審核", t: "退回未通過與備註", s: "把案件轉未通過並保存退回備註。", a: "備註為必填，申請者端可讀到退回原因。", d: ["BE-REVIEW-1"] },
  { id: "BE-REVIEW-5", page: "SSO｜算力申請與審核｜管理者｜審核｜模型服務詳細資料", t: "案件安全監控設定保存", s: "保存該案的 PII 個資監控／LLM Guard／Keyword Matching 啟用狀態。", a: "設定變更後即時套用到攔截執行點。", d: ["BE-SEC-3"] },
  { id: "BE-REVIEW-6", page: "SSO｜算力申請與審核｜管理者｜審核｜模型服務詳細資料", t: "憑證讀取與遮罩策略", s: "端點與 Key 的讀取權限、遮罩規則與存取稽核。", a: "預設遮罩，完整值需額外授權且每次讀取留紀錄。", d: ["BE-REVIEW-3"] },
  { id: "BE-PROJ-1", page: "SSO｜算力排程與工作負載", t: "專案清單與用量查詢", s: "回傳專案配額、已用量與模型服務數。", a: "用量與叢集實際狀態一致。" },
  { id: "BE-PROJ-2", page: "SSO｜算力排程與工作負載｜新建專案", t: "建立專案 API", s: "建立專案並套用 CPU／RAM 配額與管理員設定。", a: "同名專案擋下，建立後 namespace 就緒。" },
  { id: "BE-PROJ-3", page: "SSO｜算力排程與工作負載｜新建專案｜往下", t: "GPU 分配與超賣防護", s: "GPU 卡分配的獨占／共享語意與併發搶佔檢查。", a: "同一張卡不會被兩個專案同時獨占，併發請求只有一方成功。", r: "併發下最易超賣，需資料庫層鎖定。", d: ["BE-PROJ-2"] },
  { id: "BE-PROJ-4", page: "SSO｜算力排程與工作負載｜專案詳情", t: "專案詳情與服務清單查詢", s: "回傳單一專案的配額用量與其下模型服務清單與狀態。", a: "服務狀態與實際部署一致。", d: ["BE-PROJ-1"] },
  { id: "BE-PROJ-5", page: "SSO｜算力排程與工作負載｜專案詳情｜編輯節點配置", t: "專案配額更新", s: "更新 CPU／RAM 配額並處理縮容對執行中服務的影響。", a: "配額不得低於已用量，違反時回明確錯誤。", d: ["BE-PROJ-4"] },
  { id: "BE-SVC-1", page: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務", t: "建立模型服務與部署排程", s: "依表單建立服務、排程到 GPU 節點並回報部署狀態。", a: "部署為非同步作業，狀態可查詢，失敗有原因。", d: ["BE-PROJ-3"] },
  { id: "BE-SVC-2", page: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務", t: "連接埠與掛載驗證", s: "埠號衝突、保留埠與掛載路徑合法性檢查。", a: "衝突或非法路徑被拒且錯誤指向對應列。", d: ["BE-SVC-1"] },
  { id: "BE-SVC-3", page: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜新環境", t: "自帶 Docker 映像拉取與掃描", s: "拉取指定映像、驗證來源並做漏洞掃描。", a: "不受信任來源或高風險映像被拒並回原因。", r: "外部映像是供應鏈風險入口。", d: ["BE-SVC-1"] },
  { id: "BE-SVC-4", page: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜底部", t: "推論參數與自動擴展設定", s: "保存 Temperature／Max Tokens／Context Window 與自動擴展、詳細日誌開關。", a: "參數上限依所選模型能力校驗，自動擴展有上下界。", d: ["BE-SVC-1"] },
  { id: "BE-SVC-5", page: "SSO｜算力排程與工作負載｜模型服務詳情｜資訊", t: "服務基本資訊查詢", s: "回傳服務狀態、模型來源、端點與部署資訊。", a: "資訊與實際容器狀態一致。", d: ["BE-SVC-1"] },
  { id: "BE-SVC-6", page: "SSO｜算力排程與工作負載｜模型服務詳情｜資源", t: "服務資源用量查詢", s: "回傳該服務 CPU／RAM／GPU 用量時序。", a: "時序連續且與叢集指標對齊。", d: ["BE-CLUSTER-1"] },
  { id: "BE-SVC-7", page: "SSO｜算力排程與工作負載｜模型服務詳情｜API監控", t: "API 呼叫統計查詢", s: "依專案彙總呼叫次數、Token 用量與錯誤率。", a: "統計與追蹤日誌原始資料可對帳。", d: ["BE-TRACE-1"] },
  { id: "BE-SVC-8", page: "SSO｜算力排程與工作負載｜模型服務詳情｜API監控", t: "API Key 停用", s: "停用指定專案的 API Key 並即時生效。", a: "停用後呼叫被拒，操作留稽核紀錄。", d: ["BE-REVIEW-3"] },
  { id: "BE-SVC-9", page: "SSO｜算力排程與工作負載｜模型服務詳情｜設定", t: "服務重啟與停止", s: "執行重新啟動與停止並回報中間狀態。", a: "狀態轉換可觀察，重複指令不造成不一致。", r: "會中斷線上流量，需權限與確認機制。", d: ["BE-SVC-5"] },
  { id: "BE-SVC-10", page: "SSO｜算力排程與工作負載｜模型服務詳情｜設定｜變更資源分配", t: "服務資源分配變更", s: "更新該服務 CPU／RAM 配額並處理是否需重新排程。", a: "超過專案剩餘配額時被拒，變更後用量正確。", d: ["BE-PROJ-5"] },
  { id: "BE-SVC-11", page: "SSO｜算力排程與工作負載｜模型服務詳情｜設定｜確認刪除模型", t: "刪除服務與資源回收", s: "刪除模型服務、回收 GPU 與儲存並清理 namespace 資源。", a: "刪除後配額釋放，殘留資源為零，操作留稽核。", r: "不可復原；需明確界定連帶刪除範圍與保留期。", d: ["BE-SVC-1"] },
  { id: "BE-SVC-12", page: "SSO｜算力排程與工作負載｜模型服務詳情｜日誌", t: "服務日誌查詢與串流", s: "提供分頁查詢與即時串流兩種日誌讀取。", a: "長日誌不拖垮回應，串流可中斷續接。", d: ["BE-SVC-5"] },
  { id: "BE-SVC-13", page: "SSO｜算力排程與工作負載｜模型服務詳情｜資訊", t: "容器終端機通道", s: "以 WebSocket 提供容器互動終端，含權限控管與指令稽核。", a: "無權者無法開啟通道，所有指令留紀錄，閒置自動斷線。", r: "等同容器內任意執行；權限設計錯誤即為重大風險。", d: ["BE-AUTH-3"] },
  { id: "BE-SVC-14", page: "SSO｜算力排程與工作負載｜模型服務詳情｜資訊", t: "容器封裝為模型版本", s: "把執行中容器封裝為新模型版本並登錄到模型倉庫。", a: "封裝為非同步長時作業，完成後倉庫可見新版本，失敗可重試。", d: ["BE-MODEL-4"] },
  { id: "BE-SEC-1", page: "SSO｜安全監控", t: "安全事件統計查詢", s: "彙總攔截次數、類型分布與趨勢供安全監控頁呈現。", a: "統計與攔截紀錄可對帳。" },
  { id: "BE-SEC-2", page: "SSO｜安全監控｜編輯攔截關鍵字", t: "攔截關鍵字清單維護", s: "關鍵字新增、移除與重複檢查，變更即時生效。", a: "重複或空字串被拒，變更後新請求即依新清單攔截。" },
  { id: "BE-SEC-3", page: "SSO｜安全監控", t: "PII／LLM Guard／關鍵字攔截執行點", s: "在推論請求路徑上依各案設定執行三種攔截並記錄命中。", a: "命中即攔並記錄，未啟用項目不影響延遲。", r: "攔截在熱路徑上，實作不當直接拉高推論延遲。", d: ["BE-SEC-2"] },
  { id: "BE-TRACE-1", page: "SSO｜追蹤日誌", t: "追蹤清單查詢與時間篩選", s: "依今／昨／本月／本季／本年與自訂區間查詢追蹤紀錄。", a: "區間邊界規則明確，大區間仍可分頁。" },
  { id: "BE-TRACE-2", page: "SSO｜追蹤日誌｜追蹤詳情", t: "追蹤明細查詢", s: "回傳單筆追蹤的請求、回應、Token 用量與耗時。", a: "明細與清單該列一致，敏感內容依權限遮罩。", d: ["BE-TRACE-1"] },
  { id: "BE-TRACE-3", page: "SSO｜追蹤日誌｜管理報表｜系統運作", t: "管理報表彙總計算", s: "計算系統運作、系統成效與依賴狀況三種報表的區間彙總。", a: "三種報表同區間數字互相一致且可回溯到原始追蹤。", d: ["BE-TRACE-1"] },
  { id: "BE-TRACE-4", page: "SSO｜追蹤日誌｜管理報表｜系統運作", t: "報表匯出檔產生", s: "非同步產生匯出檔並提供短效期下載連結。", a: "大區間不阻塞請求，連結逾期失效。", d: ["BE-TRACE-3"] },
  { id: "BE-ACCT-1", page: "SSO｜帳號與權限管理｜介接公務系統", t: "公務系統帳號同步", s: "定期或觸發式同步外部公務系統帳號與部門資訊。", a: "同步後清單與來源一致，衝突有處理規則且不可由平台改寫來源。", d: ["BE-AUTH-1"] },
  { id: "BE-ACCT-2", page: "SSO｜帳號與權限管理｜系統自管帳號", t: "自管帳號查詢與搜尋", s: "依名稱、部門與郵件查詢自管帳號清單。", a: "搜尋含部分比對，支援分頁。" },
  { id: "BE-ACCT-3", page: "SSO｜帳號與權限管理｜系統自管帳號｜新增使用者", t: "新增自管帳號", s: "建立帳號並指派角色，郵件唯一性檢查。", a: "重複郵件被拒，建立後角色即生效。", d: ["BE-AUTH-3"] },
  { id: "BE-ACCT-4", page: "SSO｜帳號與權限管理｜系統自管帳號｜編輯帳號資訊", t: "更新自管帳號與角色", s: "更新帳號欄位與角色，角色調降即時收斂權限。", a: "更新後該使用者可見範圍立即依新角色計算。", d: ["BE-ACCT-3"] },
  { id: "BE-ACCT-5", page: "SSO｜帳號與權限管理｜系統自管帳號", t: "刪除自管帳號", s: "以軟刪除方式停用帳號並保留稽核痕跡。", a: "刪除後無法登入，稽核紀錄仍可查，誤刪可復原。", r: "前端無二次確認，後端須要求明確確認參數。", d: ["BE-ACCT-4"] },
  { id: "BE-X-1", page: "登入", t: "全域稽核日誌", s: "所有寫入與破壞性操作（核定、停用、刪除、配額變更、憑證讀取）留誰在何時對何物做了什麼。", a: "每筆破壞性操作皆可追溯到操作者與時間。", d: ["BE-AUTH-3"] },
  { id: "BE-X-2", page: "登入", t: "統一錯誤與空狀態契約", s: "錯誤碼、欄位級錯誤與空資料的回應格式統一。", a: "前端可依欄位對應顯示錯誤，空集合與錯誤可區分。" },
  { id: "BE-X-3", page: "SSO｜算力申請與審核｜管理者｜審核｜模型服務審核", t: "TPM／RPM 限流執行", s: "依核定額度在推論入口執行 Token 與請求數限流。", a: "超額請求被拒並回可辨識錯誤，用量統計與追蹤日誌一致。", d: ["BE-REVIEW-2"] },
];

/**
 * 逐後端工項的下游落點政策：
 *  - "self"：mobagel 自己做完（含對外部系統的整合，如刑事局 SSO），單 leg。
 *  - "investigate"：泳道圖與四份 spec 都判不出誰做，待查（不派給 gary／leadtek）。
 *  - { party, endpoints }：真正做事的是 gary 或 leadtek，鏈的形狀由宣告鏈硬底線決定。
 * **不寫鏈**——鏈是宣告在泳道圖上的，driver 只說目標方與端點。
 */
type Policy = "self" | "investigate" | { party: string; endpoints: string[] };

const POLICY: Record<string, Policy> = {
  // 身分與權限：業主定調權限一律只有 mobagel 實作，gary 與 leadtek 都不管權限。
  "BE-AUTH-1": "self", // SSO 單一簽入整合＝mobagel 對接外部刑事局 SSO（泳道 m_back1 → m_sso）
  "BE-AUTH-2": "self",
  "BE-AUTH-3": "self",
  "BE-AUTH-4": "self",

  // 模型倉庫。
  "BE-MODEL-1": { party: "leadtek", endpoints: ["GET /api/v1/models"] },
  "BE-MODEL-2": {
    party: "leadtek",
    endpoints: [
      "POST /api/v1/models/chunks",
      "PATCH /api/v1/models/chunks/{chunkID}",
      "POST /api/v1/models/chunks/{id}/finalize",
    ],
  },
  "BE-MODEL-3": {
    party: "leadtek",
    endpoints: [
      "GET /api/v1/projects/{projectID}/models/{modelID}/download",
      "GET /api/v1/projects/{projectID}/models/{modelID}/download/ws",
    ],
  },
  // 落點仍是 gary：泳道上模型服務只能經 gary，模型 metadata／版本原本也由 gary 的
  // model-registry 承接。但 2026-08-03 換入的四份 gary spec 已不含 /model-registry/v1/*，
  // leadtek 的 aidms 同樣沒有任何模型版本／狀態端點，所以端點集留空——由 partyChainOf 在
  // 實作 leg 的 scope 標明「現有 spec 未提供」，不改派也不假裝配到端點。
  "BE-MODEL-4": { party: "gary", endpoints: [] },

  // 叢集資源。
  "BE-CLUSTER-1": {
    party: "leadtek",
    endpoints: ["GET /api/v1/grafana/{path}", "GET /api/v1/nodes/{nodeID}/allocation"],
  },
  "BE-CLUSTER-2": "self", // 30 秒推播頻率是 mobagel 前端閘道自訂
  "BE-CLUSTER-3": {
    party: "leadtek",
    endpoints: [
      "GET /api/v1/projects/{id}/resource_list/allocation",
      "GET /api/v1/nodes/disk-usage",
    ],
  },

  // 申請流程：申請單資料模型與狀態機是 mobagel 自有；HITL 審核任務載體在 gary。
  "BE-APPLY-1": { party: "gary", endpoints: ["POST /hitl/v1/tasks"] },
  "BE-APPLY-2": "self",
  "BE-APPLY-3": "self",
  "BE-APPLY-4": "self",
  "BE-APPLY-5": "self",
  "BE-APPLY-6": "self",
  "BE-APPLY-7": {
    party: "gary",
    endpoints: [
      "DELETE /llm/v1/projects/{project_id}/clients/{client_id}",
      "PATCH /llm/v1/projects/{project_id}/clients/{client_id}",
    ],
  },

  // 審核與核發。
  "BE-REVIEW-1": "self",
  "BE-REVIEW-2": {
    party: "gary",
    endpoints: [
      "PATCH /llm/v1/projects/{project_id}/team/limits",
      "PATCH /llm/v1/projects/{project_id}/clients/{client_id}/limits",
    ],
  },
  "BE-REVIEW-3": {
    party: "gary",
    endpoints: ["POST /llm/v1/projects/create", "POST /llm/v1/projects/{project_id}/clients"],
  },
  "BE-REVIEW-4": { party: "gary", endpoints: ["POST /hitl/v1/tasks/{hitl_task_id}/decisions"] },
  "BE-REVIEW-5": "investigate",
  "BE-REVIEW-6": { party: "gary", endpoints: ["GET /llm/v1/projects/{project_id}/clients"] },

  // 專案與配額。
  "BE-PROJ-1": {
    party: "leadtek",
    endpoints: ["GET /api/v1/projects", "GET /api/v1/projects/{id}/resource_list/allocation"],
  },
  "BE-PROJ-2": { party: "leadtek", endpoints: ["POST /api/v1/projects"] },
  "BE-PROJ-3": {
    party: "leadtek",
    endpoints: [
      "PUT /api/v1/projects/{project_id}/resources",
      "GET /api/v1/nodes/{nodeID}/allocation",
    ],
  },
  "BE-PROJ-4": {
    party: "leadtek",
    endpoints: ["GET /api/v1/projects/{id}", "GET /api/v1/projects/{projectID}/jobs/llm"],
  },
  "BE-PROJ-5": { party: "leadtek", endpoints: ["PUT /api/v1/projects/{project_id}/resources"] },

  // 模型服務生命週期。
  "BE-SVC-1": { party: "leadtek", endpoints: ["POST /api/v1/projects/{projectID}/jobs/llm"] },
  "BE-SVC-2": "self",
  "BE-SVC-3": "investigate",
  "BE-SVC-4": {
    party: "leadtek",
    endpoints: ["PATCH /api/v1/projects/{project_id}/jobs/llm/{job_id}"],
  },
  "BE-SVC-5": {
    party: "leadtek",
    endpoints: ["GET /api/v1/projects/{projectID}/jobs/llm/{jobID}"],
  },
  "BE-SVC-6": {
    party: "leadtek",
    endpoints: [
      "GET /api/v1/projects/{projectID}/jobs/llm/{jobID}/description",
      "GET /api/v1/grafana/{path}",
    ],
  },
  "BE-SVC-7": { party: "gary", endpoints: ["GET /trace-link/v1/litellm/usage-summary"] },
  "BE-SVC-8": {
    party: "gary",
    endpoints: ["PATCH /llm/v1/projects/{project_id}/clients/{client_id}"],
  },
  "BE-SVC-9": {
    party: "leadtek",
    endpoints: [
      "POST /api/v1/projects/{projectID}/jobs/llm/{jobID}/restart",
      "POST /api/v1/projects/{projectID}/jobs/llm/{jobID}/stop",
      "POST /api/v1/projects/{projectID}/jobs/llm/{jobID}/start",
    ],
  },
  "BE-SVC-10": {
    party: "leadtek",
    endpoints: ["PUT /api/v1/projects/{projectID}/jobs/llm/{jobID}/resources"],
  },
  "BE-SVC-11": {
    party: "leadtek",
    endpoints: ["DELETE /api/v1/projects/{projectID}/jobs/llm/{jobID}"],
  },
  "BE-SVC-12": {
    party: "leadtek",
    endpoints: ["GET /api/v1/projects/{projectID}/jobs/llm/{jobID}/logs"],
  },
  "BE-SVC-13": {
    party: "leadtek",
    endpoints: ["GET /api/v1/projects/{projectID}/jobs/llm/{jobID}/terminal"],
  },
  "BE-SVC-14": {
    party: "leadtek",
    endpoints: ["POST /api/v1/projects/{projectID}/jobs/llm/{jobID}/commit"],
  },

  // 安全監控。
  "BE-SEC-1": { party: "gary", endpoints: ["GET /audit/v1/events"] },
  "BE-SEC-2": "investigate", // 攔截關鍵字清單維護在四份 spec 內找不到對應端點
  "BE-SEC-3": {
    party: "gary",
    endpoints: [
      "POST /runtime-guard/v1/input-scan",
      "POST /runtime-guard/v1/output-scan",
      "POST /runtime-guard/v1/rag-context-scan",
    ],
  },

  // 追蹤與報表。
  "BE-TRACE-1": { party: "gary", endpoints: ["GET /trace-link/v1/langfuse/traces"] },
  "BE-TRACE-2": {
    party: "gary",
    endpoints: [
      "GET /trace/v1/traces/{target_trace_id}/timeline",
      "GET /trace-payload/v1/traces/{target_trace_id}/payloads",
    ],
  },
  "BE-TRACE-3": { party: "gary", endpoints: ["GET /trace-link/v1/litellm/usage-summary"] },
  "BE-TRACE-4": "self", // 報表口徑與匯出檔產生自建

  // 帳號。
  "BE-ACCT-1": "investigate", // 公務系統帳號同步在四份 spec 內沒有對應
  "BE-ACCT-2": { party: "leadtek", endpoints: ["GET /api/v1/users"] },
  "BE-ACCT-3": { party: "leadtek", endpoints: ["POST /api/v1/users"] },
  "BE-ACCT-4": {
    party: "leadtek",
    endpoints: [
      "PATCH /api/v1/users/{userID}",
      "PATCH /api/v1/projects/{project_id}/users/{user_id}/role",
    ],
  },
  "BE-ACCT-5": { party: "leadtek", endpoints: ["DELETE /api/v1/users/{userID}"] },

  // 橫切。
  // 稽核：可歸責到人的日誌只能在 mobagel 端寫——mobagel 對 leadtek 用共用 admin 帳號、
  // 對 gary 的呼叫不附帶使用者身分，下游日誌不作為歸責依據，所以單 leg 落 mobagel。
  "BE-X-1": "self",
  "BE-X-2": "self", // 統一錯誤與空狀態契約是 mobagel 閘道自訂
  "BE-X-3": {
    party: "gary",
    endpoints: [
      "PATCH /llm/v1/projects/{project_id}/team/limits",
      "PATCH /llm/v1/projects/{project_id}/clients/{client_id}/limits",
    ],
  },
};

/** 平台自建方＝唯一前端閘道，也是每條鏈的第一段。 */
const SELF = "mobagel";

/**
 * 由一筆後端工項與它的下游落點，接出這筆工項的分工鏈。
 * 鏈的形狀照宣告鏈：落在 gary 就是 mobagel → gary，落在 leadtek 就是
 * mobagel → gary → leadtek。中繼段（gary）帶不帶端點**由 gary 自己的 capability 決定**，
 * 不寫死——gary 的 Gary-AIDMS-2.0.json 是 leadtek AIDMS API 的代理（掛 /api/AIDMS-2.0，
 * 端點字串與 leadtek 那份逐字相同），把它一律當純通道會在交付物上抹掉一個已存在的代理層。
 * 每個 leg 都自帶散文——交付物上一個 leg 一列、一列一個 A。
 */
function partyChainOf(
  item: { id: string; title: string; scope: string; acceptance: string },
  garyEndpoints: ReadonlySet<string>,
): PartyLeg[] {
  const policy = POLICY[item.id];
  if (policy === undefined) throw new Error(`POLICY 缺後端工項 ${item.id} 的下游落點`);
  if (policy === "investigate") return [{ party: NEEDS_INVESTIGATION, vendorEndpoints: [] }];
  if (policy === "self") return [{ party: SELF, vendorEndpoints: [] }];

  const target = policy.party;
  const gateway: PartyLeg = {
    party: SELF,
    vendorEndpoints: [],
    title: `${item.title}－mobagel 閘道轉呼`,
    scope: `前端一律只呼叫 mobagel；由 mobagel 的「AI 資源控管平台」後端承接此請求，在 mobagel 端完成身分與授權判定後經 gary API gateway 轉呼下游 ${target}，並將回應整形為前端契約。權限判定只在 mobagel，${target} 不做逐使用者權限檢查。`,
    acceptance: `前端不直接呼叫 ${target}；請求經 mobagel 授權後穿 gary API gateway 轉發，gateway 層與下游的逾時與錯誤都由 mobagel 收斂為統一錯誤契約（見 BE-X-2、BE-EXTRA-02）。`,
  };
  // 端點集空＝落點判得出來、但該方現有 spec 沒有對應端點。契約要求 vendor 與 vendorEndpoints
  // 成對，所以這種 leg 與中繼段同形（兩者都留空），事實寫進 scope——而不是硬配一條相近的端點，
  // 後者會讓 spec 缺口在交付物上消失。
  const hasEndpoints = policy.endpoints.length > 0;
  const implementation: PartyLeg = {
    party: target,
    ...(hasEndpoints ? { vendor: target } : {}),
    vendorEndpoints: policy.endpoints,
    title: `${item.title}－${target} 實作`,
    scope: hasEndpoints
      ? item.scope
      : `${item.scope}（${target} 現有 spec 未提供對應端點，需該方補齊後回填。）`,
    acceptance: item.acceptance,
  };
  if (target === "gary") return [gateway, implementation];

  // 三段鏈的中繼段：gary 代理了哪幾條由它自己的 spec 說，driver 不寫死也不猜。
  // 全都代理到了就指名 vendor 並列端點；有缺口就把缺的那幾條寫進 scope 要該方補齊。
  const proxied = policy.endpoints.filter((e) => garyEndpoints.has(e));
  const notProxied = policy.endpoints.filter((e) => !garyEndpoints.has(e));
  const relay: PartyLeg = {
    party: "gary",
    ...(proxied.length ? { vendor: "gary" } : {}),
    vendorEndpoints: proxied,
    title: `${item.title}－gary API gateway 代理`,
    scope: proxied.length
      ? `gary 的 spec 已代理下列 ${target} 端點（掛在 /api/AIDMS-2.0）：${proxied.join("、")}。此段只做代理轉發，不實作 ${item.title} 的業務邏輯。${
          notProxied.length
            ? `另有 ${notProxied.join("、")} 在 gary 現有 spec 找不到對應代理端點，需該方補齊後回填。`
            : ""
        }`
      : `gary 需開代理 API 轉呼 ${target}，現有 spec 未提供對應端點；此段只做轉發，不實作 ${item.title} 的業務邏輯。`,
    acceptance: `mobagel 的請求經 gary 代理端點抵達 ${target} 並取回回應，代理保留呼叫端身分與追蹤識別，逾時與錯誤以可辨識的形式回傳給 mobagel。`,
  };
  return [gateway, relay, implementation];
}

const pageKey = (p: { route: string; tab?: string }) => `${p.route} ${p.tab ?? ""}`;
const feId = (pageIndex: number, actionIndex: number) =>
  `FE-${String(pageIndex + 1).padStart(2, "0")}-${String(actionIndex + 1).padStart(2, "0")}`;

/** 逐頁組出前端工項；順序與 id 逐字對齊 workflow.json 的 actions 索引。 */
function buildFrontend(workflow: ReturnType<typeof loadWorkflowForBreakdown>): WorkItemInput[] {
  // 每個 Page 由「哪個操作」開啟——作為該頁首筆工項的 dependsOn，依 workflow.json 的去向算出。
  const opener = new Map<string, string>();
  workflow.pages.forEach((p, i) => {
    p.actions.forEach((a, j) => {
      if (!a.destination) return;
      const k = pageKey(a.destination);
      if (k === pageKey(p) || opener.has(k)) return;
      opener.set(k, feId(i, j));
    });
  });

  const frontend: WorkItemInput[] = [];
  workflow.pages.forEach((page, i) => {
    const specific = SPECIFIC[page.tab ?? ""];
    if (!specific) throw new Error(`缺少此頁的前端工項：${page.tab}`);
    const specificCount = page.actions.filter((a) => !NAV.test(a.label)).length;
    expect(specific, `${page.tab} 的非導覽工項數需等於非導覽操作數`).toHaveLength(specificCount);

    let cursor = 0;
    page.actions.forEach((action, j) => {
      const raw = NAV.test(action.label) ? navItem(action.label) : specific[cursor++];
      const inbound = opener.get(pageKey(page));
      frontend.push({
        id: feId(i, j),
        sourcePage: page.tab === undefined ? { route: page.route } : { route: page.route, tab: page.tab },
        title: raw.t,
        scope: `${raw.s}（畫面操作：${action.label}）`,
        acceptance: raw.a,
        dependsOn: j === 0 && inbound ? [inbound] : [],
        risk: raw.r ?? "",
      });
    });
  });

  return frontend;
}

/** 由 BACKEND 表與派工政策組出後端工項（含分工鏈）。中繼段的端點由 gary capability 決定。 */
function buildBackend(
  workflow: ReturnType<typeof loadWorkflowForBreakdown>,
  garyEndpoints: ReadonlySet<string>,
): WorkItemInput[] {
  const byTab = new Map(workflow.pages.map((p) => [p.tab ?? "", p]));
  const backend: WorkItemInput[] = BACKEND.map((b) => {
    const page = byTab.get(b.page);
    if (!page) throw new Error(`後端工項 ${b.id} 的 page 不存在於 workflow.pages：${b.page}`);
    return {
      id: b.id,
      sourcePage: page.tab === undefined ? { route: page.route } : { route: page.route, tab: page.tab },
      title: b.t,
      scope: b.s,
      acceptance: b.a,
      dependsOn: b.d ?? [],
      risk: b.r ?? "",
      partyChain: partyChainOf(
        { id: b.id, title: b.t, scope: b.s, acceptance: b.a },
        garyEndpoints,
      ),
    };
  });

  return backend;
}

test("f2w-breakdown：劃分前端／後端工項與分工鏈並落地 workitems.json", () => {
  const workflow = loadWorkflowForBreakdown(OUTPUT_ROOT, PROJECT);

  // 派工輸入自動發現：泳道名、宣告鏈與各方 capability 都由目錄慣例掃出來，driver 不扛政策表。
  const inputs = discoverPartyInputs(SPEC_ROOT, PROJECT);
  for (const line of inputs.report) console.log(line);
  expect(inputs.parties).toEqual(["mobagel", "gary", "leadtek"]);
  expect(inputs.declaredChains).toEqual([
    ["mobagel"],
    ["mobagel", "gary"],
    ["mobagel", "gary", "leadtek"],
  ]);

  // gary 代理了哪些端點由它自己的 spec 說；中繼段照這份集合帶端點，不寫死。
  const garyEndpoints = endpointsByVendor(inputs.capabilities).get("gary") ?? new Set<string>();
  const frontend = buildFrontend(workflow);
  const backend = buildBackend(workflow, garyEndpoints);

  // 存檔前套上人工修訂；後端 id 漂掉的那些會變孤兒，只發 warning。
  const revisions = loadProjectRevisions(WORKSPACE_ROOT, PROJECT);
  const { workitems, warnings } = buildWorkitems(workflow, frontend, backend, {
    revisions,
    declaredChains: inputs.declaredChains,
    parties: inputs.parties,
    capabilities: inputs.capabilities,
  });
  expect(workitems.frontend).toHaveLength(workflow.pages.reduce((n, p) => n + p.actions.length, 0));
  expect(workitems.backend.map((i) => i.id)).toEqual(
    expect.arrayContaining(BACKEND.map((b) => b.id)),
  );

  // 不拆項：後端筆數等於推論出來的筆數＋修訂 upsert 補的兩筆，id 集合不被改寫。
  expect(workitems.backend).toHaveLength(60);
  const lengths = workitems.backend.map((i) => i.partyChain!.length);
  const dist = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
  for (const n of lengths) dist[n] = (dist[n] ?? 0) + 1;
  expect(dist).toEqual({ 1: 21, 2: 15, 3: 24 });

  // 三段鏈逐字是宣告鏈第三條；中繼段帶 gary 自己代理的那幾條端點（gary 的 AIDMS spec 與
  // leadtek 那份端點字串逐字相同，所以這 24 筆全部代理得到），scope 寫出它只做代理轉發。
  const threeLeg = workitems.backend.filter((i) => i.partyChain!.length === 3);
  expect(threeLeg).toHaveLength(24);
  for (const item of threeLeg) {
    const chain = item.partyChain!;
    expect(chain.map((l) => l.party)).toEqual(["mobagel", "gary", "leadtek"]);
    expect(chain[1]!.vendor).toBe("gary");
    expect(chain[1]!.vendorEndpoints).toEqual(chain[2]!.vendorEndpoints);
    expect(chain[1]!.scope).toContain("gary 的 spec 已代理");
    expect(chain[1]!.scope).not.toContain("未提供對應端點");
  }

  // 後端修訂的孤兒比例：spec 假設「補漏比改錯常見」，這裡把數字量出來。
  const backendSets = revisions.filter(
    (r) => r.op === "set" && typeof r.anchor === "string" && r.anchor.startsWith("BE-"),
  ).length;
  const orphaned = warnings.filter((w) => w.includes("BE-")).length;
  console.log(`後端 set 修訂 ${backendSets} 筆，其中孤兒 ${orphaned} 筆`);
  for (const w of warnings) console.warn(w);

  saveWorkitems(OUTPUT_ROOT, PROJECT, workitems);
});

test("f2w-breakdown-export：一個 leg 一列展開並落地 workitems.xlsx", async () => {
  const workitems = loadWorkitemsForExport(OUTPUT_ROOT, PROJECT);
  expect(hasPartyChains(workitems)).toBe(true);

  const wb = buildWorkitemsWorkbook(workitems);
  expect(wb.worksheets.map((w) => w.name)).toEqual([
    OVERVIEW_SHEET,
    FRONTEND_SHEET,
    BACKEND_SHEET,
  ]);
  expect(wb.getWorksheet(FRONTEND_SHEET)!.rowCount - 1).toBe(workitems.frontend.length);

  const backend = wb.getWorksheet(BACKEND_SHEET)!;
  const legTotal = workitems.backend.reduce((n, i) => n + i.partyChain!.length, 0);
  expect(backend.rowCount - 1).toBe(legTotal);
  expect(legTotal).toBe(123);

  const header = (backend.getRow(1).values as unknown[]).slice(1).map(String);
  expect(header).toEqual([...BACKEND_SOURCED_COLUMNS]);
  const col = (name: string) => header.indexOf(name) + 1;
  const cell = (r: number, name: string) => String(backend.getRow(r).getCell(col(name)).value ?? "");

  // 每列的來源狀態都是配對·待確認；畫押欄逐列留白。
  for (let r = 2; r <= backend.rowCount; r++) {
    expect(cell(r, "來源狀態")).toBe(SOURCING_STATUS_LABEL);
    for (const blank of ["估時", "優先級", "R", "A", "C", "I", "簽核日期", "狀態"]) {
      expect(cell(r, blank)).toBe("");
    }
  }

  // gary 中繼列：24 筆三段鏈各一列，供應商為 gary、端點與同組 leadtek 那一列相同（代理層），
  // 分工段 2/3，且標題／範疇／驗收都不等於同組 leadtek 那一列。
  const rows = Array.from({ length: backend.rowCount - 1 }, (_, i) => i + 2);
  const relays = rows.filter((r) => cell(r, "分工段") === "2/3");
  expect(relays).toHaveLength(24);
  for (const r of relays) {
    expect(cell(r, "派工方")).toBe("gary");
    expect(cell(r, "供應商")).toBe("gary");
    expect(cell(r, "供應商端點")).not.toBe("");
    expect(cell(r, "供應商端點")).toBe(cell(r + 1, "供應商端點"));
    for (const field of ["標題", "範疇", "驗收標準"]) {
      expect(cell(r, field)).not.toBe(cell(r + 1, field));
    }
  }

  // 列標籤：多 leg 是 <工項id>#<leg序>，單 leg 是裸 id。
  const labels = rows.map((r) => cell(r, "工項ID"));
  expect(labels).toContain("BE-MODEL-1#1");
  expect(labels).toContain("BE-MODEL-1#2");
  expect(labels).toContain("BE-MODEL-1#3");
  expect(labels).toContain("BE-AUTH-1");

  const path = await saveWorkitemsWorkbook(OUTPUT_ROOT, PROJECT, wb);
  console.log(
    `SAVED ${path} | frontend=${workitems.frontend.length} backend=${workitems.backend.length} rows=${legTotal}`,
  );
});

test("重跑冪等，且非宣告鏈的方序列讓整步丟錯不落地", () => {
  const workflow = loadWorkflowForBreakdown(OUTPUT_ROOT, PROJECT);
  const inputs = discoverPartyInputs(SPEC_ROOT, PROJECT);
  const revisions = loadProjectRevisions(WORKSPACE_ROOT, PROJECT);
  const options = {
    revisions,
    declaredChains: inputs.declaredChains,
    parties: inputs.parties,
    capabilities: inputs.capabilities,
  };
  const garyEndpoints = endpointsByVendor(inputs.capabilities).get("gary") ?? new Set<string>();

  // 落檔後的 workitems.json 就是上一支 test 的產物；照同一組輸入再組一次要逐字相同
  // （不再有拆項造成的 id 改寫，所以連跑兩次的 id 集合與 partyChain 都不動）。
  const saved = loadWorkitemsForExport(OUTPUT_ROOT, PROJECT);
  const again = buildWorkitems(
    workflow,
    buildFrontend(workflow),
    buildBackend(workflow, garyEndpoints),
    options,
  ).workitems;
  expect(again.backend.map((i) => i.id)).toEqual(saved.backend.map((i) => i.id));
  expect(again.backend.map((i) => i.partyChain)).toEqual(saved.backend.map((i) => i.partyChain));

  // 手動把一筆的方序列改成不在宣告鏈上的 mobagel > leadtek：整步丟錯、指名該筆。
  const tampered = buildBackend(workflow, garyEndpoints).map((b) =>
    b.id === "BE-MODEL-1"
      ? {
          ...b,
          partyChain: [b.partyChain![0]!, b.partyChain![2]!],
        }
      : b,
  );
  const call = () => buildWorkitems(workflow, buildFrontend(workflow), tampered, options);
  expect(call).toThrow(WorkitemsConsistencyError);
  expect(call).toThrow(/BE-MODEL-1：mobagel > leadtek/);
});
