import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { PageId } from "../contracts/page";
import { type Pages, parsePages } from "../contracts/pages";
import { contractPath } from "../output";

/**
 * 把 route 片段或 tab 名稱轉成單一安全的檔名片段：
 * 去掉路徑分隔與 Windows 保留字元、空白與換行，並收斂 ".." 以防目錄穿越。
 * 全被清掉時回退為 "page"，確保永遠是非空的單一路徑片段。
 */
function slugSegment(text: string): string {
  return (
    text
      .replace(/[\\/:*?"<>|]/g, "-") // 路徑分隔與 Windows 保留字元
      .replace(/\s+/g, "-") // 空白與換行轉連字號
      .replace(/\.{2,}/g, "-") // 杜絕 ".." 目錄穿越
      .replace(/^[-.]+|[-.]+$/g, "") || "page"
  );
}

/**
 * 由 Page 識別（route + 可選 tab）產生穩定、可讀、安全的截圖檔名。
 * 根路由用 index；巢狀 route 的斜線轉成 "-"；含 tab 時以 "--" 併入 tab。
 * 檔名恆為單一路徑片段（不含分隔字元），存於 output/<project>/screenshots/ 之下。
 */
export function screenshotFilename(id: PageId): string {
  const routePart = id.route === "/" ? "index" : slugSegment(id.route.slice(1));
  const base = id.tab ? `${routePart}--${slugSegment(id.tab)}` : routePart;
  return `${base}.png`;
}

/**
 * 由列舉出的 Page 識別清單組出並驗證一份 pages.json 物件。
 * - 每個 Page 分配唯一截圖檔名：樸素 slug 碰撞時加數字後綴，保證每頁一張不互相覆寫。
 * - 通過契約驗證（至少一頁、Page 識別唯一、route 已正規化）才回傳，否則丟 ContractValidationError。
 */
export function buildPages(project: string, pageIds: readonly PageId[]): Pages {
  const used = new Set<string>();
  const pages = pageIds.map((id) => ({
    ...id,
    screenshot: uniqueName(screenshotFilename(id), used),
  }));
  return parsePages({ project, pages });
}

/** 在已用檔名集合中取一個未用過的名字；碰撞就在副檔名前加 -2、-3…。 */
function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = name.slice(0, dot);
  const ext = name.slice(dot);
  let n = 2;
  while (used.has(`${stem}-${n}${ext}`)) n++;
  const unique = `${stem}-${n}${ext}`;
  used.add(unique);
  return unique;
}

/**
 * 把（列舉出的）pages 驗證後保存成 output/<project>/pages.json。
 * 契約驗證失敗即丟 ContractValidationError，且不落地任何檔案。
 */
export function savePages(outputRoot: string, project: string, pages: unknown): string {
  const validated = parsePages(pages); // 於寫檔前擋下不合契約的值
  const path = contractPath(outputRoot, project, "pages");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return path;
}
