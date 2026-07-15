import { describe, expect, it } from "vitest";
import { isNormalizedRoute, pageIdKey, pageIdSchema } from "./page";

describe("isNormalizedRoute", () => {
  it("接受正規化路由", () => {
    for (const r of ["/", "/about", "/settings/profile", "/users/list"]) {
      expect(isNormalizedRoute(r)).toBe(true);
    }
  });

  it("拒絕非正規化路由", () => {
    for (const r of ["about", "/about?tab=1", "/about#top", "/about/", "/a//b", ""]) {
      expect(isNormalizedRoute(r)).toBe(false);
    }
  });
});

describe("pageIdSchema", () => {
  it("接受 route；tab 可省略或提供", () => {
    expect(pageIdSchema.safeParse({ route: "/" }).success).toBe(true);
    expect(pageIdSchema.safeParse({ route: "/settings", tab: "個人資料" }).success).toBe(true);
  });

  it("拒絕缺 route、非正規化 route、空 tab", () => {
    expect(pageIdSchema.safeParse({ tab: "A" }).success).toBe(false);
    expect(pageIdSchema.safeParse({ route: "settings" }).success).toBe(false);
    expect(pageIdSchema.safeParse({ route: "/settings", tab: "" }).success).toBe(false);
  });
});

describe("pageIdKey", () => {
  it("同 route 不同 tab 產生不同鍵", () => {
    const profile = pageIdKey({ route: "/settings", tab: "個人資料" });
    const account = pageIdKey({ route: "/settings", tab: "帳號" });
    const noTab = pageIdKey({ route: "/settings" });
    expect(new Set([profile, account, noTab]).size).toBe(3);
  });

  it("無 tab 的相同 route 產生相同鍵", () => {
    expect(pageIdKey({ route: "/" })).toBe(pageIdKey({ route: "/" }));
  });
});
