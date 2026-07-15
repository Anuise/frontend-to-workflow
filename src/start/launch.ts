import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Manifest } from "../contracts/manifest";

const isWindows = process.platform === "win32";

/** 已啟動的 project handle。 */
export interface LaunchHandle {
  /** 停止已啟動的 project（連同子行程樹）。 */
  stop(): Promise<void>;
}

/** 啟動時的輪詢設定。 */
export interface LaunchOptions {
  /** 等待 baseUrl 可存取的總逾時（毫秒），預設 30000。 */
  timeoutMs?: number;
  /** 每次輪詢間隔（毫秒），預設 300。 */
  intervalMs?: number;
}

/**
 * 依 Manifest 把 project 啟動到 baseUrl 可存取為止，回傳可停止的 handle。
 * 以 manifest.port 覆寫 PORT 環境變數，確保 server 綁到 Manifest 宣告的 port。
 * 啟動指令提前結束或逾時仍連不上時，會先停掉再丟錯。
 */
export async function launchProject(
  manifest: Manifest,
  projectDir: string,
  options: LaunchOptions = {},
): Promise<LaunchHandle> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 300;

  // 啟動前必要時先安裝相依，確保 start 能跑起來（無相依或已裝過則略過）。
  await ensureInstalled(manifest, projectDir);

  const child = spawn(manifest.start, {
    cwd: projectDir,
    shell: true,
    stdio: "ignore",
    // 非 Windows 用 detached 建立 process group，stop() 才能整組收掉。
    detached: !isWindows,
    env: { ...process.env, PORT: String(manifest.port) },
  });

  const handle: LaunchHandle = { stop: () => stopChild(child) };

  try {
    await waitForReachable(manifest.baseUrl, timeoutMs, intervalMs, child);
  } catch (err) {
    await handle.stop();
    throw err;
  }
  return handle;
}

/**
 * 必要時依 Manifest 安裝相依：專案宣告了相依、且尚無 node_modules 才跑 manifest.install。
 * 無相依或已安裝過則略過，等安裝指令成功結束才回。
 */
export async function ensureInstalled(manifest: Manifest, projectDir: string): Promise<void> {
  if (!needsInstall(projectDir)) {
    return;
  }
  await runToCompletion(manifest.install, projectDir);
}

/** 專案是否需要安裝：宣告了相依（dependencies/devDependencies）且尚無 node_modules。 */
function needsInstall(projectDir: string): boolean {
  if (existsSync(join(projectDir, "node_modules"))) {
    return false;
  }
  const pkgPath = join(projectDir, "package.json");
  if (!existsSync(pkgPath)) {
    return false;
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const declared =
    Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length;
  return declared > 0;
}

/** 跑一個指令到結束；exit code 非 0 即丟錯。 */
function runToCompletion(command: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`安裝指令失敗（exit ${code}）：${command}`));
      }
    });
  });
}

/** 輪詢 baseUrl 直到收到任何 HTTP 回應（純前端下 4xx/5xx 也算起得來）。 */
async function waitForReachable(
  url: string,
  timeoutMs: number,
  intervalMs: number,
  child: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });

  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`啟動指令提前結束，無法連上 ${url}`);
    }
    try {
      await fetch(url, { signal: AbortSignal.timeout(intervalMs + 500) });
      return; // 有回應即代表 server 已可存取
    } catch {
      // 尚未起來，稍候再試
    }
    await delay(intervalMs);
  }
  throw new Error(`等待 ${url} 可存取逾時（${timeoutMs}ms）`);
}

/** 收掉子行程樹；等到行程真正結束才 resolve。 */
function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    if (isWindows) {
      // taskkill /T 連同子行程（npm→node）一起收。
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      // detached 下對 process group 送訊號。
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGKILL");
      }
    }
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
