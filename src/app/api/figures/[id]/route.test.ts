import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, tx } = vi.hoisted(() => ({
  auth: vi.fn(),
  tx: {
    figure: { findUnique: vi.fn(), update: vi.fn() },
    annotationRevision: { create: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { ...tx, $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) },
}));

import { GET, PATCH } from "./route";
import { demoResult } from "@/lib/demo-data";

const context = { params: Promise.resolve({ id: demoResult.id }) };
const annotation = { ...demoResult.annotation, title: "Saved lesson" };

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: "owner" } });
  tx.figure.findUnique.mockResolvedValue({
    id: demoResult.id, ownerId: "owner", isPublic: false,
    annotationJson: JSON.stringify(annotation), createdAt: new Date(),
    visualStyle: "realistic",
  });
  tx.figure.update.mockImplementation(async ({ data }) => ({ id: demoResult.id, ...data }));
  tx.annotationRevision.findMany.mockResolvedValue([]);
});

describe("saved figures", () => {
  it("returns actual saved annotations even for the demo in Chinese", async () => {
    const response = await GET(new Request("http://localhost", { headers: { cookie: "figure_locale=zh-CN" } }), context);
    expect((await response.json()).annotation.title).toBe("Saved lesson");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("hides private figures from other learners", async () => {
    auth.mockResolvedValue({ user: { id: "someone-else" } });
    expect((await GET(new Request("http://localhost"), context)).status).toBe(404);
  });

  it.each([null, {}, { title: "" }, { isPublic: "true" }, { unknown: true }])("rejects invalid mutations: %j", async (body) => {
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), context);
    expect(response.status).toBe(400);
    expect(tx.figure.update).not.toHaveBeenCalled();
  });

  it("renames the lesson and its annotation together with a restorable revision", async () => {
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ title: " Renamed " }) }), context);
    expect(response.status).toBe(200);
    expect(tx.figure.update).toHaveBeenCalledWith({
      where: { id: demoResult.id },
      data: { title: "Renamed", summary: annotation.summary, annotationJson: JSON.stringify({ ...annotation, title: "Renamed" }) },
    });
    expect(tx.annotationRevision.create).toHaveBeenCalledWith({
      data: { figureId: demoResult.id, annotationJson: JSON.stringify({ ...annotation, title: "Renamed" }), source: "human-edit" },
    });
  });

  it("does not rewrite annotations on a visibility-only change", async () => {
    await PATCH(new Request("http://localhost", { method: "PATCH", body: '{"isPublic":true}' }), context);
    expect(tx.figure.update).toHaveBeenCalledWith({ where: { id: demoResult.id }, data: { isPublic: true } });
    expect(tx.annotationRevision.create).not.toHaveBeenCalled();
  });
});
