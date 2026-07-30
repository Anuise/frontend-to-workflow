import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  buildDiagram,
  hasMainflow,
  loadMainflowForDiagram,
  loadWorkflowForDiagram,
  mainflowPath,
  renderDiagram,
  saveDiagram,
} from "../src/diagram";

// f2w-diagram 驅動（0729 專案）：讀回 workflow.json ＋ mainflow.json，組出 Main flow diagram
// 並寫成 mainflow.drawio，最後用 draw.io CLI 匯出當「這份檔真的打得開」的驗證。
// 主線推論本身要 LLM，vitest 做不到——缺 mainflow.json 就出聲 skip，由 skill 在對話中補。
const OUTPUT_ROOT = "output";
const PROJECT = "0729_AI六大模組管理平台_5E_AI平台最新版";

/** draw.io 執行檔：DRAWIO_EXE 優先，否則掃兩個常見安裝路徑；都找不到回 null。 */
function findDrawio(): string | null {
  const candidates = [
    process.env.DRAWIO_EXE,
    process.env.LOCALAPPDATA &&
      join(process.env.LOCALAPPDATA, "Programs", "draw.io", "draw.io.exe"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "draw.io", "draw.io.exe"),
  ].filter((path): path is string => Boolean(path));
  return candidates.find((path) => existsSync(path)) ?? null;
}

test("f2w-diagram 產出 mainflow.drawio（Main flow diagram）", { timeout: 180_000 }, () => {
  if (!hasMainflow(OUTPUT_ROOT, PROJECT)) {
    // eslint-disable-next-line no-console
    console.log(
      `SKIP 缺 ${mainflowPath(OUTPUT_ROOT, PROJECT)}：主線推論要 LLM，請先跑 f2w-diagram`,
    );
    return;
  }

  const workflow = loadWorkflowForDiagram(OUTPUT_ROOT, PROJECT);
  const mainflow = loadMainflowForDiagram(OUTPUT_ROOT, PROJECT);
  const diagram = buildDiagram(workflow, mainflow);

  // 一條主線一個分頁，頁內每步一個框。
  expect(diagram.pages).toHaveLength(mainflow.flows.length);
  diagram.pages.forEach((page, index) => {
    expect(page.nodes.filter((node) => node.kind === "step")).toHaveLength(
      mainflow.flows[index]!.steps.length,
    );
  });

  const path = saveDiagram(OUTPUT_ROOT, PROJECT, renderDiagram(diagram));
  // eslint-disable-next-line no-console
  console.log(`SAVED ${path} | flows=${diagram.pages.length}`);
  for (const page of diagram.pages) {
    // eslint-disable-next-line no-console
    console.log(`  FLOW ${page.name} steps=${page.nodes.length - 2} edges=${page.edges.length}`);
  }
  for (const warning of diagram.warnings) {
    // eslint-disable-next-line no-console
    console.log(`WARNING ${warning}`);
  }

  // 匯出驗證：XML 自洽不代表工具吃得下，只有真的匯出成功才算過。
  const exe = findDrawio();
  if (!exe) {
    // eslint-disable-next-line no-console
    console.log("SKIP 匯出驗證：找不到 draw.io，設 DRAWIO_EXE 指向執行檔");
    return;
  }
  // 用 PDF 而非 PNG：draw.io CLI 的 --all-pages 對 PNG 無效（只吐第 1 頁）。
  const pdf = join(mkdtempSync(join(tmpdir(), "f2w-diagram-export-")), "mainflow.pdf");
  execFileSync(exe, ["--export", "--format", "pdf", "--all-pages", "-o", pdf, path], {
    timeout: 150_000,
    stdio: "pipe",
  });
  expect(existsSync(pdf)).toBe(true);
  // eslint-disable-next-line no-console
  console.log(`EXPORT OK ${pdf} (${statSync(pdf).size} bytes)`);
});
