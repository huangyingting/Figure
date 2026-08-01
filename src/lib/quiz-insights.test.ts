import { describe, expect, it } from "vitest";

import { computePartAccuracy, weakestParts } from "@/lib/quiz-insights";

const parts = [
  { id: "impeller", name: "Impeller" },
  { id: "casing", name: "Casing" },
  { id: "shaft", name: "Shaft" },
];

describe("computePartAccuracy", () => {
  it("merges correct and incorrect counts into per-part accuracy", () => {
    const rows = [
      { partId: "impeller", correct: true, count: 3 },
      { partId: "impeller", correct: false, count: 1 },
      { partId: "casing", correct: true, count: 2 },
    ];

    const accuracy = computePartAccuracy(rows, parts);

    expect(accuracy).toEqual([
      { partId: "impeller", name: "Impeller", attempts: 4, correct: 3, accuracyPct: 75 },
      { partId: "casing", name: "Casing", attempts: 2, correct: 2, accuracyPct: 100 },
    ]);
  });

  it("sorts the weakest parts first and breaks ties by attempt volume", () => {
    const rows = [
      { partId: "impeller", correct: false, count: 2 },
      { partId: "casing", correct: false, count: 5 },
      { partId: "shaft", correct: true, count: 1 },
    ];

    const accuracy = computePartAccuracy(rows, parts);

    expect(accuracy.map((item) => item.partId)).toEqual(["casing", "impeller", "shaft"]);
  });

  it("drops answers for parts that no longer exist on the figure", () => {
    const rows = [
      { partId: "removed-part", correct: false, count: 4 },
      { partId: "shaft", correct: true, count: 1 },
    ];

    const accuracy = computePartAccuracy(rows, parts);

    expect(accuracy).toHaveLength(1);
    expect(accuracy[0].partId).toBe("shaft");
  });

  it("returns nothing when the user has never answered", () => {
    expect(computePartAccuracy([], parts)).toEqual([]);
  });
});

describe("weakestParts", () => {
  it("excludes fully mastered parts and caps the list", () => {
    const accuracy = computePartAccuracy(
      [
        { partId: "impeller", correct: false, count: 1 },
        { partId: "casing", correct: false, count: 1 },
        { partId: "shaft", correct: true, count: 2 },
      ],
      parts,
    );

    const weakest = weakestParts(accuracy, 1);

    expect(weakest).toHaveLength(1);
    expect(weakest[0].accuracyPct).toBeLessThan(100);
  });
});
