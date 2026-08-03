import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTRACT_FILES,
  CONTRACT_PRODUCER,
  contractPath,
  screenshotsPath,
  timestampSuffix,
  timestampedContractPath,
} from "./output";

describe("output paths", () => {
  it("contractPath 組出 output/<project>/<file>", () => {
    expect(contractPath("output", "demo", "manifest")).toBe(join("output", "demo", "manifest.yml"));
    expect(contractPath("output", "demo", "pages")).toBe(join("output", "demo", "pages.json"));
    expect(contractPath("output", "demo", "workflow")).toBe(join("output", "demo", "workflow.json"));
    expect(contractPath("output", "demo", "workbook")).toBe(join("output", "demo", "workflow.xlsx"));
    expect(contractPath("output", "demo", "mainflow")).toBe(join("output", "demo", "mainflow.json"));
    expect(contractPath("output", "demo", "diagram")).toBe(
      join("output", "demo", "mainflow.drawio"),
    );
    expect(contractPath("output", "demo", "workitems")).toBe(
      join("output", "demo", "workitems.json"),
    );
    expect(contractPath("output", "demo", "workitemsWorkbook")).toBe(
      join("output", "demo", "workitems.xlsx"),
    );
  });

  it("screenshotsPath 指向 output/<project>/screenshots", () => {
    expect(screenshotsPath("output", "demo")).toBe(join("output", "demo", "screenshots"));
  });

  it("timestampSuffix 給出本地時間的 YYYYMMDD-HHmmss", () => {
    expect(timestampSuffix(new Date(2026, 7, 3, 15, 30, 12))).toBe("20260803-153012");
  });

  it("timestampSuffix 逐欄補零", () => {
    expect(timestampSuffix(new Date(2026, 0, 5, 4, 5, 6))).toBe("20260105-040506");
  });

  it("timestampedContractPath 把時戳插在副檔名之前", () => {
    const at = new Date(2026, 7, 3, 15, 30, 12);
    expect(timestampedContractPath("output", "demo", "workbook", at)).toBe(
      join("output", "demo", "workflow-20260803-153012.xlsx"),
    );
    expect(timestampedContractPath("output", "demo", "workitemsWorkbook", at)).toBe(
      join("output", "demo", "workitems-20260803-153012.xlsx"),
    );
  });

  it("每個契約都有對應的產出 step", () => {
    for (const contract of Object.keys(CONTRACT_FILES) as Array<keyof typeof CONTRACT_FILES>) {
      expect(CONTRACT_PRODUCER[contract]).toMatch(/^f2w-/);
    }
  });
});
