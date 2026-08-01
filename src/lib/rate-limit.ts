interface WindowState {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Maximum number of requests permitted within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

// Single-instance, in-memory store. Sufficient for one Node process; swap for a
// shared store (Redis) if the app is ever scaled horizontally.
const store = new Map<string, WindowState>();
let lastSweep = 0;

function sweep(now: number) {
  // Amortized cleanup so the map cannot grow unbounded from one-off keys.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, state] of store) {
    if (state.resetAt <= now) store.delete(key);
  }
}

export function rateLimit(key: string, options: RateLimitOptions, now: number = Date.now()): RateLimitResult {
  sweep(now);
  const state = store.get(key);
  if (!state || state.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  if (state.count >= options.limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1000)) };
  }

  state.count += 1;
  return { allowed: true, remaining: options.limit - state.count, retryAfterSeconds: 0 };
}

/** Test/maintenance hook to clear all recorded windows. */
export function resetRateLimits() {
  store.clear();
  lastSweep = 0;
}

/**
 * Non-consuming check: returns false when the key is already at/over `limit`
 * for the current window, true otherwise. Does not increment the counter.
 */
export function peekRateLimit(key: string, limit: number, now: number = Date.now()): boolean {
  const state = store.get(key);
  if (!state || state.resetAt <= now) return true;
  return state.count < limit;
}

/** Best-effort client IP from common proxy headers, falling back to a shared bucket. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
