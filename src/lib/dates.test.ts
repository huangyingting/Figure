import { afterEach, describe, expect, it, vi } from "vitest";

import { formatGeneratedDate } from "@/lib/dates";

describe("formatGeneratedDate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("formats a generated timestamp independently of runtime locale", () => {
    const localeFormatter = vi.spyOn(Date.prototype, "toLocaleDateString").mockReturnValue("2026/7/31");

    expect(formatGeneratedDate("2026-07-31T08:13:44.000Z")).toBe("7/31/2026");
    expect(localeFormatter).not.toHaveBeenCalled();
  });

  it("uses UTC so server and client time zones cannot cross a date boundary", () => {
    expect(formatGeneratedDate("2026-08-01T00:30:00.000Z")).toBe("8/1/2026");
  });
});
