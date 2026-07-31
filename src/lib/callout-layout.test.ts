import { describe, expect, it } from "vitest";

import { layoutCallouts } from "@/lib/callout-layout";
import type { AnnotatedPart } from "@/lib/contracts";

function part(id: string, x: number, y: number, visible = true): AnnotatedPart {
  return {
    id,
    index: Number(id),
    name: id,
    description: id,
    visible,
    anchor: { x, y },
    box: { x, y, width: 0.1, height: 0.1 },
    confidence: 0.9,
    evidence: "visible",
    reviewStatus: "ai-draft",
  };
}

describe("layoutCallouts", () => {
  it("splits labels by anchor side and excludes invisible parts", () => {
    const result = layoutCallouts([
      part("0", 0.2, 0.8),
      part("1", 0.8, 0.2),
      part("2", 0.1, 0.5, false),
    ]);
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.id === "0")?.side).toBe("left");
    expect(result.find((item) => item.id === "1")?.side).toBe("right");
  });
});
