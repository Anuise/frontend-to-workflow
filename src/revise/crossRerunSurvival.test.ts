import { describe, expect, it } from "vitest";
import { type WorkItemInput, buildWorkitems } from "../breakdown/buildWorkitems";
import type { Pages } from "../contracts/pages";
import { parseRevisions } from "../contracts/revisions";
import type { Workflow } from "../contracts/workflow";
import { frontendWorkitemId } from "../contracts/workitems";
import { type PageDescription, buildWorkflow } from "../describe/buildWorkflow";

// 這個檔驗的是整個 feature 的核心承諾：**上游重跑之後，人工校正還在。**
// 手法是把同一批修訂套在兩份不同的上游產出上（模擬重跑前後，其中一份多截到一頁）。

const PROJECT = "demo";
const profile = { route: "/settings", tab: "個人資料" };

/** 重跑前截到兩頁。 */
const pagesBefore: Pages = {
  project: PROJECT,
  pages: [
    { route: "/", screenshot: "home.png" },
    { route: "/settings", tab: "個人資料", screenshot: "settings-profile.png" },
  ],
};

/** 重跑後多截到一頁 /help——新頁接在最後，既有頁的序號不動。 */
const pagesAfter: Pages = {
  project: PROJECT,
  pages: [...pagesBefore.pages, { route: "/help", screenshot: "help.png" }],
};

const describePages = (pages: Pages, run: string): PageDescription[] =>
  pages.pages.map((p) => ({
    ...(p.tab === undefined ? { route: p.route } : { route: p.route, tab: p.tab }),
    purpose: `${p.tab ?? p.route} 的用途（AI 第 ${run} 次寫的）。`,
    content: `${p.tab ?? p.route} 的內容（AI 第 ${run} 次寫的）。`,
    actions: [{ label: "捲動頁面", destination: null }],
  }));

/** 一批人工校正：改一頁的用途、改 Overview。錨都是 Page 識別，重跑後仍對得上。 */
const workflowRevisions = parseRevisions([
  {
    target: "workflow",
    op: "set",
    anchor: profile,
    field: "purpose",
    value: "這頁其實是 SSO 轉導的中繼頁。",
    reason: "會議上業主指正過的說法。",
    at: "2026-07-30",
  },
  {
    target: "workflow",
    op: "set",
    anchor: "overview",
    field: "overview",
    value: "整體是一條 SSO 登入後的申請流程。",
    reason: "Overview 漏了 SSO 這一段。",
    at: "2026-07-30",
  },
]);

/** 逐頁逐操作產出前端工項，id 一律由 workflow 的陣列索引推導。 */
const frontendFor = (workflow: Workflow, run: string): WorkItemInput[] =>
  workflow.pages.flatMap((p, pi) =>
    Array.from({ length: Math.max(1, p.actions.length) }, (_, k) => ({
      id: frontendWorkitemId(pi, k),
      sourcePage: p.tab === undefined ? { route: p.route } : { route: p.route, tab: p.tab },
      title: `${p.tab ?? p.route} 的工項（AI 第 ${run} 次拆的）`,
      scope: "範疇。",
      acceptance: "驗收。",
      dependsOn: [],
      risk: "",
    })),
  );

/** 一批工項校正：改 AI 寫錯的標題、補 AI 漏拆的後端工項（自訂 id）。 */
const workitemsRevisions = parseRevisions([
  {
    target: "workitems",
    op: "set",
    anchor: "FE-02-01",
    field: "title",
    value: "個人資料表單（校正後的標題）",
    reason: "AI 每次都把這頁的工項寫得太籠統。",
    at: "2026-07-30",
  },
  {
    target: "workitems",
    op: "upsert",
    anchor: "BE-EXTRA-01",
    value: {
      id: "BE-EXTRA-01",
      sourcePage: profile,
      title: "個人資料變更稽核",
      scope: "記錄誰在何時改了哪些欄位。",
      acceptance: "每次變更可追溯到操作者。",
      dependsOn: [],
      risk: "",
      inferred: true,
    },
    reason: "AI 每次都漏拆這筆後端工項。",
    at: "2026-07-30",
  },
]);

describe("跨重跑存活（workflow）", () => {
  const before = buildWorkflow(
    pagesBefore,
    "AI 第一次寫的 Overview。",
    describePages(pagesBefore, "一"),
    workflowRevisions,
  );
  const after = buildWorkflow(
    pagesAfter,
    "AI 第二次寫的 Overview。",
    describePages(pagesAfter, "二"),
    workflowRevisions,
  );

  it("錨得住的修訂在兩份產出上結果相同", () => {
    expect(before.workflow.pages[1]?.purpose).toBe("這頁其實是 SSO 轉導的中繼頁。");
    expect(after.workflow.pages[1]?.purpose).toBe(before.workflow.pages[1]?.purpose);
    expect(after.workflow.overview).toBe(before.workflow.overview);
  });

  it("新截到的那頁不受任何修訂影響，拿到的是 AI 的新描述", () => {
    expect(after.workflow.pages).toHaveLength(3);
    expect(after.workflow.pages[2]?.purpose).toBe("/help 的用途（AI 第 二 次寫的）。");
  });

  it("沒有被錨到的既有欄位照樣吃到 AI 的新內容", () => {
    expect(after.workflow.pages[1]?.content).toContain("第 二 次");
  });

  it("沒有任何有效修訂在第二份上莫名消失", () => {
    expect(before.warnings).toEqual([]);
    expect(after.warnings).toEqual([]);
  });
});

describe("跨重跑存活（workitems）", () => {
  const wfBefore = buildWorkflow(pagesBefore, "Overview。", describePages(pagesBefore, "一")).workflow;
  const wfAfter = buildWorkflow(pagesAfter, "Overview。", describePages(pagesAfter, "二")).workflow;
  const before = buildWorkitems(wfBefore, frontendFor(wfBefore, "一"), [], { revisions: workitemsRevisions });
  const after = buildWorkitems(wfAfter, frontendFor(wfAfter, "二"), [], { revisions: workitemsRevisions });

  it("重拆後前端 id 不動，錨在 id 上的 set 在兩份上結果相同", () => {
    expect(before.workitems.frontend.map((i) => i.id)).toEqual(["FE-01-01", "FE-02-01"]);
    expect(after.workitems.frontend.map((i) => i.id)).toEqual(["FE-01-01", "FE-02-01", "FE-03-01"]);
    expect(before.workitems.frontend[1]?.title).toBe("個人資料表單（校正後的標題）");
    expect(after.workitems.frontend[1]?.title).toBe(before.workitems.frontend[1]?.title);
  });

  it("自訂 id 補的後端工項在兩份上都在", () => {
    expect(before.workitems.backend.map((i) => i.id)).toEqual(["BE-EXTRA-01"]);
    expect(after.workitems.backend).toEqual(before.workitems.backend);
  });

  it("新增的那頁拿到 AI 新拆的工項，不受修訂影響", () => {
    expect(after.workitems.frontend[2]?.title).toBe("/help 的工項（AI 第 二 次拆的）");
  });

  it("沒有任何有效修訂在第二份上莫名消失", () => {
    expect(before.warnings).toEqual([]);
    expect(after.warnings).toEqual([]);
  });
});

describe("上游真的變了時的殘餘風險（已知取捨，不是 bug）", () => {
  it("新頁插在中間讓既有頁的 id 位移時，錨在舊 id 上的修訂會落到占用該 id 的另一筆工項", () => {
    const shifted: Pages = {
      project: PROJECT,
      pages: [
        pagesBefore.pages[0]!,
        { route: "/inserted", screenshot: "inserted.png" },
        pagesBefore.pages[1]!,
      ],
    };
    const wf = buildWorkflow(shifted, "Overview。", describePages(shifted, "三")).workflow;
    const { workitems, warnings } = buildWorkitems(
      wf,
      frontendFor(wf, "三"),
      [],
      { revisions: workitemsRevisions },
    );
    // FE-02-01 現在是插進來那頁的工項，錨在該 id 的 set 就落在它身上——
    // 不會發 warning（那個 id 確實存在），而 /settings（個人資料）退到 FE-03-01、拿回 AI 的新文字。
    // 這是 ADR-0013 記下的殘餘風險：anchor 只有 id、沒有頁身分可交叉核對。
    expect(workitems.frontend[1]?.title).toBe("個人資料表單（校正後的標題）");
    expect(workitems.frontend[2]?.title).toContain("AI 第 三 次拆的");
    expect(warnings).toEqual([]);
  });
});
