import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectManifest } from "./detect";

const sampleProjectDir = join(process.cwd(), "fixtures/sample-project");

describe("detectManifest", () => {
  it("對 sample-project fixture 偵測出安裝／啟動指令、port 與 base URL", () => {
    const m = detectManifest(sampleProjectDir, "sample-frontend");
    // 期望值來自手寫 fixtures/contracts/manifest.yml（獨立事實來源），非由偵測邏輯反推。
    expect(m).toEqual({
      project: "sample-frontend",
      install: "npm install",
      start: "npm run start",
      port: 4173,
      baseUrl: "http://localhost:4173",
    });
  });

  it("從 script 的 --port 旗標讀出真實 port（證明有讀訊號、非寫死常數）", () => {
    const dir = mkdtempSync(join(tmpdir(), "f2w-detect-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ scripts: { dev: "vite --port 3000" } }),
    );
    const m = detectManifest(dir, "demo");
    expect(m.start).toBe("npm run dev");
    expect(m.port).toBe(3000);
    expect(m.baseUrl).toBe("http://localhost:3000");
    rmSync(dir, { recursive: true, force: true });
  });
});
