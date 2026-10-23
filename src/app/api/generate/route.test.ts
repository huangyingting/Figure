import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  consume: vi.fn(),
  refund: vi.fn(),
  generate: vi.fn(),
  locate: vi.fn(),
  create: vi.fn(),
  put: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/credits", () => ({ consumeGenerationCredit: mocks.consume, refundGenerationCredit: mocks.refund }));
vi.mock("@/lib/azure-openai", () => ({
  generateAzureImage: mocks.generate,
  locateDiagramParts: mocks.locate,
  AzureConfigurationError: class AzureConfigurationError extends Error {},
}));
vi.mock("@/lib/prisma", () => ({ prisma: { figure: { create: mocks.create } } }));
vi.mock("@/lib/storage", () => ({
  getFigureStorage: () => ({ put: mocks.put }),
  dataUrlToBuffer: () => Buffer.from("image"),
}));
import { POST } from "./route";
import { demoResult } from "@/lib/demo-data";
import { AzureConfigurationError } from "@/lib/azure-openai";

const input = {
  subject: "A pump",
  diagramType: "cutaway",
  audience: "learners",
  imageModel: "gpt-image-2",
  parts: demoResult.annotation.parts.map(({ id, name, description }) => ({ id, name, description })),
};
function request(body: string = JSON.stringify(input)) {
  return new Request("http://localhost/api/generate", { method: "POST", body });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  mocks.consume.mockResolvedValue(11);
  mocks.refund.mockResolvedValue(undefined);
  mocks.generate.mockResolvedValue(demoResult.image);
  mocks.locate.mockResolvedValue(demoResult.annotation);
  mocks.put.mockResolvedValue({ storageKey: "test-image" });
  mocks.create.mockResolvedValue({ id: "saved-figure" });
});

describe("figure generation lifecycle", () => {
  it("saves an image, coherent annotation and initial revision after charging once", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.image.src).toBe("/api/figures/saved-figure/image");
    expect(result.provenance.visualStyle).toBe("isometric");
    expect(response.headers.get("x-credits-remaining")).toBe("11");
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "owner",
        imageKey: "test-image",
        visualStyle: "isometric",
        revisions: { create: { source: "ai-draft", annotationJson: expect.any(String) } },
      }),
    });
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without charging or invoking a provider", async () => {
    expect((await POST(request("{bad-json"))).status).toBe(400);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("does not call a provider without a credit", async () => {
    mocks.consume.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(402);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("refunds missing configuration rather than leaving a charge", async () => {
    mocks.generate.mockRejectedValue(new AzureConfigurationError("Missing endpoint"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.refund).toHaveBeenCalledWith("owner", expect.any(String));
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each(["generate", "locate", "put", "create"] as const)("refunds a failure at %s", async (stage) => {
    mocks[stage].mockRejectedValue(new Error("Pipeline failed"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(502);
      expect(mocks.refund).toHaveBeenCalledWith("owner", expect.any(String));
    } finally {
      log.mockRestore();
    }
  });

  it("explicitly reports a failed credit refund with the recovery reference", async () => {
    mocks.generate.mockRejectedValue(new Error("Provider failed"));
    mocks.refund.mockRejectedValue(new Error("Database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "CREDIT_REFUND_FAILED", requestId: expect.any(String) });
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
