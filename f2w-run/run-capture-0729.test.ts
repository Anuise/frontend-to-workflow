import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPages, savePages } from "../src/capture";
import { screenshotsPath } from "../src/output";

const OUTPUT_ROOT = "output";
const PROJECT = "0729_AI六大模組管理平台_5E_AI平台最新版";

// 瀏覽器逐一操作後截下的暫存檔（pNN.png）→ Page 識別；順序即使用者流程順序。
const CAPTURED: { temp: string; tab: string }[] = [
  { temp: "p01.png", tab: "模型倉庫" },
  { temp: "p02.png", tab: "模型倉庫｜上傳模型" },

  { temp: "p03.png", tab: "叢集資源總覽" },
  { temp: "p04.png", tab: "叢集資源總覽｜歷史資料" },
  { temp: "p05.png", tab: "叢集資源總覽｜往下" },

  { temp: "p06.png", tab: "算力排程與工作負載" },
  { temp: "p07.png", tab: "算力排程與工作負載｜新建專案" },
  { temp: "p08.png", tab: "算力排程與工作負載｜新建專案｜往下" },
  { temp: "p09.png", tab: "算力排程與工作負載｜專案詳情" },
  { temp: "p10.png", tab: "算力排程與工作負載｜專案詳情｜新增模型" },
  { temp: "p11.png", tab: "算力排程與工作負載｜專案詳情｜新增模型｜往下" },
  { temp: "p12.png", tab: "算力排程與工作負載｜專案詳情｜新增模型｜新環境" },
  { temp: "p13.png", tab: "算力排程與工作負載｜專案詳情｜用量限制" },
  { temp: "p14.png", tab: "算力排程與工作負載｜服務維護｜資訊" },
  { temp: "p15.png", tab: "算力排程與工作負載｜服務維護｜資源" },
  { temp: "p16.png", tab: "算力排程與工作負載｜服務維護｜設定" },
  { temp: "p17.png", tab: "算力排程與工作負載｜服務維護｜設定｜變更資源分配" },
  { temp: "p18.png", tab: "算力排程與工作負載｜服務維護｜設定｜確認刪除任務" },
  { temp: "p19.png", tab: "算力排程與工作負載｜服務維護｜日誌" },
  { temp: "p20.png", tab: "算力排程與工作負載｜服務維護｜描述" },

  { temp: "p21.png", tab: "代理人治理" },
  { temp: "p22.png", tab: "代理人治理｜新增代理人服務" },
  { temp: "p26.png", tab: "代理人治理｜用量調整" },
  { temp: "p23.png", tab: "代理人治理｜服務維護｜資料流水線" },
  { temp: "p24.png", tab: "代理人治理｜服務維護｜流程管理" },
  { temp: "p25.png", tab: "代理人治理｜服務維護｜版本／資料治理／部署歷程" },

  { temp: "p27.png", tab: "安全監控" },
  { temp: "p28.png", tab: "安全監控｜往下" },
  { temp: "p29.png", tab: "安全監控｜GPT-4.1" },

  { temp: "p30.png", tab: "人機協作" },
  { temp: "p31.png", tab: "人機協作｜修改回覆" },
  { temp: "p32.png", tab: "人機協作｜已修改" },

  { temp: "p33.png", tab: "追蹤日誌" },
  { temp: "p34.png", tab: "追蹤日誌｜追蹤詳情" },
  { temp: "p41.png", tab: "追蹤日誌｜品質評估" },
  { temp: "p35.png", tab: "追蹤日誌｜系統日誌" },

  { temp: "p36.png", tab: "帳號權限設定｜介接公務系統" },
  { temp: "p37.png", tab: "帳號權限設定｜系統自管帳號" },
  { temp: "p38.png", tab: "帳號權限設定｜系統自管帳號｜新增使用者" },
  { temp: "p39.png", tab: "帳號權限設定｜系統自管帳號｜編輯帳號資訊" },

  { temp: "p40.png", tab: "系統設定" },
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
