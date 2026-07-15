import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTRACT_FILES,
  CONTRACT_PRODUCER,
  contractPath,
  screenshotsPath,
} from "./output";

describe("output paths", () => {
  it("contractPath 組出 output/<project>/<file>", () => {
    expect(contractPath("output", "demo", "manifest")).toBe(join("output", "demo", "manifest.yml"));
    expect(contractPath("output", "demo", "pages")).toBe(join("output", "demo", "pages.json"));
    expect(contractPath("output", "demo", "workflow")).toBe(join("output", "demo", "workflow.json"));
    expect(contractPath("output", "demo", "workbook")).toBe(join("output", "demo", "workflow.xlsx"));
  });

  it("screenshotsPath 指向 output/<project>/screenshots", () => {
    expect(screenshotsPath("output", "demo")).toBe(join("output", "demo", "screenshots"));
  });

  it("每個契約都有對應的產出 step", () => {
    for (const contract of Object.keys(CONTRACT_FILES) as Array<keyof typeof CONTRACT_FILES>) {
      expect(CONTRACT_PRODUCER[contract]).toMatch(/^f2w-/);
    }
  });
});
