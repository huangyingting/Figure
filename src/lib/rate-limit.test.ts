import { beforeEach, describe, expect, it } from "vitest";

import { clientIp, peekRateLimit, rateLimit, resetRateLimits } from "@/lib/rate-limit";

beforeEach(() => {
  resetRateLimits();
});

describe("rateLimit", () => {
  it("allows requests up to the limit within a window", () => {
    const opts = { limit: 3, windowMs: 1000 };
    expect(rateLimit("k", opts, 0)).toMatchObject({ allowed: true, remaining: 2 });
    expect(rateLimit("k", opts, 100)).toMatchObject({ allowed: true, remaining: 1 });
    expect(rateLimit("k", opts, 200)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("blocks the request that exceeds the limit and reports retry-after", () => {
    const opts = { limit: 2, windowMs: 10_000 };
    rateLimit("k", opts, 0);
    rateLimit("k", opts, 0);
    const blocked = rateLimit("k", opts, 3_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(7);
  });

  it("resets after the window elapses", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).allowed).toBe(true);
    expect(rateLimit("k", opts, 500).allowed).toBe(false);
    expect(rateLimit("k", opts, 1000).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("a", opts, 0).allowed).toBe(true);
    expect(rateLimit("b", opts, 0).allowed).toBe(true);
    expect(rateLimit("a", opts, 0).allowed).toBe(false);
  });
});

describe("peekRateLimit", () => {
  it("does not consume the budget", () => {
    const opts = { limit: 2, windowMs: 1000 };
    rateLimit("k", opts, 0);
    expect(peekRateLimit("k", 2, 0)).toBe(true);
    expect(peekRateLimit("k", 2, 0)).toBe(true); // still true, no increment
    rateLimit("k", opts, 0); // now at 2
    expect(peekRateLimit("k", 2, 0)).toBe(false);
  });

  it("is true for an unseen key", () => {
    expect(peekRateLimit("fresh", 1, 0)).toBe(true);
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    const req = new Request("https://x.test", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip then to a shared bucket", () => {
    expect(clientIp(new Request("https://x.test", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe("9.9.9.9");
    expect(clientIp(new Request("https://x.test"))).toBe("unknown");
  });
});
