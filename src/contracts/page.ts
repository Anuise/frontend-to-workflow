import { z } from "zod";

/**
 * 判斷一條路由是否為「正規化」形式。
 *
 * 正規化路由的契約（實際的正規化轉換由 f2w-capture 負責；此處只負責驗證是否已符合）：
 *  - 必須以 "/" 開頭（site-root-relative）
 *  - 不得含 query string（?）或 fragment（#）
 *  - 除根路由 "/" 外，結尾不得有多餘的 "/"
 *  - 不得含連續的 "//"
 */
export function isNormalizedRoute(route: string): boolean {
  if (!route.startsWith("/")) return false;
  if (route.includes("?") || route.includes("#")) return false;
  if (route.includes("//")) return false;
  if (route.length > 1 && route.endsWith("/")) return false;
  return true;
}

/** 正規化路由的 schema。 */
export const routeSchema = z
  .string()
  .min(1)
  .refine(isNormalizedRoute, {
    message: "route 必須是正規化路由（以 / 開頭、無 query/fragment、無連續斜線、無結尾斜線）",
  });

/**
 * Page 識別：正規化路由 +（可選）tab 名稱。
 * 同一 route 底下不同 tab 視為不同 Page，各自截圖與描述。
 */
export const pageIdSchema = z.object({
  route: routeSchema,
  tab: z.string().min(1).optional(),
});

export type PageId = z.infer<typeof pageIdSchema>;

/** 把 PageId 轉成穩定且無歧義的字串鍵，供去重與比對「操作去向」使用。 */
export function pageIdKey(id: PageId): string {
  return JSON.stringify([id.route, id.tab ?? null]);
}

/** 契約層共用的訊息：pages 內每個 Page 識別必須唯一。 */
export const UNIQUE_PAGE_IDS_MESSAGE = "pages 內每個 Page 識別（route + tab）必須唯一";

/** 判斷一組 Page 的識別（route + tab）是否彼此唯一。 */
export function hasUniquePageIds(pages: readonly PageId[]): boolean {
  return new Set(pages.map(pageIdKey)).size === pages.length;
}
