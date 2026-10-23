import { describe, expect, it } from "vitest";

import { normalizeDiscoverParams } from "@/components/discover-params";

describe("normalizeDiscoverParams", () => {
  it("accepts repeated search parameters without crashing", () => {
    expect(normalizeDiscoverParams({ q: [" pump ", "ignored"], sort: ["newest"], page: ["2"] }))
      .toEqual({ q: "pump", sort: "newest", page: 2 });
  });

  it.each(["toString", "constructor", "__proto__", "unknown"])("rejects the invalid sort %s", (sort) => {
    expect(normalizeDiscoverParams({ sort }).sort).toBe("popular");
  });

  it.each(["-1", "0", "1e3", "2abc", "Infinity", "999999999999999999999", "10001"])("resets the invalid page %s", (page) => {
    expect(normalizeDiscoverParams({ page }).page).toBe(1);
  });
});
