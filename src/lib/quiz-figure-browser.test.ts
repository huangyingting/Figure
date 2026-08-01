import { beforeEach, describe, expect, it, vi } from "vitest";

const { figure } = vi.hoisted(() => ({
  figure: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: { figure } }));

import {
  browseQuizFigures,
  getQuizFigure,
  normalizeQuizFigureBrowserParams,
  quizFigureHref,
} from "@/lib/quiz-figure-browser";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quiz figure browser", () => {
  it("normalizes bounded search and pagination state", () => {
    expect(normalizeQuizFigureBrowserParams({ q: "  pump  ", page: "2" }))
      .toEqual({ query: "pump", page: 2 });
    expect(normalizeQuizFigureBrowserParams({ q: "", page: "9" }))
      .toEqual({ query: "", page: 1 });
    expect(normalizeQuizFigureBrowserParams({ q: "pump", page: "-4" }))
      .toEqual({ query: "pump", page: 1 });
  });

  it("searches only public figures for guests and returns bounded pages", async () => {
    figure.findMany.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({
        id: `figure-${index}`,
        title: `Pump ${index}`,
        subject: "Engineering",
        createdAt: new Date(2026, 0, index + 1),
        ownerId: "owner-1",
        isPublic: true,
        _count: { quizAttempts: index },
      })),
    );

    const result = await browseQuizFigures(null, { q: " pump ", page: "2" });

    expect(figure.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { isPublic: true },
          {
            OR: [
              { title: { contains: "pump" } },
              { subject: { contains: "pump" } },
            ],
          },
        ],
      },
      skip: 8,
      take: 9,
    }));
    expect(result.figures).toHaveLength(8);
    expect(result.hasPrevious).toBe(true);
    expect(result.hasNext).toBe(true);
  });

  it("shows a signed-in user's private figures alongside public figures", async () => {
    figure.findMany.mockResolvedValue([]);

    await browseQuizFigures("user-1", {});

    expect(figure.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ ownerId: "user-1" }, { isPublic: true }] },
      skip: 0,
      take: 9,
    }));
  });

  it("resolves an exact accessible figure or the newest accessible figure", async () => {
    figure.findFirst.mockResolvedValue(null);

    await getQuizFigure("user-1", "figure-42");
    expect(figure.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: {
        AND: [
          { OR: [{ ownerId: "user-1" }, { isPublic: true }] },
          { id: "figure-42" },
        ],
      },
    }));

    await getQuizFigure(null);
    expect(figure.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { isPublic: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }));
  });

  it("preserves the running figure while searching and paging", () => {
    expect(quizFigureHref({ figureId: "figure-1", query: "water pump", page: 3 }))
      .toBe("/quiz?figure=figure-1&q=water+pump&page=3");
    expect(quizFigureHref({ figureId: "figure-2" }))
      .toBe("/quiz?figure=figure-2");
  });
});
