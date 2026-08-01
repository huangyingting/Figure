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
    // Four parts, two clearly-left (x=0.2) and two clearly-right (x=0.8) so the
    // median split keeps each pair on its own side; each column is then ordered
    // top-to-bottom by anchor y.
    const result = layoutCallouts([
      part("0", 0.2, 0.9),
      part("1", 0.2, 0.1),
      part("2", 0.8, 0.9),
      part("3", 0.8, 0.1),
    ]);
    const left = result.filter((item) => item.side === "left");
    const right = result.filter((item) => item.side === "right");
    expect(left.map((i) => i.labelY)).toEqual([...left.map((i) => i.labelY)].sort((a, b) => a - b));
    expect(right.map((i) => i.labelY)).toEqual([...right.map((i) => i.labelY)].sort((a, b) => a - b));
    // Within the left column, the lowest anchor takes the topmost slot.
    expect(left[0].id).toBe("1");
  });

  it("balances the two columns near-evenly regardless of anchor clustering", () => {
    // Five parts all clustered on the right half; the split should still put
    // roughly half on each side (3 left / 2 right) rather than all on the right.
    const result = layoutCallouts([
      part("0", 0.7, 0.1),
      part("1", 0.75, 0.3),
      part("2", 0.8, 0.5),
      part("3", 0.85, 0.7),
      part("4", 0.9, 0.9),
    ]);
    const leftCount = result.filter((item) => item.side === "left").length;
    const rightCount = result.filter((item) => item.side === "right").length;
    expect(Math.abs(leftCount - rightCount)).toBeLessThanOrEqual(1);
    // The leftmost anchors go left, the rightmost go right.
    expect(result.find((item) => item.id === "0")?.side).toBe("left");
    expect(result.find((item) => item.id === "4")?.side).toBe("right");
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
