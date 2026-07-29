import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VendorSpecError, endpointsByVendor, parseVendorSpec } from "./parseVendorSpec";

const spec = {
  openapi: "3.0.0",
  paths: {
    "/models": {
      parameters: [{ name: "tenant" }],
      get: {
        summary: "列出模型",
        parameters: [{ name: "page" }],
        responses: {
          "200": {
            content: { "application/json": { schema: { $ref: "#/components/schemas/ModelList" } } },
          },
        },
      },
      post: { requestBody: {}, responses: { "201": { schema: { type: "object" } } } },
    },
    "/health": { get: { responses: {} } },
  },
};

function writeSpec(name: string, body: unknown): { root: string; path: string } {
  const root = mkdtempSync(join(tmpdir(), "f2w-sourcing-spec-"));
  const path = join(root, name);
  writeFileSync(path, JSON.stringify(body), "utf8");
  return { root, path };
}

describe("parseVendorSpec", () => {
  it("把 spec 解析成 endpoint／參數／回應 schema，供應商識別名取檔名", () => {
    const { root, path } = writeSpec("Gateway-API.json", spec);
    const caps = parseVendorSpec(path);

    expect(caps.map((c) => c.endpoint)).toEqual(["GET /models", "POST /models", "GET /health"]);
    const list = caps[0]!;
    const create = caps[1]!;
    expect(list.vendor).toBe("Gateway-API");
    expect(list.summary).toBe("列出模型");
    // path 層與 operation 層的參數都要收進來
    expect(list.parameters).toEqual(["tenant", "page"]);
    expect(list.responses).toEqual([{ status: "200", schema: "ModelList" }]);
    // requestBody 記成 body；Swagger 2 式的 responses.schema 也讀得到
    expect(create.parameters).toEqual(["tenant", "body"]);
    expect(create.responses).toEqual([{ status: "201", schema: "object" }]);

    rmSync(root, { recursive: true, force: true });
  });

  it("非合法 spec（缺版本欄位、缺 paths、無端點、壞 JSON）一律丟 VendorSpecError", () => {
    const noVersion = writeSpec("a.json", { paths: {} });
    expect(() => parseVendorSpec(noVersion.path)).toThrow(VendorSpecError);

    const noPaths = writeSpec("b.json", { openapi: "3.0.0" });
    expect(() => parseVendorSpec(noPaths.path)).toThrow(/缺 paths/);

    const noEndpoint = writeSpec("c.json", { openapi: "3.0.0", paths: {} });
    expect(() => parseVendorSpec(noEndpoint.path)).toThrow(/沒有任何可用端點/);

    const broken = mkdtempSync(join(tmpdir(), "f2w-sourcing-spec-"));
    const brokenPath = join(broken, "d.json");
    writeFileSync(brokenPath, "{ not json", "utf8");
    expect(() => parseVendorSpec(brokenPath)).toThrow(VendorSpecError);

    for (const r of [noVersion.root, noPaths.root, noEndpoint.root, broken]) {
      rmSync(r, { recursive: true, force: true });
    }
  });
});

describe("endpointsByVendor", () => {
  it("以供應商分組成端點集合", () => {
    const { root, path } = writeSpec("IDP-service.json", spec);
    const byVendor = endpointsByVendor(parseVendorSpec(path));

    expect([...byVendor.keys()]).toEqual(["IDP-service"]);
    expect(byVendor.get("IDP-service")?.has("POST /models")).toBe(true);
    expect(byVendor.get("IDP-service")?.has("DELETE /models")).toBe(false);

    rmSync(root, { recursive: true, force: true });
  });
});
