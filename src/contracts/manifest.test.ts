import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadManifest, manifestSchema, parseManifest } from "./manifest";
import { ContractValidationError } from "./validate";

const validManifest = {
  project: "sample-frontend",
  install: "npm install",
  start: "npm run start",
  port: 4173,
  baseUrl: "http://localhost:4173",
};

describe("parseManifest", () => {
  it("接受合法 Manifest", () => {
    const m = parseManifest(validManifest);
    expect(m.project).toBe("sample-frontend");
    expect(m.port).toBe(4173);
  });

  it("拒絕非法 Manifest 並丟 ContractValidationError", () => {
    const invalid: unknown[] = [
      { ...validManifest, install: undefined },
      { ...validManifest, port: 3.5 },
      { ...validManifest, port: 70000 },
      { ...validManifest, baseUrl: "not-a-url" },
      { ...validManifest, project: "" },
    ];
    for (const bad of invalid) {
      expect(() => parseManifest(bad)).toThrow(ContractValidationError);
    }
  });
});

describe("loadManifest", () => {
  it("讀取並驗證手寫 fixture manifest.yml", () => {
    const m = loadManifest(join(process.cwd(), "fixtures/contracts/manifest.yml"));
    expect(manifestSchema.safeParse(m).success).toBe(true);
    expect(m.project.length).toBeGreaterThan(0);
  });
});
