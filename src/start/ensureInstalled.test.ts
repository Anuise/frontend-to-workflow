import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Manifest } from "../contracts/manifest";
import { ensureInstalled } from "./launch";

// install 指令寫一個 marker，讓測試能觀察「install 是否真的被執行」。
const INSTALL_SCRIPT = 'import { writeFileSync } from "node:fs";\nwriteFileSync("installed.marker", "ok");\n';

function makeManifest(): Manifest {
  return {
    project: "demo",
    install: "node install.mjs",
    start: "node server.mjs",
    port: 4173,
    baseUrl: "http://localhost:4173",
  };
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "f2w-install-"));
  writeFileSync(join(dir, "install.mjs"), INSTALL_SCRIPT);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const installed = () => existsSync(join(dir, "installed.marker"));

describe("ensureInstalled", () => {
  it("宣告相依且無 node_modules 時，執行 manifest.install", async () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { "left-pad": "1.0.0" } }),
    );
    await ensureInstalled(makeManifest(), dir);
    expect(installed()).toBe(true);
  });

  it("已有 node_modules 時略過安裝", async () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { "left-pad": "1.0.0" } }),
    );
    mkdirSync(join(dir, "node_modules"));
    await ensureInstalled(makeManifest(), dir);
    expect(installed()).toBe(false);
  });

  it("未宣告相依時略過安裝（純前端無相依專案不會白跑 install）", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { start: "node server.mjs" } }));
    await ensureInstalled(makeManifest(), dir);
    expect(installed()).toBe(false);
  });
});
