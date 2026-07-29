import { describe, expect, it } from "vitest";
import type { WorkflowPage } from "../contracts/workflow";
import { SINGLE_SECTION_NAME, groupIntoSections, hierarchyPath } from "./sections";

/** 只有識別欄位有意義的 Page；purpose/content/actions 在分組上不參與。 */
function page(route: string, tab?: string): WorkflowPage {
  return { route, ...(tab ? { tab } : {}), purpose: "用途。", content: "內容。", actions: [] };
}

function shape(pages: readonly WorkflowPage[]): Array<[string, number]> {
  return groupIntoSections(pages).map((section) => [section.name, section.pages.length]);
}

describe("hierarchyPath", () => {
  it("route 的 path 段接上 tab 以全形直線切開的段", () => {
    expect(hierarchyPath({ route: "/admin/users", tab: "權限｜編輯" })).toEqual([
      "admin",
      "users",
      "權限",
      "編輯",
    ]);
  });

  it("略過空段與 index（f2w-capture 對單頁應用的慣用 route）", () => {
    expect(hierarchyPath({ route: "/index", tab: "SSO｜模型倉庫" })).toEqual(["SSO", "模型倉庫"]);
  });

  it("根路由且無 tab 時階層路徑為空", () => {
    expect(hierarchyPath({ route: "/" })).toEqual([]);
  });
});

describe("groupIntoSections", () => {
  it("依第一段分組，順序沿用 pages 原順序", () => {
    expect(
      shape([page("/admin/users"), page("/shop/cart"), page("/shop/checkout"), page("/admin/logs")]),
    ).toEqual([
      ["admin", 2],
      ["shop", 2],
    ]);
  });

  it("兩個桶共用子段名時視為橫切的模式前綴，整體往下一層", () => {
    // 驗證資料的形狀：第 0 段是登入方式，SSO 與一般登入底下都有算力申請與審核。
    const pages = [
      page("/index", "登入"),
      page("/index", "SSO｜算力申請與審核｜申請者"),
      page("/index", "SSO｜算力申請與審核｜管理者"),
      page("/index", "SSO｜追蹤日誌"),
      page("/index", "SSO｜追蹤日誌｜管理報表"),
      page("/index", "一般登入｜算力申請與審核｜申請者"),
    ];
    expect(shape(pages)).toEqual([
      ["登入", 1],
      ["算力申請與審核", 3],
      ["追蹤日誌", 2],
    ]);
  });

  it("多頁組只有一個時往下展開一層，直到出現多個多頁組", () => {
    // 沒有模式前綴重疊、但第 0 段仍不具區辨力：SSO 一個桶就裝了全部多頁內容。
    const pages = [
      page("/index", "登入"),
      page("/index", "SSO｜模型倉庫"),
      page("/index", "SSO｜模型倉庫｜上傳模型"),
      page("/index", "SSO｜叢集資源總覽"),
      page("/index", "SSO｜追蹤日誌"),
      page("/index", "SSO｜追蹤日誌｜追蹤詳情"),
      page("/index", "SSO｜追蹤日誌｜管理報表"),
    ];
    expect(shape(pages)).toEqual([
      ["登入", 1],
      ["模型倉庫", 2],
      ["叢集資源總覽", 1],
      ["追蹤日誌", 3],
    ]);
  });

  it("所有頁面階層路徑完全相同時退化成單一 Section，不爆炸", () => {
    const pages = [page("/report"), page("/report"), page("/report")];
    // 識別重複在契約層才擋；分組本身只看階層路徑。
    expect(shape(pages)).toEqual([["report", 3]]);
  });

  it("每個頁面都自成一組時視為切不出階層，收成單一 Section", () => {
    expect(
      shape([page("/"), page("/about"), page("/settings", "個人資料"), page("/orphan")]),
    ).toEqual([[SINGLE_SECTION_NAME, 4]]);
  });

  it("單一頁面時就是一個 Section", () => {
    expect(shape([page("/index", "SSO｜模型倉庫")])).toEqual([["SSO", 1]]);
  });

  it("Section 內的 Page 維持 pages 原順序", () => {
    const sections = groupIntoSections([
      page("/shop/cart"),
      page("/admin/users"),
      page("/shop/checkout"),
      page("/admin/logs"),
    ]);
    expect(sections.map((s) => s.pages.map((p) => p.route))).toEqual([
      ["/shop/cart", "/shop/checkout"],
      ["/admin/users", "/admin/logs"],
    ]);
  });
});
