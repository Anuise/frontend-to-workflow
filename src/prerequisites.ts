import { existsSync } from "node:fs";
import {
  CONTRACT_FILES,
  CONTRACT_PRODUCER,
  type ContractName,
  contractPath,
} from "./output";

/** 缺少前置檔時丟出，訊息明確指出要先跑哪一個 step。 */
export class MissingPrerequisiteError extends Error {
  constructor(
    public readonly file: string,
    public readonly previousStep: string,
    public readonly path: string,
  ) {
    super(`缺少前置檔 ${file}，請先跑「${previousStep}」。（預期路徑：${path}）`);
    this.name = "MissingPrerequisiteError";
  }
}

/** 一項前置條件：某個檔案必須存在，否則要提示先跑哪一步。 */
export interface Prerequisite {
  path: string;
  file: string;
  previousStep: string;
}

/** 檢查前置檔是否存在；缺就丟 MissingPrerequisiteError。 */
export function requirePrerequisite(prereq: Prerequisite): void {
  if (!existsSync(prereq.path)) {
    throw new MissingPrerequisiteError(prereq.file, prereq.previousStep, prereq.path);
  }
}

/**
 * 各 step 的共用前置檢查：確認某個契約檔已存在於 output/<project>/。
 * 缺就報「請先跑上一步」；存在則回傳其路徑供讀取。
 */
export function requireContract(
  outputRoot: string,
  project: string,
  contract: ContractName,
): string {
  const path = contractPath(outputRoot, project, contract);
  requirePrerequisite({
    path,
    file: CONTRACT_FILES[contract],
    previousStep: CONTRACT_PRODUCER[contract],
  });
  return path;
}
