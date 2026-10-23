import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, collection } = vi.hoisted(() => ({
  auth: vi.fn(),
  collection: { findMany: vi.fn(), create: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { collection } }));
vi.mock("@/lib/i18n-shared", () => ({
  requestTranslator: () => (message: string) => message,
}));

import { GET, POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "user-1" } });
  collection.findMany.mockResolvedValue([]);
});

describe("collection listing", () => {
  it("filters both preview titles and counts by current figure visibility", async () => {
    expect((await GET(new Request("http://localhost/api/collections"))).status).toBe(200);

    const visibility = { figure: { OR: [{ isPublic: true }, { ownerId: "user-1" }] } };
    expect(collection.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: "user-1" },
      include: {
        figures: expect.objectContaining({ where: visibility, take: 4 }),
        _count: { select: { figures: { where: visibility } } },
      },
    }));
  });

  it("requires authentication", async () => {
    auth.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/collections"))).status).toBe(401);
    expect(collection.findMany).not.toHaveBeenCalled();
  });
});

describe("collection creation", () => {
  it("validates and trims fields before persistence", async () => {
    collection.create.mockResolvedValue({ id: "collection-1" });
    const response = await POST(new Request("http://localhost/api/collections", {
      method: "POST",
      body: JSON.stringify({ name: "  Pumps  ", description: "  Notes  " }),
    }));

    expect(response.status).toBe(201);
    expect(collection.create).toHaveBeenCalledWith({
      data: { ownerId: "user-1", name: "Pumps", description: "Notes", color: "violet" },
    });
  });

  it("rejects invalid JSON without writing", async () => {
    const response = await POST(new Request("http://localhost/api/collections", { method: "POST", body: "{" }));

    expect(response.status).toBe(400);
    expect(collection.create).not.toHaveBeenCalled();
  });
});
