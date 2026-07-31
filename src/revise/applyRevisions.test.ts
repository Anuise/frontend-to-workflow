import { describe, expect, it } from "vitest";
import { parseRevisions } from "../contracts/revisions";
import { type Workflow, parseWorkflow } from "../contracts/workflow";
import { type Workitems, parseWorkitems } from "../contracts/workitems";
import { applyWorkflowRevisions, applyWorkitemsRevisions } from "./applyRevisions";

const workflow: Workflow = parseWorkflow({
  project: "demo",
  overview: "從首頁可前往設定頁編輯個人資料。",
  pages: [
    { route: "/", purpose: "首頁進入點。", content: "歡迎訊息與連結。", actions: [] },
    {
      route: "/settings",
      tab: "個人資料",
      purpose: "編輯個人資料。",
      content: "姓名與 Email 欄位。",
      actions: [{ label: "返回首頁", destination: { route: "/" } }],
    },
  ],
});

const workitems: Workitems = parseWorkitems({
  project: "demo",
  frontend: [
    {
      id: "FE-01-01",
      sourcePage: { route: "/" },
      title: "首頁",
      scope: "渲染歡迎訊息。",
      acceptance: "看得到連結。",
      dependsOn: [],
      risk: "",
      inferred: false,
    },
    {
      id: "FE-02-01",
      sourcePage: { route: "/settings", tab: "個人資料" },
      title: "個人資料表單",
      scope: "編輯姓名與 Email。",
      acceptance: "可提交。",
      dependsOn: ["FE-01-01"],
      risk: "",
      inferred: false,
    },
  ],
  backend: [
    {
      id: "BE-1",
      sourcePage: { route: "/settings", tab: "個人資料" },
      title: "個人資料儲存 API",
      scope: "持久化個人資料。",
      acceptance: "可讀回。",
      dependsOn: ["FE-02-01"],
      risk: "",
      inferred: true,
    },
  ],
});

/** 一筆完整的 Work item，供 upsert 使用。 */
const extraItem = (id: string, inferred: boolean, title = "AI 漏掉的工項") => ({
  id,
  sourcePage: { route: "/settings", tab: "個人資料" },
  title,
  scope: "範疇。",
  acceptance: "驗收。",
  dependsOn: [],
  risk: "",
  inferred,
});

const profile = { route: "/settings", tab: "個人資料" };
const setPurpose = (value: string) => ({
  target: "workflow",
  op: "set",
  anchor: profile,
  field: "purpose",
  value,
  reason: "校正頁面用途。",
});
const setTitle = (anchor: string, value: string) => ({
  target: "workitems",
  op: "set",
  anchor,
  field: "title",
  value,
  reason: "校正標題。",
});

const findItem = (w: Workitems, id: string) =>
  [...w.frontend, ...w.backend].find((i) => i.id === id);

describe("applyWorkflowRevisions", () => {
  it("set 覆蓋錨到的 Page 欄位，其餘頁不受影響", () => {
    const { result, warnings } = applyWorkflowRevisions(
      workflow,
      parseRevisions([setPurpose("其實是 SSO 轉導的中繼頁。")]),
    );
    expect(result.pages[1]?.purpose).toBe("其實是 SSO 轉導的中繼頁。");
    expect(result.pages[0]?.purpose).toBe("首頁進入點。");
    expect(warnings).toEqual([]);
  });

  it("set 覆蓋 overview，也覆蓋得了整組 actions", () => {
    const { result } = applyWorkflowRevisions(
      workflow,
      parseRevisions([
        {
          target: "workflow",
          op: "set",
          anchor: "overview",
          field: "overview",
          value: "整體是一條 SSO 登入後的申請流程。",
          reason: "Overview 漏了 SSO。",
        },
        {
          target: "workflow",
          op: "set",
          anchor: profile,
          field: "actions",
          value: [
            { label: "儲存後轉導", destination: { route: "/" } },
            { label: "留在原頁", destination: null },
          ],
          reason: "操作去向抓錯。",
        },
      ]),
    );
    expect(result.overview).toBe("整體是一條 SSO 登入後的申請流程。");
    expect(result.pages[1]?.actions).toHaveLength(2);
    expect(result.pages[1]?.actions[1]?.destination).toBeNull();
  });

  it("同一作用點多筆時取最後一筆", () => {
    const { result } = applyWorkflowRevisions(
      workflow,
      parseRevisions([setPurpose("第一次的說法。"), setPurpose("第二次的說法。")]),
    );
    expect(result.pages[1]?.purpose).toBe("第二次的說法。");
  });

  it("孤兒修訂保留該筆、發 warning，其餘照套", () => {
    const { result, warnings } = applyWorkflowRevisions(
      workflow,
      parseRevisions([
        {
          target: "workflow",
          op: "set",
          anchor: { route: "/ghost" },
          field: "purpose",
          value: "指向已不存在的頁。",
          reason: "上游改過 route。",
        },
        setPurpose("這一筆照樣套上。"),
      ]),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("/ghost");
    expect(result.pages[1]?.purpose).toBe("這一筆照樣套上。");
  });

  it("空修訂集時回傳的物件與輸入相同，且不改動輸入", () => {
    const { result, warnings } = applyWorkflowRevisions(workflow, []);
    expect(result).toEqual(workflow);
    expect(warnings).toEqual([]);
    applyWorkflowRevisions(workflow, parseRevisions([setPurpose("改過的用途。")]));
    expect(workflow.pages[1]?.purpose).toBe("編輯個人資料。");
  });

  it("只吃 workflow 的修訂，workitems 的那些一概不理", () => {
    const { result, warnings } = applyWorkflowRevisions(
      workflow,
      parseRevisions([setTitle("FE-01-01", "不該影響 workflow")]),
    );
    expect(result).toEqual(workflow);
    expect(warnings).toEqual([]);
  });
});

describe("applyWorkitemsRevisions", () => {
  it("set 覆蓋純量欄位與整組 dependsOn", () => {
    const { result, warnings } = applyWorkitemsRevisions(
      workitems,
      parseRevisions([
        setTitle("BE-1", "個人資料儲存與稽核 API"),
        {
          target: "workitems",
          op: "set",
          anchor: "FE-02-01",
          field: "dependsOn",
          value: ["FE-01-01", "BE-1"],
          reason: "表單要等 API 契約定案。",
        },
      ]),
    );
    expect(findItem(result, "BE-1")?.title).toBe("個人資料儲存與稽核 API");
    expect(findItem(result, "FE-02-01")?.dependsOn).toEqual(["FE-01-01", "BE-1"]);
    expect(warnings).toEqual([]);
  });

  it("upsert 的兩個分支：id 不存在則新增、已存在則整筆覆蓋", () => {
    const added = applyWorkitemsRevisions(
      workitems,
      parseRevisions([
        {
          target: "workitems",
          op: "upsert",
          anchor: "BE-EXTRA-01",
          value: extraItem("BE-EXTRA-01", true),
          reason: "AI 漏拆這筆。",
        },
      ]),
    ).result;
    expect(added.backend).toHaveLength(2);
    expect(findItem(added, "BE-EXTRA-01")?.inferred).toBe(true);

    const replaced = applyWorkitemsRevisions(
      workitems,
      parseRevisions([
        {
          target: "workitems",
          op: "upsert",
          anchor: "BE-1",
          value: extraItem("BE-1", true, "整筆換掉的後端工項"),
          reason: "整筆重寫比逐欄位改快。",
        },
      ]),
    ).result;
    expect(replaced.backend).toHaveLength(1);
    expect(findItem(replaced, "BE-1")?.title).toBe("整筆換掉的後端工項");
  });

  it("remove 刪掉一筆工項；刪不存在的 id 只發 warning", () => {
    const { result, warnings } = applyWorkitemsRevisions(
      workitems,
      parseRevisions([
        { target: "workitems", op: "remove", anchor: "BE-1", reason: "與別筆重複。" },
        { target: "workitems", op: "remove", anchor: "BE-404", reason: "上一輪就刪過了。" },
      ]),
    );
    expect(result.backend).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("BE-404");
  });

  it("upsert 與 remove 共用作用點：remove 後 upsert 同 id 則工項活著", () => {
    const { result } = applyWorkitemsRevisions(
      workitems,
      parseRevisions([
        { target: "workitems", op: "remove", anchor: "BE-1", reason: "先刪。" },
        {
          target: "workitems",
          op: "upsert",
          anchor: "BE-1",
          value: extraItem("BE-1", true, "又補回來的工項"),
          reason: "想清楚後決定留著。",
        },
      ]),
    );
    expect(findItem(result, "BE-1")?.title).toBe("又補回來的工項");
  });

  it("upsert 與 remove 共用作用點：upsert 後 remove 同 id 則被刪掉", () => {
    const { result } = applyWorkitemsRevisions(
      workitems,
      parseRevisions([
        {
          target: "workitems",
          op: "upsert",
          anchor: "BE-1",
          value: extraItem("BE-1", true, "先補"),
          reason: "先補。",
        },
        { target: "workitems", op: "remove", anchor: "BE-1", reason: "後來決定不做。" },
      ]),
    );
    expect(findItem(result, "BE-1")).toBeUndefined();
  });

  it("固定序 remove → upsert → set：set 作用在最終存在的物件上", () => {
    // 檔案順序刻意打亂：set 寫在 upsert 之前，仍套在 upsert 後的那筆工項上。
    const { result, warnings } = applyWorkitemsRevisions(
      workitems,
      parseRevisions([
        setTitle("BE-EXTRA-01", "set 後的標題"),
        {
          target: "workitems",
          op: "upsert",
          anchor: "BE-EXTRA-01",
          value: extraItem("BE-EXTRA-01", true, "upsert 帶進來的標題"),
          reason: "補漏。",
        },
      ]),
    );
    expect(findItem(result, "BE-EXTRA-01")?.title).toBe("set 後的標題");
    expect(warnings).toEqual([]);
  });

  it("除摺疊外對排列不敏感：同一組修訂換順序給入結果相同", () => {
    const raw = [
      { target: "workitems", op: "remove", anchor: "FE-02-01", reason: "重複工項。" },
      {
        target: "workitems",
        op: "upsert",
        anchor: "BE-EXTRA-01",
        value: extraItem("BE-EXTRA-01", true),
        reason: "補漏。",
      },
      setTitle("BE-1", "改過的後端標題"),
    ];
    const a = applyWorkitemsRevisions(workitems, parseRevisions(raw)).result;
    const b = applyWorkitemsRevisions(workitems, parseRevisions([raw[2]!, raw[0]!, raw[1]!])).result;
    expect(a).toEqual(b);
  });

  it("孤兒 set 保留該筆、發 warning，其餘照套", () => {
    const { result, warnings } = applyWorkitemsRevisions(
      workitems,
      parseRevisions([
        setTitle("BE-99", "錨在重跑後已消失的後端 id"),
        setTitle("FE-01-01", "這一筆照樣套上"),
      ]),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("BE-99");
    expect(findItem(result, "FE-01-01")?.title).toBe("這一筆照樣套上");
  });

  it("空修訂集時回傳的物件與輸入相同，且不改動輸入", () => {
    const { result } = applyWorkitemsRevisions(workitems, []);
    expect(result).toEqual(workitems);
    applyWorkitemsRevisions(workitems, parseRevisions([setTitle("FE-01-01", "改過的標題")]));
    expect(workitems.frontend[0]?.title).toBe("首頁");
  });
});

describe("applyWorkitemsRevisions（partyChain 與 leg 錨）", () => {
  const prose = (who: string) => ({
    title: `${who} 的標題`,
    scope: `${who} 的範疇。`,
    acceptance: `${who} 的驗收。`,
  });
  const chained: Workitems = parseWorkitems({
    ...workitems,
    backend: workitems.backend.map((i, index) =>
      index === 0
        ? {
            ...i,
            partyChain: [
              { party: "mobagel", vendorEndpoints: [], ...prose("mobagel") },
              { party: "gary", vendorEndpoints: [], ...prose("gary") },
              { party: "leadtek", vendorEndpoints: [], ...prose("leadtek") },
            ],
            sourcingConfirmed: false,
          }
        : {
            ...i,
            partyChain: [{ party: "mobagel", vendorEndpoints: [] }],
            sourcingConfirmed: false,
          },
    ),
  });
  const anchorId = chained.backend[0]!.id;

  const setPartyChain = (anchor: string, value: unknown) => ({
    target: "workitems",
    op: "set",
    anchor,
    field: "partyChain",
    value,
    reason: "派錯方。",
  });

  it("set partyChain 真的套上（防止那條 if／else 分支靜默 no-op）", () => {
    const { result } = applyWorkitemsRevisions(
      chained,
      parseRevisions([
        setPartyChain(anchorId, [{ party: "needs-investigation", vendorEndpoints: [] }]),
      ]),
    );
    expect(result.backend[0]?.partyChain).toEqual([
      { party: "needs-investigation", vendorEndpoints: [] },
    ]);
  });

  it("leg 錨的 set 只改該 leg，其餘 leg 與工項層逐字不變", () => {
    const { result, warnings } = applyWorkitemsRevisions(
      chained,
      parseRevisions([
        {
          target: "workitems",
          op: "set",
          anchor: `${anchorId}#2`,
          field: "scope",
          value: "gary 需開代理 API 轉呼 leadtek。",
          reason: "中繼段講清楚。",
        },
      ]),
    );
    const chain = result.backend[0]!.partyChain!;
    expect(chain[1]?.scope).toBe("gary 需開代理 API 轉呼 leadtek。");
    expect(chain[0]).toEqual(chained.backend[0]!.partyChain![0]);
    expect(chain[2]).toEqual(chained.backend[0]!.partyChain![2]);
    expect(result.backend[0]?.scope).toBe(chained.backend[0]?.scope);
    expect(warnings).toEqual([]);
  });

  it("leg 錨的 set partyChain 取代整段——覆蓋 party／vendor／端點的途徑", () => {
    const { result } = applyWorkitemsRevisions(
      chained,
      parseRevisions([
        setPartyChain(`${anchorId}#2`, [
          { party: "leadtek", vendorEndpoints: [], ...prose("換手的 leadtek") },
        ]),
      ]),
    );
    expect(result.backend[0]?.partyChain?.[1]?.party).toBe("leadtek");
    expect(result.backend[0]?.partyChain).toHaveLength(3);
  });

  it("leg 序超出鏈長時發孤兒 warning，不中止、不自動清除", () => {
    const { result, warnings } = applyWorkitemsRevisions(
      chained,
      parseRevisions([
        {
          target: "workitems",
          op: "set",
          anchor: `${anchorId}#9`,
          field: "title",
          value: "不存在的那一段",
          reason: "抄錯列。",
        },
      ]),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`${anchorId}#9`);
    expect(result.backend[0]?.partyChain).toEqual(chained.backend[0]?.partyChain);
  });
});
