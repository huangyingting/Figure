import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, figure, storage } = vi.hoisted(() => ({
  auth: vi.fn(),
  figure: { findFirst: vi.fn(), create: vi.fn() },
  storage: { get: vi.fn(), put: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { figure } }));
vi.mock("@/lib/storage", () => ({ getFigureStorage: () => storage }));
vi.mock("@/lib/i18n-shared", () => ({
  requestTranslator: () => (message: string) => message,
  requestLocale: () => "en",
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "source-1" }) };
const source = {
  id: "source-1",
  ownerId: "other-user",
  title: "A pump",
  subject: "Engineering",
  summary: "Pump parts",
  imageKey: "other-user/pump.png",
  imageMimeType: "image/png",
  imageWidth: 100,
  imageHeight: 100,
  imageModel: "image-model",
  visionModel: "vision-model",
  annotationJson: JSON.stringify({ title: "A pump", summary: "Pump parts", parts: [{ id: "shaft", description: "Transmits rotation", visible: true }] }),
  diagramType: null,
  visualStyle: "blueprint",
  audience: null,
};

function copy() {
  return POST(new Request("http://localhost/api/figures/source-1/duplicate", { method: "POST" }), context);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "user-1" } });
  figure.findFirst.mockResolvedValue(source);
  figure.create.mockResolvedValue({ id: "copy-1" });
  storage.get.mockResolvedValue(Buffer.from("image"));
  storage.put.mockResolvedValue({ storageKey: "user-1/pump.png" });
});

describe("figure duplication", () => {
  it("creates a private copy with owner-scoped storage and an atomic revision snapshot", async () => {
    const response = await copy();

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "copy-1" });
    expect(storage.put).toHaveBeenCalledWith(Buffer.from("image"), "image/png", "user-1");
    const { data } = figure.create.mock.calls[0][0];
    expect(data).toMatchObject({
      ownerId: "user-1", title: "A pump", isPublic: false, imageKey: "user-1/pump.png",
      visualStyle: "blueprint",
      revisions: { create: { annotationJson: data.annotationJson, source: "ai-draft" } },
    });
  });

  it("marks same-owner copies in the title", async () => {
    figure.findFirst.mockResolvedValue({ ...source, ownerId: "user-1" });

    expect((await copy()).status).toBe(201);
    expect(figure.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: "A pump (copy)" }),
    }));
    const { data } = figure.create.mock.calls[0][0];
    expect(JSON.parse(data.annotationJson).title).toBe(data.title);
  });

  it("keeps suffixed copy titles within the annotation title limit", async () => {
    figure.findFirst.mockResolvedValue({ ...source, ownerId: "user-1", title: "A".repeat(160) });

    expect((await copy()).status).toBe(201);
    const { data } = figure.create.mock.calls[0][0];
    expect(data.title).toHaveLength(160);
    expect(data.title.endsWith(" (copy)")).toBe(true);
    expect(JSON.parse(data.annotationJson).title).toBe(data.title);
  });

  it.each(["{", JSON.stringify({ parts: [] }), JSON.stringify({ title: "broken" })])(
    "does not silently replace unreadable annotations with an empty copy: %s",
    async (annotationJson) => {
      figure.findFirst.mockResolvedValue({ ...source, annotationJson });

      expect((await copy()).status).toBe(409);
      expect(storage.put).not.toHaveBeenCalled();
      expect(figure.create).not.toHaveBeenCalled();
    },
  );

  it("does not persist a copy when the source image is unavailable", async () => {
    storage.get.mockResolvedValue(null);

    expect((await copy()).status).toBe(409);
    expect(storage.put).not.toHaveBeenCalled();
    expect(figure.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ id: "shaft", index: 0, description: "Transmits rotation", visible: true, box: { x: 0.8, y: 0, width: 0.5, height: 0.1 } }],
    [
      { id: "shaft", index: 0, description: "Transmits rotation", visible: true },
      { id: "SHAFT", index: 1, description: "Duplicate ID", visible: true },
    ],
    [
      { id: "shaft", index: 0, description: "Transmits rotation", visible: true },
      { id: "casing", index: 0, description: "Duplicate index", visible: true },
    ],
  ])("rejects legacy annotations violating current save invariants: %j", async (...parts) => {
    figure.findFirst.mockResolvedValue({
      ...source,
      annotationJson: JSON.stringify({ title: "A pump", summary: "Pump parts", parts }),
    });

    expect((await copy()).status).toBe(409);
    expect(storage.put).not.toHaveBeenCalled();
    expect(figure.create).not.toHaveBeenCalled();
  });

  it("does not copy deleted or inaccessible figures", async () => {
    figure.findFirst.mockResolvedValue(null);

    expect((await copy()).status).toBe(404);
    expect(figure.findFirst).toHaveBeenCalledWith({
      where: { id: "source-1", OR: [{ isPublic: true }, { ownerId: "user-1" }] },
    });
    expect(storage.get).not.toHaveBeenCalled();
  });

  it("requires authentication before reading source data", async () => {
    auth.mockResolvedValue(null);

    expect((await copy()).status).toBe(401);
    expect(figure.findFirst).not.toHaveBeenCalled();
    expect(storage.get).not.toHaveBeenCalled();
  });
});
