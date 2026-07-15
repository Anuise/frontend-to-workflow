import { readFileSync } from "node:fs";
import { z } from "zod";
import { UNIQUE_PAGE_IDS_MESSAGE, hasUniquePageIds, pageIdSchema } from "./page";
import { validate } from "./validate";

/** 一個 Page 清單項目：Page 識別（route + 可選 tab）＋對應截圖檔名。 */
export const pageEntrySchema = pageIdSchema.extend({
  screenshot: z.string().min(1),
});

/**
 * pages.json（Page 清單契約）：f2w-capture 列舉出的所有 Page。
 * 每個 Page 識別（route + tab）必須唯一——正規化後等價的 URL 不應重複列出。
 */
export const pagesSchema = z
  .object({
    project: z.string().min(1),
    pages: z.array(pageEntrySchema).min(1),
  })
  .refine((v) => hasUniquePageIds(v.pages), {
    message: UNIQUE_PAGE_IDS_MESSAGE,
    path: ["pages"],
  });

export type PageEntry = z.infer<typeof pageEntrySchema>;
export type Pages = z.infer<typeof pagesSchema>;

/** 驗證一個（已解析的）pages 物件。 */
export function parsePages(data: unknown): Pages {
  return validate("pages.json", pagesSchema, data);
}

/** 讀取並驗證 pages.json 檔（JSON）。 */
export function loadPages(path: string): Pages {
  return parsePages(JSON.parse(readFileSync(path, "utf8")));
}
