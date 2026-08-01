import { describe, expect, it } from "vitest";

import { isMatch, safeCallbackUrl } from "@/auth.config";

describe("safeCallbackUrl", () => {
  it("allows same-origin absolute paths", () => {
    expect(safeCallbackUrl("/library")).toBe("/library");
    expect(safeCallbackUrl("/collections/abc?tab=1")).toBe("/collections/abc?tab=1");
  });

  it("falls back for missing or non-path values", () => {
    expect(safeCallbackUrl(null)).toBe("/library");
    expect(safeCallbackUrl(undefined)).toBe("/library");
    expect(safeCallbackUrl("")).toBe("/library");
    expect(safeCallbackUrl("https://evil.com")).toBe("/library");
    expect(safeCallbackUrl("library")).toBe("/library");
  });

  it("rejects protocol-relative and backslash-escaped off-origin URLs", () => {
    expect(safeCallbackUrl("//evil.com")).toBe("/library");
    expect(safeCallbackUrl("/\\evil.com")).toBe("/library");
    expect(safeCallbackUrl("/\\/evil.com")).toBe("/library");
    expect(new URL(safeCallbackUrl("/\\evil.com"), "https://app.test").host).toBe("app.test");
  });

  it("honors a custom fallback", () => {
    expect(safeCallbackUrl("//evil.com", "/signin")).toBe("/signin");
  });
});

describe("isMatch", () => {
  it("matches exact routes and nested paths only", () => {
    expect(isMatch("/library", ["/library"])).toBe(true);
    expect(isMatch("/library/abc", ["/library"])).toBe(true);
    expect(isMatch("/librarian", ["/library"])).toBe(false);
    expect(isMatch("/discover", ["/library"])).toBe(false);
  });
});
