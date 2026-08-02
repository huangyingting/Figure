import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { localizedDemoResult, localizeDemoFigure } from "@/lib/demo-data";
import { normalizeLocale, requestLocale, translate } from "@/lib/i18n-shared";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

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

describe("Chinese UI catalog coverage", () => {
  it("translates every literal UI message passed to t()", () => {
    const keys = sourceFiles(join(process.cwd(), "src"))
      .flatMap((file) => [...readFileSync(file, "utf8").matchAll(/(?<![A-Za-z])t\("([^"]+)"\)/g)])
      .map((match) => match[1]);

    expect(keys.length).toBeGreaterThan(100);
    for (const key of new Set(keys)) {
      expect(translate("zh-CN", key), `Missing Chinese UI message: ${key}`).not.toBe(key);
    }
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

  it("localizes the persisted demo wherever it appears in figure lists", () => {
    const figure = localizeDemoFigure({
      id: "offline-demo-centrifugal-pump",
      title: "Single-stage end-suction centrifugal pump cutaway",
      subject: "Inside a centrifugal pump",
      summary: "English summary",
    }, "zh-CN");

    expect(figure).toMatchObject({
      title: "单级端吸离心泵剖视图",
      subject: "离心泵内部结构",
      summary: expect.stringContaining("青绿色蜗壳"),
    });
  });
});
