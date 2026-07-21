import { defineConfig } from "vitest/config";

// 只跑 f2w-run 下的驅動檔，避免與 src 單元測試混跑。由專案根執行，output/ 相對路徑對齊 cwd。
export default defineConfig({
  test: {
    include: ["f2w-run/**/*.test.ts"],
  },
});
