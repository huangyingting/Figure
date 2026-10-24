import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), administrator: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/config", () => ({ getApplicationConfig: () => ({ siteUrl: "https://figure.genisisiq.com" }) }));
vi.mock("@/lib/account-admission", () => ({
  requireAdministrator: mocks.administrator,
  AdmissionError: class extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));

import { AdmissionError } from "@/lib/account-admission";
import { BodyTooLargeError } from "@/lib/http";
import { invitationRequest } from "@/lib/invitation-http";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "member" } });
});

describe("invitation administration HTTP boundary", () => {
  it("requires authentication before invoking an action", async () => {
    mocks.auth.mockResolvedValue(null);
    const action = vi.fn();
    expect((await invitationRequest(new Request("https://figure.genisisiq.com"), action)).status).toBe(401);
    expect(action).not.toHaveBeenCalled();
  });

  it("rechecks administrator access instead of trusting a client or stale JWT role", async () => {
    mocks.administrator.mockRejectedValue(new AdmissionError(403, "Administrator access required."));
    const action = vi.fn();
    expect((await invitationRequest(new Request("https://figure.genisisiq.com"), action)).status).toBe(403);
    expect(action).not.toHaveBeenCalled();
  });

  it("rejects cross-origin browser mutations, including same-site sibling apps", async () => {
    const action = vi.fn();
    const request = new Request("https://figure.genisisiq.com/api/admin/invitations", {
      method: "POST", headers: { Origin: "https://other.genisisiq.com" },
    });
    expect((await invitationRequest(request, action)).status).toBe(403);
    expect(action).not.toHaveBeenCalled();
  });

  it("accepts same-origin mutations and never caches secret links", async () => {
    const request = new Request("https://figure.genisisiq.com/api/admin/invitations", {
      method: "POST", headers: { Origin: "https://figure.genisisiq.com" },
    });
    const response = await invitationRequest(request, async () => ({ acceptUrl: "private-link" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns bounded-request and syntax errors explicitly", async () => {
    for (const [error, status] of [[new BodyTooLargeError(4096), 413], [new SyntaxError(), 400]] as const) {
      const response = await invitationRequest(new Request("https://figure.genisisiq.com"), async () => { throw error; });
      expect(response.status).toBe(status);
    }
  });

  it("logs unexpected failures and returns a recoverable error, not success", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await invitationRequest(new Request("https://figure.genisisiq.com"), async () => { throw new Error("Database offline"); });
      expect(response.status).toBe(500);
      expect(log).toHaveBeenCalledOnce();
    } finally { log.mockRestore(); }
  });
});
