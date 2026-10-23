import { describe, expect, it } from "vitest";

import { parseAnchorCoordinate } from "@/components/anchor-coordinate-input";

describe("anchor coordinate editing", () => {
  it.each(["", " ", "1e", "NaN", "Infinity", "-Infinity"])("ignores incomplete or invalid value %s", (value) => {
    expect(parseAnchorCoordinate(value)).toBeNull();
  });

  it.each([["0.123", 0.123], ["0", 0], ["1", 1], ["-0.5", 0], ["1.5", 1]] as const)("commits %s inside the image bounds", (value, expected) => {
    expect(parseAnchorCoordinate(value)).toBe(expected);
  });
});
