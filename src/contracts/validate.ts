import type { ZodIssue, ZodType } from "zod";

/** 契約驗證失敗時丟出，訊息逐條列出違反的欄位路徑與原因。 */
export class ContractValidationError extends Error {
  constructor(
    public readonly contract: string,
    public readonly issues: ZodIssue[],
  ) {
    super(
      `${contract} 契約驗證失敗：\n` +
        issues
          .map((i) => `  - ${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
          .join("\n"),
    );
    this.name = "ContractValidationError";
  }
}

/** 以 schema 驗證資料；合法回傳型別化結果，非法丟 ContractValidationError。 */
export function validate<T>(contract: string, schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ContractValidationError(contract, result.error.issues);
  }
  return result.data;
}
