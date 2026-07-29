import type { PageId } from "../contracts/page";
import type { WorkflowPage } from "../contracts/workflow";

/** f2w-capture 以全形直線串接 tab 麵包屑。 */
const TAB_SEPARATOR = "｜";

/** route 裡不具階層意義的段；單頁應用慣用 /index 當唯一路由。 */
const IGNORED_ROUTE_SEGMENTS = new Set(["index"]);

/** 切不出階層時，所有 Page 收進這一個 Section。 */
export const SINGLE_SECTION_NAME = "全部頁面";

/**
 * Page 的階層路徑：route 的 path 段（去掉空段與 index）接上 tab 以全形直線切開的段。
 * 深度即段數。這是 Section 分組與 Section 內 layout 的唯一依據，與邊完全無關——
 * 上游漏掉幾條操作去向時版面不會垮。
 */
export function hierarchyPath(id: PageId): string[] {
  const fromRoute = id.route
    .split("/")
    .filter((segment) => segment !== "" && !IGNORED_ROUTE_SEGMENTS.has(segment));
  const fromTab = (id.tab ?? "").split(TAB_SEPARATOR).filter((segment) => segment !== "");
  return [...fromRoute, ...fromTab];
}

/** 一條完整的路線：一群 Page ＋ 它們共同的名字；對應 draw.io 的一個分頁。 */
export interface Section {
  name: string;
  pages: WorkflowPage[];
}

/**
 * 取某頁在指定深度的段名。深度超出階層路徑時退回最後一段，
 * 連一段都沒有（根路由且無 tab）就用 route——讓每頁至少有一個穩定的桶名。
 */
function segmentAt(page: WorkflowPage, depth: number): string {
  const path = hierarchyPath(page);
  return path[depth] ?? path[path.length - 1] ?? page.route;
}

/** 依指定深度的段名分桶；桶的順序與桶內順序都沿用傳入順序。 */
function bucketize(pages: readonly WorkflowPage[], depth: number): Section[] {
  const buckets: Section[] = [];
  const byName = new Map<string, Section>();
  for (const page of pages) {
    const name = segmentAt(page, depth);
    let bucket = byName.get(name);
    if (!bucket) {
      bucket = { name, pages: [] };
      byName.set(name, bucket);
      buckets.push(bucket);
    }
    bucket.pages.push(page);
  }
  return buckets;
}

/**
 * 這一層是不是真的在分東西。
 *
 * 兩個桶共用同一個子段名（`SSO｜算力申請與審核` 與 `一般登入｜算力申請與審核`）
 * 代表這一層切的是橫切所有模組的模式前綴（登入方式），不是結構上的區隔。
 */
function isDiscriminating(buckets: readonly Section[], depth: number): boolean {
  const owner = new Map<string, number>();
  for (const [index, bucket] of buckets.entries()) {
    for (const page of bucket.pages) {
      const child = hierarchyPath(page)[depth + 1];
      if (child === undefined) continue;
      const seen = owner.get(child);
      if (seen !== undefined && seen !== index) return false;
      owner.set(child, index);
    }
  }
  return true;
}

/** 只剩一個桶裝得下 2 頁以上時，那個桶不是「其中一組」，它就是全部——往下一層。 */
function isDominatedBySingleBucket(buckets: readonly Section[]): boolean {
  return buckets.filter((bucket) => bucket.pages.length >= 2).length === 1;
}

function sameNames(a: readonly Section[], b: readonly Section[]): boolean {
  return a.length === b.length && a.every((bucket, index) => bucket.name === b[index]!.name);
}

/**
 * 把 Page 切成 Section（每個 Section 之後成為 draw.io 的一個分頁）。
 *
 * 從階層路徑第一段開始試，這一層只要不具區辨力就整體往下一層再試：
 *  - 只切出一個桶（大家第一段都一樣）；
 *  - 兩個桶共用子段名（這層是橫切的模式前綴，例如登入方式）；
 *  - 只有一個桶裝得下 2 頁以上（其餘都是單頁，那個桶就是全部）。
 *
 * 段數用完仍分不動就停。每個 Page 都自成一組時代表這份資料切不出階層，
 * 收成單一 Section——後續由 Section 內的 layout 退回分層網格處理。
 */
export function groupIntoSections(pages: readonly WorkflowPage[]): Section[] {
  if (pages.length <= 1) return bucketize(pages, 0);

  const maxDepth = Math.max(...pages.map((page) => hierarchyPath(page).length));
  let buckets = bucketize(pages, 0);
  for (let depth = 0; depth < maxDepth; depth++) {
    const settled =
      buckets.length > 1 && !isDominatedBySingleBucket(buckets) && isDiscriminating(buckets, depth);
    if (settled) break;
    const next = bucketize(pages, depth + 1);
    if (sameNames(next, buckets)) break;
    buckets = next;
  }

  if (buckets.length === pages.length) {
    return [{ name: SINGLE_SECTION_NAME, pages: [...pages] }];
  }
  return buckets;
}
