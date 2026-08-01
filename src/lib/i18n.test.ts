import { describe, expect, it } from "vitest";

import { localizedDemoResult } from "@/lib/demo-data";
import { normalizeLocale, requestLocale } from "@/lib/i18n-shared";

describe("locale resolution", () => {
  it("recognizes Chinese browser preferences and defaults other languages to English", () => {
    expect(normalizeLocale("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh-CN");
    expect(normalizeLocale("en-US,en;q=0.9")).toBe("en");
  });

  it("lets the explicit locale cookie override the browser language", () => {
    const request = new Request("http://localhost/api/plan", {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "figure_locale=zh-CN",
      },
    });
    expect(requestLocale(request)).toBe("zh-CN");
  });
});

describe("localized demo annotation", () => {
  it("provides Chinese title, descriptions, evidence, and warnings immediately", () => {
    const result = localizedDemoResult("zh-CN");

    expect(result.annotation.title).toContain("离心泵");
    expect(result.annotation.parts.find((part) => part.id === "impeller")).toMatchObject({
      name: "叶轮",
      description: expect.stringContaining("机械能"),
      evidence: expect.stringContaining("青铜色"),
    });
    expect(result.annotation.warnings.at(-1)).toContain("静态示例");
  });
});
