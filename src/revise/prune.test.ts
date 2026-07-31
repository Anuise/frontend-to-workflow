import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRevisions } from "../contracts/revisions";
import {
  appendRevisions,
  loadProjectRevisions,
  revisionsArchivePath,
  revisionsPath,
} from "./inputs";
import { partitionSuperseded, pruneProjectRevisions } from "./prune";

const PROJECT = "demo";

const set = (anchor: string, field: string, value: unknown, reason: string) => ({
  target: "workitems",
  op: "set",
  anchor,
  field,
  value,
  reason,
});

const upsert = (id: string) => ({
  target: "workitems",
  op: "upsert",
  anchor: id,
  value: {
    id,
    sourcePage: { route: "/" },
    title: "補的工項",
    scope: "範疇。",
    acceptance: "驗收。",
    dependsOn: [],
    risk: "",
    inferred: true,
  },
  reason: "AI 沒推出來。",
});

const remove = (id: string) => ({
  target: "workitems",
  op: "remove",
  anchor: id,
  reason: "不做了。",
});

function workspace(revisions: readonly unknown[]): string {
  const root = mkdtempSync(join(tmpdir(), "f2w-prune-"));
  appendRevisions(root, PROJECT, revisions);
  return root;
}

describe("partitionSuperseded", () => {
  it("同作用點只留最後一筆，前面的都算 superseded", () => {
    const revisions = parseRevisions([
      set("BE-1", "title", "第一版", "一。"),
      set("BE-1", "title", "第二版", "二。"),
      set("BE-1", "title", "第三版", "三。"),
      set("BE-1", "scope", "另一個欄位", "四。"),
    ]);
    const { kept, superseded } = partitionSuperseded(revisions);
    expect(superseded.map((r) => (r.op === "set" ? r.value : null))).toEqual(["第一版", "第二版"]);
    expect(kept.map((r) => (r.op === "set" ? r.value : null))).toEqual(["第三版", "另一個欄位"]);
  });

  it("upsert 與 remove 不參與摺疊——搬走 upsert 會廢掉唯一的放棄途徑", () => {
    const revisions = parseRevisions([
      upsert("BE-EXTRA-01"),
      remove("BE-EXTRA-01"),
      upsert("BE-EXTRA-01"),
    ]);
    const { kept, superseded } = partitionSuperseded(revisions);
    expect(superseded).toEqual([]);
    expect(kept).toHaveLength(3);
  });
});

describe("pruneProjectRevisions", () => {
  it("把 superseded 搬進 revisions.archive.json，revisions.json 只留有效修訂集", () => {
    const root = workspace([
      set("BE-1", "title", "第一版", "一。"),
      set("BE-1", "title", "第二版", "二。"),
      upsert("BE-EXTRA-01"),
    ]);
    const result = pruneProjectRevisions(root, PROJECT);

    expect(result.archived).toHaveLength(1);
    expect(result.kept).toHaveLength(2);
    const kept = parseRevisions(JSON.parse(readFileSync(revisionsPath(root, PROJECT), "utf8")));
    expect(kept).toHaveLength(2);
    const archived = parseRevisions(
      JSON.parse(readFileSync(revisionsArchivePath(root, PROJECT), "utf8")),
    );
    expect(archived).toHaveLength(1);
    // upsert 一筆都沒被搬走
    expect(kept.some((r) => r.op === "upsert")).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  it("prune 前後的有效修訂集逐字相同——它買體積與可讀性，不買正確性", () => {
    const root = workspace([
      set("BE-1", "title", "第一版", "一。"),
      set("BE-1", "title", "第二版", "二。"),
      set("BE-2", "scope", "範疇。", "三。"),
    ]);
    const before = loadProjectRevisions(root, PROJECT);
    pruneProjectRevisions(root, PROJECT);
    const after = loadProjectRevisions(root, PROJECT);
    const fold = (rs: typeof before) => JSON.stringify(partitionSuperseded(rs).kept);
    expect(fold(after)).toBe(fold(before));
    rmSync(root, { recursive: true, force: true });
  });

  it("沒有 superseded 時不動任何檔", () => {
    const root = workspace([set("BE-1", "title", "唯一一版", "一。")]);
    const result = pruneProjectRevisions(root, PROJECT);
    expect(result.archived).toEqual([]);
    expect(loadProjectRevisions(root, PROJECT)).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });
  });

  it("loadProjectRevisions 不讀 revisions.archive.json", () => {
    const root = workspace([
      set("BE-1", "title", "第一版", "一。"),
      set("BE-1", "title", "第二版", "二。"),
    ]);
    pruneProjectRevisions(root, PROJECT);
    const loaded = loadProjectRevisions(root, PROJECT);
    expect(loaded).toHaveLength(1);
    expect(loaded.some((r) => r.op === "set" && r.value === "第一版")).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });
});
