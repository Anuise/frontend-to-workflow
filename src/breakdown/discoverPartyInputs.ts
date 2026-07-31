import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { type SwimlaneGraph, parseSwimlaneDiagram } from "./parseSwimlaneDiagram";
import { type VendorCapability, parseVendorSpec } from "./parseVendorSpec";

/** 一份被採用的 Vendor spec：`party` 取自它所在的目錄名（見 ADR-0018）。 */
export interface DiscoveredSpec {
  party: string;
  path: string;
}

/** 一個被掃到但沒採用的檔，附上原因——不靜默略過。 */
export interface ExcludedFile {
  path: string;
  reason: string;
}

/**
 * 一次派工輸入發現的完整結果。`report` 每次都要列給使用者看：
 * 用了哪張圖、哪幾份 spec、各自推出哪個方、哪些檔被排除與原因。刻意不落第二份清單檔。
 * `diagram` 為 undefined 即「目錄不存在」那一態——安靜照跑、不產 partyChain。
 */
export interface PartyInputs {
  specDir?: string;
  diagramPath?: string;
  diagram?: SwimlaneGraph;
  parties: string[];
  declaredChains: string[][];
  specs: DiscoveredSpec[];
  capabilities: VendorCapability[];
  excluded: ExcludedFile[];
  report: string[];
}

/** 手動指定路徑：給了就用指定的、完全忽略發現結果。 */
export interface ManualPartyInputs {
  diagramPath: string;
  specs?: readonly DiscoveredSpec[];
}

/** 派工輸入擺錯位置、或 spec 目錄名不在泳道名集合內時丟出。 */
export class PartyInputDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartyInputDiscoveryError";
  }
}

/** draw.io 的自動備份本身是合法 mxfile、內容指紋分不出來，只能依檔名排除。 */
function isBackupName(name: string): boolean {
  return name.startsWith(".$") || name.endsWith(".bkp");
}

/** 根物件帶 openapi 或 swagger 才算 Vendor spec。 */
function isOpenApiFile(path: string): boolean {
  try {
    const doc = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown> | null;
    return (
      typeof doc === "object" &&
      doc !== null &&
      (doc.openapi !== undefined || doc.swagger !== undefined)
    );
  } catch {
    return false;
  }
}

function listDirs(dir: string): string[] {
  return readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory());
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).filter((n) => statSync(join(dir, n)).isFile());
}

/** spec 目錄名必須是泳道名的子集——否則沒被畫進圖的目錄會憑空變成一個合法的 party。 */
function checkSpecDirsSubset(specs: readonly DiscoveredSpec[], parties: readonly string[]): void {
  const partySet = new Set(parties);
  const dirs = [...new Set(specs.map((s) => s.party))];
  const strays = dirs.filter((p) => !partySet.has(p));
  if (strays.length === 0) return;
  throw new PartyInputDiscoveryError(
    `spec 目錄名必須是泳道名的子集，以下目錄不在泳道名內：${strays.join("、")}` +
      `（泳道名：${parties.join("、") || "（無）"}；spec 目錄名：${dirs.join("、")}）`,
  );
}

/** 組出要列給使用者看的那份回報。 */
function buildReport(inputs: Omit<PartyInputs, "report">): string[] {
  const lines = [
    `  權責泳道圖：${inputs.diagramPath ?? "（無）"}（泳道名：${inputs.parties.join("、") || "（無）"}）`,
    `  宣告鏈：${inputs.declaredChains.map((c) => c.join(" → ")).join("；") || "（圖上沒有宣告）"}`,
  ];
  for (const s of inputs.specs) lines.push(`  Vendor spec：${s.path} → ${s.party}`);
  for (const e of inputs.excluded) lines.push(`  已排除：${e.path}（${e.reason}）`);
  for (const w of inputs.diagram?.warnings ?? []) lines.push(`  圖上的 warning：${w}`);
  return lines;
}

/**
 * 掃 `workspace/spec/<project>/` 找出本次派工要用的輸入（確定性，不經 AI）。
 *
 * 目錄慣例：project 根的 `.drawio` 是權責泳道圖（多於一張即報錯，要人指定）；
 * `<方名>/*.json` 裡過 OpenAPI 指紋的是那個方的 Vendor spec，**目錄名即分工方名**。
 * `.$*` 與 `*.bkp` 依檔名排除；不過指紋的 `.json` 也列進「已排除」並說明原因。
 *
 * 分工方集合純由泳道名決定，所以 **spec 目錄名必須是泳道名的子集**，不是即報錯並列出兩邊集合。
 *
 * 三態：
 *  1. 目錄不存在 → 安靜照跑、不產 partyChain（純自建專案什麼都不用做），回報中說明原因。
 *  2. 目錄存在但沒有任何可用檔 → 中止（那更像擺錯位置而不是不派工）。
 *  3. 手動指定 → 用指定的、忽略發現結果。
 */
export function discoverPartyInputs(
  specRoot: string,
  project: string,
  manual?: ManualPartyInputs,
): PartyInputs {
  const specDir = join(specRoot, project);

  if (manual !== undefined) {
    const diagram = parseSwimlaneDiagram(manual.diagramPath);
    const specs = [...(manual.specs ?? [])];
    checkSpecDirsSubset(specs, diagram.parties);
    const resolved = {
      specDir,
      diagramPath: manual.diagramPath,
      diagram,
      parties: diagram.parties,
      declaredChains: diagram.declaredChains,
      specs,
      capabilities: specs.flatMap((s) => parseVendorSpec(s.path, s.party)),
      excluded: [],
    };
    return {
      ...resolved,
      report: ["派工輸入（手動指定，忽略自動發現）：", ...buildReport(resolved)],
    };
  }

  if (!existsSync(specDir)) {
    return {
      parties: [],
      declaredChains: [],
      specs: [],
      capabilities: [],
      excluded: [],
      report: [`派工輸入：${specDir} 不存在，本次不產 partyChain（純自建專案不需派工）。`],
    };
  }

  const excluded: ExcludedFile[] = [];

  // 泳道圖：project 根的 .drawio
  const diagramPaths: string[] = [];
  for (const name of listFiles(specDir)) {
    if (isBackupName(name)) {
      excluded.push({ path: join(specDir, name), reason: "自動備份（依檔名排除）" });
      continue;
    }
    if (name.endsWith(".drawio")) diagramPaths.push(join(specDir, name));
  }
  if (diagramPaths.length > 1) {
    throw new PartyInputDiscoveryError(
      `${specDir} 底下有多於一張權責泳道圖，請手動指定要用哪一張：${diagramPaths.join("、")}`,
    );
  }

  // Vendor spec：<方名>/*.json，目錄名即分工方名
  const specs: DiscoveredSpec[] = [];
  for (const party of listDirs(specDir)) {
    for (const name of listFiles(join(specDir, party))) {
      const path = join(specDir, party, name);
      if (isBackupName(name)) {
        excluded.push({ path, reason: "自動備份（依檔名排除）" });
        continue;
      }
      if (!name.endsWith(".json")) {
        excluded.push({ path, reason: "不是 .json" });
        continue;
      }
      if (!isOpenApiFile(path)) {
        excluded.push({ path, reason: "不是 OpenAPI／Swagger（根物件缺 openapi／swagger 欄位）" });
        continue;
      }
      specs.push({ party, path });
    }
  }

  const diagramPath = diagramPaths[0];
  if (diagramPath === undefined && specs.length === 0) {
    throw new PartyInputDiscoveryError(
      [
        `${specDir} 存在但沒有任何可用的派工輸入（找不到權責泳道圖，也沒有過 OpenAPI 指紋的 spec）。`,
        excluded.length
          ? `已排除：${excluded.map((e) => `${e.path}（${e.reason}）`).join("、")}`
          : "",
        "不打算派工請把整個目錄移走；擺錯位置請照 workspace/spec/<project>/<方名>/ 的慣例放。",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const diagram = diagramPath === undefined ? undefined : parseSwimlaneDiagram(diagramPath);
  const parties = diagram?.parties ?? [];
  checkSpecDirsSubset(specs, parties);

  const resolved = {
    specDir,
    diagramPath,
    diagram,
    parties,
    declaredChains: diagram?.declaredChains ?? [],
    specs,
    capabilities: specs.flatMap((s) => parseVendorSpec(s.path, s.party)),
    excluded,
  };
  return { ...resolved, report: [`派工輸入（掃 ${specDir}）：`, ...buildReport(resolved)] };
}
