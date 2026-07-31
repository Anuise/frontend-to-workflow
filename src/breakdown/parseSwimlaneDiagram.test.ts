import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SwimlaneDiagramError,
  derivePartyChains,
  parseSwimlaneDiagram,
} from "./parseSwimlaneDiagram";

// 本 repo 的實檔當 fixture：它同時涵蓋 parent 鏈、掛 root 需幾何補判（l_apiserver／m_front1）、
// 泳道外節點（n_ext）、純標籤 cell、圖例色塊五種形態。
const REAL_DIAGRAM =
  "workspace/spec/new_0724_AI六大模組管理平台_桃園智發會_最新版/桃園刑大ai_platform.drawio";

function partyOf(graph: ReturnType<typeof parseSwimlaneDiagram>, id: string) {
  return graph.nodes.find((n) => n.id === id)?.party;
}

describe("parseSwimlaneDiagram（實檔）", () => {
  const graph = parseSwimlaneDiagram(REAL_DIAGRAM);

  it("泳道名逐字是三個分工方", () => {
    expect(graph.parties).toEqual(["mobagel", "gary", "leadtek"]);
  });

  it("掛在 root 的節點靠矩形包含補判落到正確的方", () => {
    expect(partyOf(graph, "l_apiserver")).toBe("leadtek");
    expect(partyOf(graph, "m_front1")).toBe("mobagel");
  });

  it("泳道外節點歸屬為「非任一方」，它的邊不產生方層跳躍但列進 warnings", () => {
    expect(graph.nodes.find((n) => n.id === "n_ext")).toEqual({
      id: "n_ext",
      value: "外部 AP（呼叫端）",
    });
    expect(graph.warnings.some((w) => w.includes("e5") && w.includes("n_ext"))).toBe(true);
  });

  it("純標籤 cell 與圖例色塊都不出現在 nodes", () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const id of ["m_swlbl", "g_swlbl", "l_swlbl", "l_hwlbl", "l_aidms", "leg_note"]) {
      expect(ids.has(id)).toBe(false);
    }
    for (const id of ["leg_m", "leg_g", "leg_l", "leg_db"]) {
      expect(ids.has(id)).toBe(false);
    }
  });

  it("方層跳躍含 mobagel → gary 與 gary → leadtek，不含 mobagel → leadtek", () => {
    expect(graph.partyEdges).toContainEqual(["mobagel", "gary"]);
    expect(graph.partyEdges).toContainEqual(["gary", "leadtek"]);
    expect(graph.partyEdges).not.toContainEqual(["mobagel", "leadtek"]);
  });

  it("邊 e9 純由 parent 鏈就解析出 gary → leadtek，不依賴幾何", () => {
    // g_dlp 掛 lane_g、g_agent 掛 lane_l，兩者都不需矩形包含補判。
    expect(partyOf(graph, "g_dlp")).toBe("gary");
    expect(partyOf(graph, "g_agent")).toBe("leadtek");
  });

  it("宣告鏈切成三條，frontend 這個 token 被丟掉", () => {
    expect(graph.declaredChains).toEqual([
      ["mobagel"],
      ["mobagel", "gary"],
      ["mobagel", "gary", "leadtek"],
    ]);
    expect(derivePartyChains(graph)).toEqual(graph.declaredChains);
  });

  it("宣告鏈的每個相鄰跳躍都有邊圖支持，不發交叉檢查 warning", () => {
    expect(graph.warnings.filter((w) => w.includes("宣告鏈"))).toEqual([]);
  });
});

describe("parseSwimlaneDiagram（合成輸入）", () => {
  function write(xml: string): { root: string; path: string } {
    const root = mkdtempSync(join(tmpdir(), "f2w-swimlane-"));
    const path = join(root, "diagram.drawio");
    writeFileSync(path, xml, "utf8");
    return { root, path };
  }

  it("非合法 mxfile 丟 SwimlaneDiagramError", () => {
    const { root, path } = write("<html><body>不是圖</body></html>");
    try {
      expect(() => parseSwimlaneDiagram(path)).toThrow(SwimlaneDiagramError);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("備份檔名的圖仍正常解析——檔名排除是掃描層的職責，不在本函式", () => {
    const { root } = write("<x/>");
    const path = join(root, ".$diagram.drawio.bkp");
    writeFileSync(
      path,
      [
        '<mxfile><diagram><mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" />',
        '<mxCell id="lane_a" value="alpha" style="swimlane;" parent="1" vertex="1"><mxGeometry x="0" y="0" width="100" height="100" as="geometry" /></mxCell>',
        "</root></mxGraphModel></diagram></mxfile>",
      ].join(""),
      "utf8",
    );
    try {
      expect(parseSwimlaneDiagram(path).parties).toEqual(["alpha"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("宣告鏈的相鄰跳躍在圖上沒有邊支持時發 warning、不中止", () => {
    const { root, path } = write(
      [
        '<mxfile><diagram><mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" />',
        '<mxCell id="lane_a" value="alpha" style="swimlane;" parent="1" vertex="1"><mxGeometry x="0" y="0" width="100" height="100" as="geometry" /></mxCell>',
        '<mxCell id="lane_b" value="beta" style="swimlane;" parent="1" vertex="1"><mxGeometry x="0" y="100" width="100" height="100" as="geometry" /></mxCell>',
        '<mxCell id="decl" value="① alpha → beta" style="rounded=1;" parent="1" vertex="1"><mxGeometry x="0" y="300" width="100" height="20" as="geometry" /></mxCell>',
        "</root></mxGraphModel></diagram></mxfile>",
      ].join(""),
    );
    try {
      const graph = parseSwimlaneDiagram(path);
      expect(graph.declaredChains).toEqual([["alpha", "beta"]]);
      expect(graph.warnings.some((w) => w.includes("找不到對應的邊"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
