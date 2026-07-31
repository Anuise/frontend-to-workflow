import { type Workitems, loadWorkitems } from "../contracts/workitems";
import { requireContract } from "../prerequisites";

/**
 * f2w-breakdown-export 的前置入口：讀回並驗證 workitems.json。
 * **工項只有一份檔**——分工鏈長在工項身上，交付物才展開成多列（見 ADR-0016），
 * 所以不再有第二份 sourced 檔要挑，也就沒有兩份檔之間的新鮮度問題。
 * 缺件即丟 MissingPrerequisiteError，訊息提示先跑 f2w-breakdown。
 */
export function loadWorkitemsForExport(outputRoot: string, project: string): Workitems {
  return loadWorkitems(requireContract(outputRoot, project, "workitems"));
}

/** 這批工項是否帶分工鏈（全有全無由契約層把關，所以看一筆就夠）。 */
export function hasPartyChains(workitems: Workitems): boolean {
  return workitems.backend.some((item) => item.partyChain !== undefined);
}
