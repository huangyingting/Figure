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

  it("orders same-side labels top-to-bottom by anchor", () => {
    const result = layoutCallouts([
      part("0", 0.2, 0.9),
      part("1", 0.2, 0.1),
      part("2", 0.2, 0.5),
    ]);
    const ys = result.map((item) => item.labelY);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    // The lowest anchor should map to the topmost label slot.
    expect(result[0].id).toBe("1");
  });

  it("keeps blended label positions within the [0.1, 0.9] band", () => {
    const result = layoutCallouts([
      part("0", 0.8, 0),
      part("1", 0.8, 1),
      part("2", 0.8, 0.5),
    ]);
    for (const item of result) {
      expect(item.labelY).toBeGreaterThanOrEqual(0.1);
      expect(item.labelY).toBeLessThanOrEqual(0.9);
    }
  });

  it("assigns fixed label and elbow rails per side", () => {
    const result = layoutCallouts([part("0", 0.2, 0.4), part("1", 0.8, 0.6)]);
    const left = result.find((item) => item.id === "0");
    const right = result.find((item) => item.id === "1");
    expect(left).toMatchObject({ labelX: 0.165, elbowX: 0.245 });
    expect(right).toMatchObject({ labelX: 0.835, elbowX: 0.755 });
  });
});
