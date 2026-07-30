import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OVERVIEW_ANCHOR, loadRevisionsFile, parseRevisions } from "./revisions";
import { ContractValidationError } from "./validate";

/** 一筆合法的 workflow 欄位覆蓋：錨是 Page 識別（route ＋可選 tab）。 */
const setPurpose = {
  target: "workflow",
  op: "set",
  anchor: { route: "/settings", tab: "個人資料" },
  field: "purpose",
  value: "這頁其實是 SSO 轉導的中繼頁。",
  reason: "AI 把用途寫成編輯個人資料，實際是轉導。",
  at: "2026-07-30",
};

/** 一筆合法的 workitems 工項欄位覆蓋。 */
const setTitle = {
  target: "workitems",
  op: "set",
  anchor: "FE-01-01",
  field: "title",
  value: "首頁進入點（校正後）",
  reason: "標題要與客戶的說法一致。",
};

describe("parseRevisions", () => {
  it("接受 workflow 的 purpose／content／actions／overview 覆蓋", () => {
    const revisions = parseRevisions([
      setPurpose,
      { ...setPurpose, field: "content", value: "轉導提示與倒數。" },
      {
        ...setPurpose,
        field: "actions",
        value: [{ label: "立即轉導", destination: { route: "/" } }],
      },
      {
        target: "workflow",
        op: "set",
        anchor: OVERVIEW_ANCHOR,
        field: "overview",
        value: "整體是一條 SSO 登入後的申請流程。",
        reason: "Overview 漏了 SSO 這一段。",
      },
    ]);
    expect(revisions).toHaveLength(4);
    expect(revisions[0]).toMatchObject({ field: "purpose", anchor: { tab: "個人資料" } });
    expect(revisions[3]).toMatchObject({ anchor: OVERVIEW_ANCHOR });
  });

  it("接受 workitems 的 set／upsert／remove", () => {
    const item = {
      id: "BE-EXTRA-01",
      sourcePage: { route: "/settings", tab: "個人資料" },
      title: "AI 漏掉的稽核 API",
      scope: "記錄個人資料變更。",
      acceptance: "每次變更可追溯到操作者。",
      dependsOn: [],
      risk: "",
      inferred: true,
    };
    const revisions = parseRevisions([
      setTitle,
      { ...setTitle, field: "risk", value: "" },
      { ...setTitle, field: "dependsOn", value: ["FE-01-01"] },
      {
        target: "workitems",
        op: "upsert",
        anchor: "BE-EXTRA-01",
        value: item,
        reason: "AI 漏拆這筆後端工項。",
      },
      { target: "workitems", op: "remove", anchor: "BE-1", reason: "與 BE-2 重複。" },
    ]);
    expect(revisions).toHaveLength(5);
    expect(revisions[1]).toMatchObject({ field: "risk", value: "" });
    expect(revisions[3]).toMatchObject({ op: "upsert", value: { id: "BE-EXTRA-01" } });
    expect(revisions[4]).toMatchObject({ op: "remove", anchor: "BE-1" });
  });

  it("value 型別依 field 分派：purpose 給陣列、actions 給字串都被擋下", () => {
    expect(() => parseRevisions([{ ...setPurpose, value: ["陣列不是字串"] }])).toThrow(
      ContractValidationError,
    );
    expect(() =>
      parseRevisions([{ ...setPurpose, field: "actions", value: "字串不是陣列" }]),
    ).toThrow(ContractValidationError);
  });

  it("型別錯誤時訊息指名修訂檔與筆序，不是 workflow.json", () => {
    const call = () => parseRevisions([setPurpose, { ...setPurpose, value: 42 }]);
    expect(call).toThrow(/revisions\.json（第 2 筆）/);
    expect(call).not.toThrow(/workflow\.json/);
  });

  it("workflow 搭 upsert 或 remove 被擋下", () => {
    for (const op of ["upsert", "remove"]) {
      expect(() =>
        parseRevisions([{ target: "workflow", op, anchor: "FE-01-01", reason: "不該做的事。" }]),
      ).toThrow(ContractValidationError);
    }
  });

  it("inferred 不在可覆蓋的欄位集內", () => {
    expect(() => parseRevisions([{ ...setTitle, field: "inferred", value: false }])).toThrow(
      ContractValidationError,
    );
  });

  it("upsert 的 value.id 與 anchor 不符時被擋下", () => {
    const call = () =>
      parseRevisions([
        {
          target: "workitems",
          op: "upsert",
          anchor: "BE-EXTRA-01",
          value: {
            id: "BE-EXTRA-02",
            sourcePage: { route: "/" },
            title: "t",
            scope: "s",
            acceptance: "a",
            dependsOn: [],
            risk: "",
            inferred: true,
          },
          reason: "id 打錯。",
        },
      ]);
    expect(call).toThrow(ContractValidationError);
    expect(call).toThrow(/value\.id/);
  });

  it("at 缺席時通過；格式不是 YYYY-MM-DD 時被擋下", () => {
    const { at: _at, ...withoutAt } = setPurpose;
    expect(parseRevisions([withoutAt])).toHaveLength(1);
    expect(() => parseRevisions([{ ...setPurpose, at: "2026/07/30" }])).toThrow(
      ContractValidationError,
    );
  });

  it("reason 為空字串時被擋下", () => {
    expect(() => parseRevisions([{ ...setPurpose, reason: "" }])).toThrow(ContractValidationError);
  });

  it("不是陣列或 op 不合法時被擋下", () => {
    expect(() => parseRevisions({ target: "workflow" })).toThrow(ContractValidationError);
    expect(() => parseRevisions([{ ...setPurpose, op: "patch" }])).toThrow(ContractValidationError);
  });
});

describe("loadRevisionsFile", () => {
  it("缺檔時回空陣列而非丟錯（修訂是可選的）", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-revisions-load-"));
    expect(loadRevisionsFile(join(root, "revisions.json"))).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it("讀回並驗證檔案內容", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-revisions-load-"));
    const path = join(root, "revisions.json");
    writeFileSync(path, JSON.stringify([setPurpose, setTitle]), "utf8");
    expect(loadRevisionsFile(path)).toHaveLength(2);
    rmSync(root, { recursive: true, force: true });
  });
});
