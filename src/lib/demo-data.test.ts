import { describe, expect, it } from "vitest";

import { demoResult, localizeDemoFigure, storedFigureAnnotation } from "@/lib/demo-data";

describe("stored demo annotations", () => {
  it("localizes the untouched demo", () => {
    expect(storedFigureAnnotation(demoResult.id, JSON.stringify(demoResult.annotation), "zh-CN").parts[0].name).toBe("泵壳");
  });

  it("preserves saved demo edits in either language", () => {
    const edited = {
      ...demoResult.annotation,
      title: "My lesson",
      parts: demoResult.annotation.parts.map((part) => ({ ...part, name: `Edited ${part.name}` })),
    };
    for (const locale of ["en", "zh-CN"] as const) {
      expect(storedFigureAnnotation(demoResult.id, JSON.stringify(edited), locale)).toEqual(edited);
      expect(localizeDemoFigure({ id: demoResult.id, title: edited.title }, locale).title).toBe(edited.title);
    }
  });

  it("does not replace non-demo annotations", () => {
    expect(storedFigureAnnotation("copy", JSON.stringify(demoResult.annotation), "zh-CN")).toEqual(demoResult.annotation);
  });
});
