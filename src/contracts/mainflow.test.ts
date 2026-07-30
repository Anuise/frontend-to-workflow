import { describe, expect, it } from "vitest";
import {
  EDGE_LABEL_RULE_MESSAGE,
  UNIQUE_COVERAGE_MESSAGE,
  assignedPages,
  coveredPages,
  parseMainflow,
} from "./mainflow";
import { ContractValidationError } from "./validate";

const step = (title: string, tab: string, edgeLabel?: string) => ({
  title,
  note: `${title}的說明`,
  pages: [{ route: "/", tab }],
  ...(edgeLabel !== undefined && { edgeLabel }),
});

const valid = {
  project: "demo",
  flows: [
    {
      name: "處理訂單",
      steps: [
        step("進入首頁", "首頁", "看訂單"),
        step("檢視清單", "清單", "開單筆"),
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
    expect(parsed.excludedPages[0]!.reason).toBe("稽核紀錄，不屬任何主線");
  });

  it("節點標題超過 12 字就擋下", () => {
    expect(mutated((d) => (d.flows[0]!.steps[0]!.title = "一二三四五六七八九十十一十二"))).toThrow(
      ContractValidationError,
    );
  });

  it("節點小字超過 30 字、邊 label 超過 8 字都擋下", () => {
    expect(mutated((d) => (d.flows[0]!.steps[0]!.note = "字".repeat(31)))).toThrow(
      ContractValidationError,
    );
    expect(mutated((d) => (d.flows[0]!.steps[0]!.edgeLabel = "字".repeat(9)))).toThrow(
      ContractValidationError,
    );
  });

  it("edgeLabel 掛在來源步：最後一步有、或中間步沒有，都擋下", () => {
    expect(mutated((d) => (d.flows[0]!.steps[2]!.edgeLabel = "多的"))).toThrow(
      EDGE_LABEL_RULE_MESSAGE,
    );
    expect(mutated((d) => delete d.flows[0]!.steps[1]!.edgeLabel)).toThrow(EDGE_LABEL_RULE_MESSAGE);
  });

  it("一條主線少於 2 步或多於 7 步都擋下", () => {
    // 只剩一步就沒有任何轉場，不算流程
    expect(
      mutated((d) => {
        d.flows[0]!.steps = [step("只有一步", "首頁")];
      }),
    ).toThrow(ContractValidationError);
    expect(
      mutated((d) => {
        d.flows[0]!.steps = [
          ...Array.from({ length: 7 }, (_, i) => step(`第${i}步`, `tab${i}`, "往下")),
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
