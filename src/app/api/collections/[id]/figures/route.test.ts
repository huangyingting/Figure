import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, collection, figure, collectionFigure, transaction } = vi.hoisted(() => {
  const collection = { findFirst: vi.fn(), update: vi.fn() };
  const figure = { findFirst: vi.fn() };
  const collectionFigure = { upsert: vi.fn(), deleteMany: vi.fn() };
  return {
    auth: vi.fn(),
    collection,
    figure,
    collectionFigure,
    transaction: vi.fn(async (callback) => callback({ collection, collectionFigure })),
  };
});

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { collection, figure, collectionFigure, $transaction: transaction } }));
vi.mock("@/lib/i18n-shared", () => ({
  requestTranslator: () => (message: string) => message,
}));

import { DELETE, POST } from "./route";

const context = { params: Promise.resolve({ id: "collection-1" }) };
function request(body: unknown = { figureId: "figure-1" }) {
  return new Request("http://localhost/api/collections/collection-1/figures", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "user-1" } });
  collection.findFirst.mockResolvedValue({ id: "collection-1" });
  figure.findFirst.mockResolvedValue({ id: "figure-1" });
  collectionFigure.deleteMany.mockResolvedValue({ count: 1 });
});

describe("collection membership persistence", () => {
  it("atomically adds accessible figures and updates the collection activity timestamp", async () => {
    expect((await POST(request(), context)).status).toBe(200);

    expect(collection.findFirst).toHaveBeenCalledWith({
      where: { id: "collection-1", ownerId: "user-1" }, select: { id: true },
    });
    expect(figure.findFirst).toHaveBeenCalledWith({
      where: { id: "figure-1", OR: [{ isPublic: true }, { ownerId: "user-1" }] }, select: { id: true },
    });
    expect(transaction).toHaveBeenCalledOnce();
    expect(collectionFigure.upsert).toHaveBeenCalledWith({
      where: { collectionId_figureId: { collectionId: "collection-1", figureId: "figure-1" } },
      create: { collectionId: "collection-1", figureId: "figure-1" },
      update: { addedAt: expect.any(Date) },
    });
    expect(collection.update).toHaveBeenCalledWith({
      where: { id: "collection-1", ownerId: "user-1" },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it("allows removing privatized figures and records collection activity atomically", async () => {
    expect((await DELETE(request(), context)).status).toBe(200);

    expect(figure.findFirst).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledOnce();
    expect(collectionFigure.deleteMany).toHaveBeenCalledWith({
      where: { collectionId: "collection-1", figureId: "figure-1" },
    });
    expect(collection.update).toHaveBeenCalledWith({
      where: { id: "collection-1", ownerId: "user-1" },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it("does not reorder collections for an already absent membership", async () => {
    collectionFigure.deleteMany.mockResolvedValue({ count: 0 });

    expect((await DELETE(request(), context)).status).toBe(200);
    expect(collection.update).not.toHaveBeenCalled();
  });

  it.each([POST, DELETE])("does not mutate another user's or deleted collection", async (handler) => {
    collection.findFirst.mockResolvedValue(null);

    expect((await handler(request(), context)).status).toBe(404);
    expect(collectionFigure.upsert).not.toHaveBeenCalled();
    expect(collectionFigure.deleteMany).not.toHaveBeenCalled();
  });

  it("does not add a deleted or inaccessible figure", async () => {
    figure.findFirst.mockResolvedValue(null);

    expect((await POST(request(), context)).status).toBe(404);
    expect(collectionFigure.upsert).not.toHaveBeenCalled();
  });

  it.each([POST, DELETE])("rejects malformed membership payloads", async (handler) => {
    expect((await handler(request({ figureId: "" }), context)).status).toBe(400);
    expect(collectionFigure.upsert).not.toHaveBeenCalled();
    expect(collectionFigure.deleteMany).not.toHaveBeenCalled();
  });
});
