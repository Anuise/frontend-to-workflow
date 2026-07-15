import { describe, expect, it } from "vitest";
import { isNormalizedRoute } from "../contracts/page";
import { normalizeRoute } from "./normalizeRoute";

const base = "http://localhost:4173";

describe("normalizeRoute", () => {
  it("保留已正規化的站內路由", () => {
    expect(normalizeRoute("/", base)).toBe("/");
    expect(normalizeRoute("/about", base)).toBe("/about");
    expect(normalizeRoute("/settings/profile", base)).toBe("/settings/profile");
  });

  it("等價 URL 收斂為同一 route（去 query/fragment/結尾斜線）", () => {
    // 這些都應收斂到 /about——正是「等價 URL 不重複列為多個 Page」的確定性核心。
    for (const href of [
      "/about",
      "/about/",
      "/about?tab=1",
      "/about#top",
      "/about/?ref=nav#x",
      `${base}/about`,
      `${base}/about/`,
    ]) {
      expect(normalizeRoute(href, base)).toBe("/about");
    }
  });

  it("解析相對路徑（相對站台根）", () => {
    expect(normalizeRoute("about", base)).toBe("/about");
    expect(normalizeRoute("./settings", base)).toBe("/settings");
  });

  it("收斂路徑內的連續斜線與結尾斜線", () => {
    expect(normalizeRoute("/a//b", base)).toBe("/a/b");
    expect(normalizeRoute("/a//b//c///", base)).toBe("/a/b/c");
  });

  it("protocol-relative URL 視為站外（//host 指向別的 origin）", () => {
    // "//a/b" 依 URL 規範是 host=a 的 protocol-relative 連結，非站內路徑。
    expect(normalizeRoute("//evil.com/x", base)).toBeNull();
  });

  it("過濾站外連結（不同 origin）", () => {
    expect(normalizeRoute("http://evil.com/x", base)).toBeNull();
    expect(normalizeRoute("https://localhost:4173/x", base)).toBeNull(); // 不同 scheme→不同 origin
    expect(normalizeRoute("http://localhost:5555/x", base)).toBeNull(); // 不同 port
  });

  it("過濾非 http(s) 連結與空連結", () => {
    for (const href of [
      "mailto:a@b.com",
      "tel:123",
      "javascript:void(0)",
      "data:text/plain,x",
      "",
      "   ",
    ]) {
      expect(normalizeRoute(href, base)).toBeNull();
    }
  });

  it("無法解析的 href 回 null 而非丟錯", () => {
    expect(normalizeRoute("http://[bad", base)).toBeNull();
  });

  it("屬性測試：任何非 null 輸出都滿足 isNormalizedRoute 契約", () => {
    const inputs = [
      "/",
      "/about",
      "/about/",
      "/a//b//",
      "about",
      "/settings?x=1#y",
      "http://localhost:4173/deep/path/",
      "/%E4%B8%AD%E6%96%87",
      "/trailing///",
    ];
    for (const href of inputs) {
      const route = normalizeRoute(href, base);
      if (route !== null) {
        expect(isNormalizedRoute(route)).toBe(true);
      }
    }
  });
});
