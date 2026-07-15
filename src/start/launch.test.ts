import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadManifest } from "../contracts/manifest";
import { type LaunchHandle, launchProject } from "./launch";

const sampleProjectDir = join(process.cwd(), "fixtures/sample-project");
const manifest = loadManifest(join(process.cwd(), "fixtures/contracts/manifest.yml"));

let handle: LaunchHandle | undefined;
afterEach(async () => {
  await handle?.stop();
  handle = undefined;
});

describe("launchProject", () => {
  it("依 Manifest 實際啟動 sample-project 至可存取，stop() 後釋放 port", async () => {
    handle = await launchProject(manifest, sampleProjectDir, { timeoutMs: 30_000 });

    const res = await fetch(manifest.baseUrl);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Sample Frontend｜首頁");

    await handle.stop();
    handle = undefined;
    // 停掉後不再有人監聽該 port，連線應被拒。
    await expect(fetch(manifest.baseUrl)).rejects.toBeDefined();
  }, 40_000);
});
