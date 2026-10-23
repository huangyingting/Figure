import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, figure, favorite } = vi.hoisted(() => ({
  auth: vi.fn(),
  figure: { findFirst: vi.fn() },
  favorite: { upsert: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { figure, favorite } }));
vi.mock("@/lib/i18n-shared", () => ({
  requestTranslator: () => (message: string) => message,
}));

import { DELETE, POST } from "./route";

const context = { params: Promise.resolve({ id: "figure-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "user-1" } });
  figure.findFirst.mockResolvedValue({ id: "figure-1" });
});

describe("favorite persistence", () => {
  it("idempotently favorites only an accessible figure for the authenticated user", async () => {
    expect((await POST(new Request("http://localhost"), context)).status).toBe(200);
    expect(figure.findFirst).toHaveBeenCalledWith({
      where: { id: "figure-1", OR: [{ isPublic: true }, { ownerId: "user-1" }] },
      select: { id: true },
    });
    expect(favorite.upsert).toHaveBeenCalledWith({
      where: { userId_figureId: { userId: "user-1", figureId: "figure-1" } },
      create: { userId: "user-1", figureId: "figure-1" },
      update: {},
    });
  });

  it("rejects favoriting deleted or now-private figures", async () => {
    figure.findFirst.mockResolvedValue(null);

    expect((await POST(new Request("http://localhost"), context)).status).toBe(404);
    expect(favorite.upsert).not.toHaveBeenCalled();
  });

  it("allows removing one's own stale favorite after a figure becomes private or is deleted", async () => {
    expect((await DELETE(new Request("http://localhost"), context)).status).toBe(200);
    expect(favorite.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", figureId: "figure-1" } });
    expect(figure.findFirst).not.toHaveBeenCalled();
  });

  it.each([POST, DELETE])("requires authentication for mutations", async (handler) => {
    auth.mockResolvedValue(null);

    expect((await handler(new Request("http://localhost"), context)).status).toBe(401);
    expect(favorite.upsert).not.toHaveBeenCalled();
    expect(favorite.deleteMany).not.toHaveBeenCalled();
  });
});
