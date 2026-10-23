import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, prisma } = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    figure: { findUnique: vi.fn() },
    annotationRevision: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma }));
import { POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: "owner" } });
  prisma.figure.findUnique.mockResolvedValue({ ownerId: "owner" });
});

describe("revision restore", () => {
  it("reports a malformed stored revision as a conflict without changing the figure", async () => {
    prisma.annotationRevision.findFirst.mockResolvedValue({ annotationJson: "{not-json" });
    const response = await POST(new Request("http://localhost", { method: "POST", body: '{"revisionId":"broken"}' }), {
      params: Promise.resolve({ id: "figure" }),
    });
    expect(response.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
