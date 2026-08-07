import { describe, expect, it } from "vitest";
import {
  type MainflowOutcome,
  ORPHAN_STEP_MESSAGE,
  OUTCOME_TARGET_RULE_MESSAGE,
  UNIQUE_COVERAGE_MESSAGE,
  assignedPages,
  coveredPages,
  parseMainflow,
} from "./mainflow";
import { ContractValidationError } from "./validate";

/** 一條出口：條件措辭 ＋ 目標步號 ＋ 事實憑據（憑據逐字命中 workflow.json 是 buildDiagram 的事，這層只驗形狀）。 */
const outcome = (condition: string, target: number, tab: string) => ({
  condition,
  target,
  evidence: { route: "/", tab, label: `${condition}按鈕` },
});

/** 終點步就是空 outcomes：每一步都要表態，漏寫和刻意走到底分得出來。 */
const step = (title: string, tab: string, outcomes: MainflowOutcome[] = []) => ({
  title,
  note: `${title}的說明`,
  pages: [{ route: "/", tab }],
  outcomes,
});

const valid = {
  project: "demo",
  flows: [
    {
      name: "處理訂單",
      steps: [
        step("進入首頁", "首頁", [outcome("看訂單", 2, "首頁")]),
        step("檢視清單", "清單", [outcome("開單筆", 3, "清單")]),
        step("維護單筆", "詳情"),
      ],
    },
  ],
  excludedPages: [{ route: "/", tab: "稽核", reason: "稽核紀錄，不屬任何主線" }],
};

/** 用 structuredClone 改一份再驗，避免測試之間互相污染。 */
function mutated(change: (draft: typeof valid) => void) {
  const draft = structuredClone(valid);
  change(draft);
  return () => parseMainflow(draft);
}

describe("parseMainflow", () => {
  it("接受合法的 mainflow.json", () => {
    const parsed = parseMainflow(valid);
    expect(parsed.flows[0]!.steps).toHaveLength(3);
    expect(parsed.flows[0]!.steps[2]!.outcomes).toEqual([]);
    expect(parsed.excludedPages[0]!.reason).toBe("稽核紀錄，不屬任何主線");
  });

  it("節點標題超過 12 字就擋下", () => {
    expect(mutated((d) => (d.flows[0]!.steps[0]!.title = "一二三四五六七八九十十一十二"))).toThrow(
      ContractValidationError,
    );
  });

  it("節點小字超過 30 字、出口條件超過 8 字都擋下", () => {
    expect(mutated((d) => (d.flows[0]!.steps[0]!.note = "字".repeat(31)))).toThrow(
      ContractValidationError,
    );
    expect(
      mutated((d) => (d.flows[0]!.steps[0]!.outcomes[0]!.condition = "字".repeat(9))),
    ).toThrow(ContractValidationError);
  });

  it("target 指到不存在的步號、或指向自己，都擋下", () => {
    expect(mutated((d) => (d.flows[0]!.steps[0]!.outcomes[0]!.target = 4))).toThrow(
      OUTCOME_TARGET_RULE_MESSAGE,
    );
    expect(mutated((d) => (d.flows[0]!.steps[0]!.outcomes[0]!.target = 0))).toThrow(
      OUTCOME_TARGET_RULE_MESSAGE,
    );
    expect(mutated((d) => (d.flows[0]!.steps[0]!.outcomes[0]!.target = 1))).toThrow(
      OUTCOME_TARGET_RULE_MESSAGE,
    );
  });

  it("沒被任何 target 指到的步驟擋下；終點漏寫 outcomes 也擋下", () => {
    // 第 1 步直接跳到第 3 步，第 2 步就成了圖上接不到的孤兒框
    expect(mutated((d) => (d.flows[0]!.steps[0]!.outcomes[0]!.target = 3))).toThrow(
      ORPHAN_STEP_MESSAGE,
    );
    // 中間步沒有出口，第 3 步同樣沒人指到
    expect(
      mutated((d) => {
        d.flows[0]!.steps[1]!.outcomes = [];
      }),
    ).toThrow(ORPHAN_STEP_MESSAGE);
    // 終點要明寫空陣列，漏掉 outcomes 就是沒表態
    expect(
      mutated((d) => {
        delete (d.flows[0]!.steps[2] as { outcomes?: MainflowOutcome[] }).outcomes;
      }),
    ).toThrow(ContractValidationError);
  });

  it("一步可以有多個出口：多出口就是圖上的業務決策點", () => {
    const parsed = mutated((d) => {
      d.flows[0]!.steps[1]!.outcomes = [
        outcome("開單筆", 3, "清單"),
        outcome("退回首頁", 1, "清單"),
      ];
    })();
    expect(parsed.flows[0]!.steps[1]!.outcomes.map((o) => [o.condition, o.target])).toEqual([
      ["開單筆", 3],
      ["退回首頁", 1],
    ]);
  });

  it("target 可以指回前面的步（退件重送這類迴圈）", () => {
    const parsed = mutated((d) => {
      d.flows[0]!.steps[2]!.outcomes = [outcome("退回清單", 2, "詳情")];
    })();
    expect(parsed.flows[0]!.steps[2]!.outcomes[0]!.target).toBe(2);
  });

  it("一步的主線放行（頂層分類只有一頁），零步或多於 20 步擋下", () => {
    expect(
      parseMainflow({
        ...structuredClone(valid),
        flows: [{ name: "系統設定", steps: [step("管理平台組態", "首頁")] }],
      }).flows[0]!.steps,
    ).toHaveLength(1);
    expect(
      mutated((d) => {
        d.flows[0]!.steps = [];
      }),
    ).toThrow(ContractValidationError);
    expect(
      mutated((d) => {
        d.flows[0]!.steps = [
          ...Array.from({ length: 20 }, (_, i) =>
            step(`第${i}步`, `tab${i}`, [outcome("往下", i + 2, `tab${i}`)]),
          ),
          step("最後", "尾"),
        ];
      }),
    ).toThrow(ContractValidationError);
  });

  it("同一頁出現在兩個步驟、或同時出現在 excludedPages 都擋下", () => {
    expect(mutated((d) => (d.flows[0]!.steps[1]!.pages = [{ route: "/", tab: "首頁" }]))).toThrow(
      UNIQUE_COVERAGE_MESSAGE,
    );
    expect(
      mutated((d) => d.excludedPages.push({ route: "/", tab: "首頁", reason: "重複" })),
    ).toThrow(UNIQUE_COVERAGE_MESSAGE);
  });
});

describe("assignedPages／coveredPages", () => {
  it("assignedPages 依主線與步驟順序，coveredPages 再接上落選頁", () => {
    const parsed = parseMainflow(valid);
    expect(assignedPages(parsed).map((page) => page.tab)).toEqual(["首頁", "清單", "詳情"]);
    expect(coveredPages(parsed).map((page) => page.tab)).toEqual(["首頁", "清單", "詳情", "稽核"]);
  });
});
