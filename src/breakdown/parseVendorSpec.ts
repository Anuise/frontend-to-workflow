import { readFileSync } from "node:fs";

/** HTTP method 在 OpenAPI path item 底下的合法鍵。 */
const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

/**
 * 一條供應商能力：某個 endpoint 加上它的參數與回應 schema。
 * `endpoint` 是「METHOD 空格 path」的正規形式，也是 vendorEndpoints 參照時要寫的字串。
 */
export interface VendorCapability {
  vendor: string;
  endpoint: string;
  method: string;
  path: string;
  summary: string;
  parameters: string[];
  responses: { status: string; schema: string }[];
}

/** Vendor spec 不是合法的 OpenAPI／Swagger 時丟出。 */
export class VendorSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendorSpecError";
  }
}

/** $ref 或 schema 物件 → 可讀的 schema 名稱（取 $ref 尾段，否則型別，再否則 inline）。 */
function schemaName(schema: unknown): string {
  if (typeof schema !== "object" || schema === null) return "inline";
  const s = schema as Record<string, unknown>;
  if (typeof s.$ref === "string") return s.$ref.split("/").pop() ?? s.$ref;
  if (typeof s.type === "string") return s.type;
  return "inline";
}

/** 參數陣列 → 參數名清單（$ref 參數取尾段當名字）。 */
function parameterNames(params: unknown): string[] {
  if (!Array.isArray(params)) return [];
  return params.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
    if (typeof o.$ref === "string") return o.$ref.split("/").pop() ?? o.$ref;
    return "(unnamed)";
  });
}

/** responses 物件 → 逐狀態碼的回應 schema 名稱。 */
function responseSchemas(responses: unknown): { status: string; schema: string }[] {
  if (typeof responses !== "object" || responses === null) return [];
  return Object.entries(responses as Record<string, unknown>).map(([status, body]) => {
    const b = (body ?? {}) as Record<string, unknown>;
    const content = b.content as Record<string, { schema?: unknown }> | undefined;
    const first = content ? Object.values(content)[0] : undefined;
    // OpenAPI 3 走 content.<media>.schema；Swagger 2 直接掛 schema。
    return { status, schema: schemaName(first?.schema ?? b.schema) };
  });
}

/**
 * 把一份 OpenAPI／Swagger 檔解析成 Vendor capability 清單（確定性，不經 AI）。
 * 供應商識別名由呼叫端傳入（＝spec 所在的目錄名，也就是分工方名，見 ADR-0018）——
 * 不再取檔名，否則沒被引用的 spec 檔名會變成合法的 party。
 * 非合法 spec（不是 JSON 物件、缺 paths）即丟 VendorSpecError。
 */
export function parseVendorSpec(specPath: string, vendor: string): VendorCapability[] {
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (e) {
    throw new VendorSpecError(`Vendor spec 不是合法 JSON：${specPath}（${(e as Error).message}）`);
  }
  if (typeof doc !== "object" || doc === null) {
    throw new VendorSpecError(`Vendor spec 不是物件：${specPath}`);
  }
  const root = doc as Record<string, unknown>;
  if (root.openapi === undefined && root.swagger === undefined) {
    throw new VendorSpecError(`Vendor spec 缺 openapi／swagger 版本欄位：${specPath}`);
  }
  const paths = root.paths;
  if (typeof paths !== "object" || paths === null) {
    throw new VendorSpecError(`Vendor spec 缺 paths：${specPath}`);
  }

  const capabilities: VendorCapability[] = [];
  for (const [path, item] of Object.entries(paths as Record<string, unknown>)) {
    if (typeof item !== "object" || item === null) continue;
    const pathItem = item as Record<string, unknown>;
    const shared = parameterNames(pathItem.parameters);
    for (const method of METHODS) {
      const op = pathItem[method];
      if (typeof op !== "object" || op === null) continue;
      const o = op as Record<string, unknown>;
      const parameters = [...shared, ...parameterNames(o.parameters)];
      if (o.requestBody !== undefined) parameters.push("body");
      capabilities.push({
        vendor,
        endpoint: `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        summary: typeof o.summary === "string" ? o.summary : "",
        parameters,
        responses: responseSchemas(o.responses),
      });
    }
  }
  if (capabilities.length === 0) {
    throw new VendorSpecError(`Vendor spec 沒有任何可用端點：${specPath}`);
  }
  return capabilities;
}

/** 供應商 → 其端點集合，供端點參照校驗使用。 */
export function endpointsByVendor(
  capabilities: readonly VendorCapability[],
): Map<string, Set<string>> {
  const byVendor = new Map<string, Set<string>>();
  for (const c of capabilities) {
    const set = byVendor.get(c.vendor) ?? new Set<string>();
    set.add(c.endpoint);
    byVendor.set(c.vendor, set);
  }
  return byVendor;
}
