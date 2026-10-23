import { afterEach, describe, expect, it, vi } from "vitest";

import { mutationRequest } from "@/components/mutation-request";

afterEach(() => vi.unstubAllGlobals());

describe("mutationRequest", () => {
  it("preserves successful responses and request options", async () => {
    const response = new Response(null, { status: 204 });
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetch);

    expect(await mutationRequest("/api/figure", { method: "DELETE" })).toBe(response);
    expect(fetch).toHaveBeenCalledWith("/api/figure", { method: "DELETE" });
  });

  it("preserves HTTP failures for callers to display", async () => {
    const response = new Response("Unavailable", { status: 503 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    expect(await mutationRequest("/api/figure")).toBe(response);
  });

  it("turns a disconnected network into a recoverable failed response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const response = await mutationRequest("/api/figure");

    expect(response.ok).toBe(false);
    expect(response.type).toBe("error");
  });
});
