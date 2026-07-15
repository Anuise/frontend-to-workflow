import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Manifest } from "../contracts/manifest";

/** 偵測不到啟動 script 時的候選 script 名稱，依偏好順序。 */
const START_SCRIPTS = ["start", "dev", "preview", "serve"] as const;

/** 偵測不到明確 port 時的預設值（vite preview 慣例）；由使用者於確認階段更正。 */
const DEFAULT_PORT = 4173;

/** lockfile → 套件管理器；決定 install 與 run 指令的寫法。 */
const LOCKFILES = [
  { file: "pnpm-lock.yaml", install: "pnpm install", run: (s: string) => `pnpm run ${s}` },
  { file: "yarn.lock", install: "yarn install", run: (s: string) => `yarn ${s}` },
  { file: "package-lock.json", install: "npm install", run: (s: string) => `npm run ${s}` },
] as const;

const NPM = { install: "npm install", run: (s: string) => `npm run ${s}` } as const;

interface PackageJson {
  scripts?: Record<string, string>;
}

/**
 * 從 project 原始碼偵測出一份候選 Manifest（尚未經使用者確認、不落地）。
 * 猜錯的欄位由 f2w-start 的確認階段更正，故此處採「盡力而為＋合理預設」。
 */
export function detectManifest(projectDir: string, project: string): Manifest {
  const pkg = readPackageJson(projectDir);
  const pm = detectPackageManager(projectDir);
  const startScript = detectStartScript(pkg);
  const port = detectPort(pkg, startScript);
  return {
    project,
    install: pm.install,
    start: pm.run(startScript),
    port,
    baseUrl: `http://localhost:${port}`,
  };
}

function readPackageJson(projectDir: string): PackageJson {
  const path = join(projectDir, "package.json");
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function detectPackageManager(projectDir: string): { install: string; run: (s: string) => string } {
  for (const lock of LOCKFILES) {
    if (existsSync(join(projectDir, lock.file))) {
      return { install: lock.install, run: lock.run };
    }
  }
  return NPM;
}

function detectStartScript(pkg: PackageJson): string {
  const scripts = pkg.scripts ?? {};
  const found = START_SCRIPTS.find((name) => name in scripts);
  if (!found) {
    throw new Error(
      `偵測不到啟動 script（找過 ${START_SCRIPTS.join("／")}）；請手動在 manifest.yml 指定 start。`,
    );
  }
  return found;
}

/** 從啟動 script 讀出明確 port（--port / -p / PORT=），讀不到就回預設。 */
function detectPort(pkg: PackageJson, startScript: string): number {
  const command = pkg.scripts?.[startScript] ?? "";
  const match = command.match(/(?:--port[ =]|-p[ =]|PORT[ =])(\d{2,5})/);
  return match ? Number(match[1]) : DEFAULT_PORT;
}
