import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { buildDiagram, loadWorkflowForDiagram, renderDiagram, saveDiagram } from "../src/diagram";

// f2w-diagram 驅動：讀回 workflow.json，組出 Navigation diagram 並寫成 workflow.drawio，
// 最後用 draw.io CLI 匯出 PNG 當「這份檔真的打得開」的驗證。
const OUTPUT_ROOT = "output";
const PROJECT = "new_0724_AI六大模組管理平台_桃園智發會_最新版";

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

test("f2w-diagram 產出 workflow.drawio（Navigation diagram）", { timeout: 180_000 }, () => {
  const workflow = loadWorkflowForDiagram(OUTPUT_ROOT, PROJECT);
  const diagram = buildDiagram(workflow);

  // 每個 Page 一個節點，散在各 Section 分頁上。
  const pageNodes = diagram.pages.flatMap((page) =>
    page.nodes.filter((node) => node.kind === "page"),
  );
  expect(pageNodes.length).toBe(workflow.pages.length);

  const path = saveDiagram(OUTPUT_ROOT, PROJECT, renderDiagram(diagram));
  const edges = diagram.pages.reduce((sum, page) => sum + page.edges.length, 0);
  // eslint-disable-next-line no-console
  console.log(
    `SAVED ${path} | diagrams=${diagram.pages.length} pageNodes=${pageNodes.length} edges=${edges}`,
  );
  for (const page of diagram.pages) {
    // eslint-disable-next-line no-console
    console.log(`  PAGE ${page.name} nodes=${page.nodes.length} edges=${page.edges.length}`);
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
  // --all-pages：多分頁後只匯第 1 頁等於沒驗到 Section 分頁。
  const png = join(mkdtempSync(join(tmpdir(), "f2w-diagram-export-")), "nav.png");
  execFileSync(
    exe,
    ["--export", "--format", "png", "--all-pages", "--scale", "1", "--border", "20", "-o", png, path],
    { timeout: 150_000, stdio: "pipe" },
  );
  expect(existsSync(png)).toBe(true);
  // eslint-disable-next-line no-console
  console.log(`EXPORT OK ${png} (${statSync(png).size} bytes)`);
});
