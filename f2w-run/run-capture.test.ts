import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPages, savePages } from "../src/capture";
import { screenshotsPath } from "../src/output";

const OUTPUT_ROOT = "output";
const PROJECT = "new_0724_AI六大模組管理平台_桃園智發會_最新版";

// 瀏覽器逐一操作後截下的暫存檔（pNN.png）→ Page 識別；順序即使用者流程順序。
const CAPTURED: { temp: string; tab: string }[] = [
  { temp: "p01.png", tab: "登入" },

  { temp: "p03.png", tab: "SSO｜模型倉庫" },
  { temp: "p04.png", tab: "SSO｜模型倉庫｜上傳模型" },

  { temp: "p02.png", tab: "SSO｜叢集資源總覽" },

  { temp: "p05.png", tab: "SSO｜算力申請與審核｜申請者｜提出申請" },
  { temp: "p06.png", tab: "SSO｜算力申請與審核｜申請者｜進度追蹤" },
  { temp: "p07.png", tab: "SSO｜算力申請與審核｜申請者｜進度追蹤｜申請案件內容" },
  { temp: "p08.png", tab: "SSO｜算力申請與審核｜申請者｜進度追蹤｜編輯申請" },
  { temp: "p09.png", tab: "SSO｜算力申請與審核｜管理者｜審核" },
  { temp: "p10.png", tab: "SSO｜算力申請與審核｜管理者｜審核｜模型服務審核" },
  { temp: "p11.png", tab: "SSO｜算力申請與審核｜管理者｜審核｜模型服務詳細資料" },

  { temp: "p12.png", tab: "SSO｜算力排程與工作負載" },
  { temp: "p13.png", tab: "SSO｜算力排程與工作負載｜新建專案" },
  { temp: "p14.png", tab: "SSO｜算力排程與工作負載｜新建專案｜往下" },
  { temp: "p15.png", tab: "SSO｜算力排程與工作負載｜專案詳情" },
  { temp: "p16.png", tab: "SSO｜算力排程與工作負載｜專案詳情｜編輯節點配置" },
  { temp: "p17.png", tab: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務" },
  { temp: "p18.png", tab: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜往下" },
  { temp: "p19.png", tab: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜底部" },
  { temp: "p20.png", tab: "SSO｜算力排程與工作負載｜專案詳情｜建立模型服務｜新環境" },
  { temp: "p21.png", tab: "SSO｜算力排程與工作負載｜模型服務詳情｜資訊" },
  { temp: "p22.png", tab: "SSO｜算力排程與工作負載｜模型服務詳情｜資源" },
  { temp: "p23.png", tab: "SSO｜算力排程與工作負載｜模型服務詳情｜API監控" },
  { temp: "p24.png", tab: "SSO｜算力排程與工作負載｜模型服務詳情｜設定" },
  { temp: "p25.png", tab: "SSO｜算力排程與工作負載｜模型服務詳情｜設定｜變更資源分配" },
  { temp: "p26.png", tab: "SSO｜算力排程與工作負載｜模型服務詳情｜設定｜確認刪除模型" },
  { temp: "p27.png", tab: "SSO｜算力排程與工作負載｜模型服務詳情｜日誌" },
  { temp: "p28.png", tab: "SSO｜算力排程與工作負載｜模型服務詳情｜描述" },

  { temp: "p29.png", tab: "SSO｜安全監控" },
  { temp: "p30.png", tab: "SSO｜安全監控｜編輯攔截關鍵字" },

  { temp: "p31.png", tab: "SSO｜追蹤日誌" },
  { temp: "p32.png", tab: "SSO｜追蹤日誌｜追蹤詳情" },
  { temp: "p33.png", tab: "SSO｜追蹤日誌｜管理報表｜系統運作" },
  { temp: "p34.png", tab: "SSO｜追蹤日誌｜管理報表｜系統成效" },
  { temp: "p35.png", tab: "SSO｜追蹤日誌｜管理報表｜依賴狀況" },

  { temp: "p36.png", tab: "SSO｜帳號與權限管理｜介接公務系統" },
  { temp: "p37.png", tab: "SSO｜帳號與權限管理｜系統自管帳號" },
  { temp: "p38.png", tab: "SSO｜帳號與權限管理｜系統自管帳號｜新增使用者" },
  { temp: "p39.png", tab: "SSO｜帳號與權限管理｜系統自管帳號｜編輯帳號資訊" },

  { temp: "p40.png", tab: "一般登入｜算力申請與審核｜申請者｜提出申請" },
  { temp: "p41.png", tab: "一般登入｜算力申請與審核｜申請者｜進度追蹤" },
];

describe("f2w-capture", () => {
  it("組裝 pages.json 並把暫存截圖更名為契約檔名", () => {
    const pages = buildPages(
      PROJECT,
      CAPTURED.map(({ tab }) => ({ route: "/", tab })),
    );
    expect(pages.pages).toHaveLength(CAPTURED.length);

    const dir = screenshotsPath(OUTPUT_ROOT, PROJECT);
    pages.pages.forEach((page, i) => {
      const from = join(dir, CAPTURED[i].temp);
      const to = join(dir, page.screenshot);
      if (existsSync(from)) {
        renameSync(from, to);
      }
      expect(existsSync(to)).toBe(true);
    });

    savePages(OUTPUT_ROOT, PROJECT, pages);
  });
});
