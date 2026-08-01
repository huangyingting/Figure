import { describe, expect, it } from "vitest";

import { parsePartLines } from "@/lib/part-lines";

describe("parsePartLines", () => {
  it("preserves explicit stable IDs", () => {
    expect(
      parsePartLines("[left_atrium] 左心房 | 接收含氧血液\n主动脉 | 输送血液"),
    ).toEqual([
      { id: "left_atrium", name: "左心房", description: "接收含氧血液" },
      { id: "part_02", name: "主动脉", description: "输送血液" },
    ]);
  });

  it("rejects a line without a description separator", () => {
    expect(() => parsePartLines("Casing\nImpeller | Rotating component")).toThrow(
      "Line 1 needs",
    );
  });

  it("requires at least two components", () => {
    expect(() => parsePartLines("Casing | The outer shell")).toThrow(
      "at least two components",
    );
    expect(() => parsePartLines("   \n  ")).toThrow("at least two components");
  });

  it("rejects more than twelve components", () => {
    const lines = Array.from({ length: 13 }, (_, i) => `Part ${i} | Desc ${i}`).join("\n");
    expect(() => parsePartLines(lines)).toThrow("maximum of 12");
  });

  it("assigns padded fallback IDs by line position", () => {
    const parts = parsePartLines("Alpha | first\nBeta | second");
    expect(parts.map((part) => part.id)).toEqual(["part_01", "part_02"]);
  });

  it("keeps the bracket in the name when no name follows the explicit ID", () => {
    const parts = parsePartLines("[rotor] | spins\nCasing | shell");
    expect(parts[0]).toEqual({ id: "part_01", name: "[rotor]", description: "spins" });
  });

  it("requires a non-empty description", () => {
    expect(() => parsePartLines("Casing |   \nRotor | spins")).toThrow(
      "Line 1 needs a component description",
    );
  });

  it("trims surrounding blank lines before counting", () => {
    const parts = parsePartLines("\n\nCasing | shell\nRotor | spins\n\n");
    expect(parts).toHaveLength(2);
  });
});
