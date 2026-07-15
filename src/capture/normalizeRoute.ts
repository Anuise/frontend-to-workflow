/**
 * 把一個 href（絕對、站台根相對、或相對路徑）正規化成站內的正規化路由。
 *
 * 這是 f2w-capture 列舉 Page 的**確定性核心**：等價的 URL（差在 query、fragment、
 * 結尾斜線、連續斜線）都會收斂成同一條 route，確保同一個 Page 不會被重複列出。
 * 站外連結、非 http(s) 連結、以及無法解析的 href 一律回 `null`（不納入列舉）。
 *
 * 輸出保證滿足 `isNormalizedRoute`（見 src/contracts/page.ts）：以 "/" 開頭、
 * 無 query/fragment、無連續斜線、除根路由外無結尾斜線。
 *
 * @param href     頁面上抓到的連結（如 <a href>）。
 * @param baseUrl  執行中 project 的 base URL（來自 manifest），決定何謂「站內」。
 */
export function normalizeRoute(href: string, baseUrl: string): string | null {
  if (href.trim() === "") return null;

  let url: URL;
  let base: URL;
  try {
    base = new URL(baseUrl);
    url = new URL(href, base);
  } catch {
    return null; // 無法解析的 href
  }

  // 只列舉站內（同 origin）的 http(s) 連結；mailto:/tel:/javascript: 等一律排除。
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.origin !== base.origin) return null;

  // 只取 pathname——丟棄 query（?）與 fragment（#），達成等價 URL 收斂。
  return canonicalizePath(url.pathname);
}

/** 收斂連續斜線、去除非根路由的結尾斜線，得到正規化路由。 */
function canonicalizePath(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  if (collapsed === "/") return "/";
  return collapsed.replace(/\/+$/, "");
}
