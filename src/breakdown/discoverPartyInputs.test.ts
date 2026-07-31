import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PartyInputDiscoveryError, discoverPartyInputs } from "./discoverPartyInputs";

const SPEC_ROOT = "workspace/spec";
const REAL_PROJECT = "new_0724_AI六大模組管理平台_桃園智發會_最新版";

/** 兩道泳道 alpha／beta 的最小合成圖。 */
const MINI_DIAGRAM = [
  '<mxfile><diagram><mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" />',
  '<mxCell id="lane_a" value="alpha" style="swimlane;" parent="1" vertex="1"><mxGeometry x="0" y="0" width="100" height="100" as="geometry" /></mxCell>',
  '<mxCell id="lane_b" value="beta" style="swimlane;" parent="1" vertex="1"><mxGeometry x="0" y="100" width="100" height="100" as="geometry" /></mxCell>',
  "</root></mxGraphModel></diagram></mxfile>",
].join("");

const MINI_SPEC = { openapi: "3.0.0", paths: { "/ping": { get: { responses: {} } } } };

/** 建一個 <specRoot>/<project>/ 目錄樹；回傳可當 specRoot 用的暫存根。 */
function scaffold(project: string, build: (projectDir: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), "f2w-party-inputs-"));
  const projectDir = join(root, project);
  mkdirSync(projectDir, { recursive: true });
  build(projectDir);
  return root;
}

describe("discoverPartyInputs（實檔）", () => {
  const inputs = discoverPartyInputs(SPEC_ROOT, REAL_PROJECT);

  it("掃到 1 張泳道圖與 5 份 spec，方歸屬為 gary×4 ＋ leadtek×1", () => {
    expect(inputs.diagramPath).toContain("桃園刑大ai_platform.drawio");
    expect(inputs.specs).toHaveLength(5);
    const byParty = inputs.specs.reduce<Record<string, number>>((acc, s) => {
      acc[s.party] = (acc[s.party] ?? 0) + 1;
      return acc;
    }, {});
    expect(byParty).toEqual({ gary: 4, leadtek: 1 });
  });

  it("供應商識別名來自目錄名，不是檔名", () => {
    const aidms = inputs.specs.find((s) => s.path.includes("aidms-openapi"));
    expect(aidms?.party).toBe("leadtek");
    expect(inputs.capabilities.some((c) => c.vendor === "aidms-openapi")).toBe(false);
    // 同一方目錄下多份 spec 的 capability 合併成該方一份集合
    expect([...new Set(inputs.capabilities.map((c) => c.vendor))].sort()).toEqual([
      "gary",
      "leadtek",
    ]);
  });

  it("回報列出用了哪張圖、哪幾份 spec 與各自的方", () => {
    const blob = inputs.report.join("\n");
    expect(blob).toContain("權責泳道圖");
    expect(blob).toContain("→ leadtek");
    expect(blob).toContain("宣告鏈");
  });
});

describe("discoverPartyInputs（三態與排除）", () => {
  it("目錄不存在＝安靜照跑、不產 partyChain", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-party-inputs-"));
    const inputs = discoverPartyInputs(root, "沒有這個專案");
    expect(inputs.diagram).toBeUndefined();
    expect(inputs.parties).toEqual([]);
    expect(inputs.declaredChains).toEqual([]);
    expect(inputs.report.join("\n")).toContain("不存在");
    rmSync(root, { recursive: true, force: true });
  });

  it("目錄存在但沒有任何可用檔＝中止", () => {
    const root = scaffold("demo", (dir) => writeFileSync(join(dir, "readme.txt"), "hi", "utf8"));
    expect(() => discoverPartyInputs(root, "demo")).toThrow(PartyInputDiscoveryError);
    expect(() => discoverPartyInputs(root, "demo")).toThrow(/沒有任何可用的派工輸入/);
    rmSync(root, { recursive: true, force: true });
  });

  it("手動指定＝用指定的、忽略發現結果", () => {
    const root = scaffold("demo", (dir) => {
      writeFileSync(join(dir, "discovered.drawio"), MINI_DIAGRAM, "utf8");
    });
    const other = join(root, "manual.drawio");
    writeFileSync(other, MINI_DIAGRAM, "utf8");
    const inputs = discoverPartyInputs(root, "demo", { diagramPath: other });
    expect(inputs.diagramPath).toBe(other);
    expect(inputs.report.join("\n")).toContain("手動指定");
    rmSync(root, { recursive: true, force: true });
  });

  it("備份檔依檔名排除，並出現在「已排除」清單裡", () => {
    const root = scaffold("demo", (dir) => {
      writeFileSync(join(dir, "lanes.drawio"), MINI_DIAGRAM, "utf8");
      writeFileSync(join(dir, ".$lanes.drawio.bkp"), MINI_DIAGRAM, "utf8");
      writeFileSync(join(dir, "old.bkp"), MINI_DIAGRAM, "utf8");
    });
    const inputs = discoverPartyInputs(root, "demo");
    expect(inputs.diagramPath).toContain("lanes.drawio");
    const excludedPaths = inputs.excluded.map((e) => e.path).join("\n");
    expect(excludedPaths).toContain(".$lanes.drawio.bkp");
    expect(excludedPaths).toContain("old.bkp");
    rmSync(root, { recursive: true, force: true });
  });

  it("不過 OpenAPI 指紋的 .json 被列進「已排除」並註明原因，不靜默略過", () => {
    const root = scaffold("demo", (dir) => {
      writeFileSync(join(dir, "lanes.drawio"), MINI_DIAGRAM, "utf8");
      mkdirSync(join(dir, "alpha"));
      writeFileSync(join(dir, "alpha", "good.json"), JSON.stringify(MINI_SPEC), "utf8");
      writeFileSync(join(dir, "alpha", "notes.json"), JSON.stringify({ hello: 1 }), "utf8");
    });
    const inputs = discoverPartyInputs(root, "demo");
    expect(inputs.specs.map((s) => s.path.endsWith("good.json"))).toEqual([true]);
    const excluded = inputs.excluded.find((e) => e.path.endsWith("notes.json"));
    expect(excluded?.reason).toContain("OpenAPI");
    rmSync(root, { recursive: true, force: true });
  });

  it("spec 目錄名不在泳道名內時報錯，訊息列出兩邊集合", () => {
    const root = scaffold("demo", (dir) => {
      writeFileSync(join(dir, "lanes.drawio"), MINI_DIAGRAM, "utf8");
      mkdirSync(join(dir, "acme"));
      writeFileSync(join(dir, "acme", "api.json"), JSON.stringify(MINI_SPEC), "utf8");
    });
    const call = () => discoverPartyInputs(root, "demo");
    expect(call).toThrow(PartyInputDiscoveryError);
    expect(call).toThrow(/acme/);
    expect(call).toThrow(/alpha/);
    rmSync(root, { recursive: true, force: true });
  });

  it("多於一張泳道圖時報錯，要人指定", () => {
    const root = scaffold("demo", (dir) => {
      writeFileSync(join(dir, "a.drawio"), MINI_DIAGRAM, "utf8");
      writeFileSync(join(dir, "b.drawio"), MINI_DIAGRAM, "utf8");
    });
    expect(() => discoverPartyInputs(root, "demo")).toThrow(/多於一張/);
    rmSync(root, { recursive: true, force: true });
  });
});
