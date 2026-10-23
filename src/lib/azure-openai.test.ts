import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import {
  generateAzureImage,
  getAzureStatus,
  normalizeAzureBaseURL,
  normalizeMaiImageURL,
  planDiagramParts,
} from "@/lib/azure-openai";
import type { GenerateDiagramRequest } from "@/lib/contracts";

const baseRequest: GenerateDiagramRequest = {
  subject: "A pump cutaway",
  locale: "en",
  diagramType: "cutaway",
  audience: "students",
  imageModel: "gpt-image-2",
  visualStyle: "isometric",
  parts: [
    { id: "case", name: "case", description: "outer case" },
    { id: "rotor", name: "rotor", description: "rotating component" },
  ],
};
const planRequest = { subject: "Pump", locale: "en", visualStyle: "isometric" } as const;

vi.mock("@azure/identity", () => ({
  AggregateAuthenticationError: class AggregateAuthenticationError extends Error {},
  DefaultAzureCredential: class {},
  getBearerTokenProvider: () => async () => "entra-test-token",
}));

async function whitePngBase64(): Promise<string> {
  const image = await sharp({
    create: {
      width: 16,
      height: 16,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  }).png().toBuffer();
  return image.toString("base64");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Azure endpoint normalization", () => {
  it("normalizes Azure OpenAI resource roots to the v1 base URL", () => {
    expect(
      normalizeAzureBaseURL("https://example.openai.azure.com/"),
    ).toBe("https://example.openai.azure.com/openai/v1/");
    expect(
      normalizeAzureBaseURL("https://example.services.ai.azure.com/openai/v1"),
    ).toBe("https://example.services.ai.azure.com/openai/v1/");
  });

  it("uses the dedicated MAI image API path", () => {
    expect(
      normalizeMaiImageURL("https://example.services.ai.azure.com"),
    ).toBe("https://example.services.ai.azure.com/mai/v1/images/generations");
    expect(
      normalizeMaiImageURL(
        "https://example.services.ai.azure.com/mai/v1/images/generations",
      ),
    ).toBe("https://example.services.ai.azure.com/mai/v1/images/generations");
  });

  it("sends MAI width and height to its provider-specific endpoint", async () => {
    vi.stubEnv(
      "AZURE_MAI_IMAGE_ENDPOINT",
      "https://example.services.ai.azure.com",
    );
    vi.stubEnv("AZURE_MAI_IMAGE_API_KEY", "test-key");
    vi.stubEnv("AZURE_MAI_IMAGE_DEPLOYMENT", "mai-diagram");
    vi.stubEnv("AZURE_MAI_IMAGE_SIZE", "1024x1024");
    const imageData = await whitePngBase64();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: imageData }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = await generateAzureImage({
      ...baseRequest,
      imageModel: "mai-image-2.5",
    });

    expect(image.src).toMatch(/^data:image\/png;base64,/);
    expect(image.mimeType).toBe("image/png");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://example.services.ai.azure.com/mai/v1/images/generations",
    );
    expect(init.headers).toMatchObject({ "api-key": "test-key" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "mai-diagram",
      width: 1024,
      height: 1024,
    });
  });

  it("adds the Azure preview query to gpt-image-2 requests", async () => {
    vi.stubEnv(
      "AZURE_GPT_IMAGE_ENDPOINT",
      "https://example.openai.azure.com",
    );
    vi.stubEnv("AZURE_GPT_IMAGE_API_KEY", "test-key");
    vi.stubEnv("AZURE_GPT_IMAGE_DEPLOYMENT", "gpt-image-diagram");
    vi.stubEnv("AZURE_GPT_IMAGE_SIZE", "1024x1024");
    const imageData = await whitePngBase64();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: imageData }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = await generateAzureImage(baseRequest);

    expect(image.src).toMatch(/^data:image\/png;base64,/);
    expect(image.mimeType).toBe("image/png");
    const [request] = fetchMock.mock.calls[0] as [Request];
    const url = request instanceof Request ? request.url : String(request);
    expect(url).toContain("/openai/v1/images/generations");
    expect(url).toContain("api-version=preview");
  });

  it("uses Microsoft Entra ID for a keyless deployment", async () => {
    vi.stubEnv("AZURE_AUTH_MODE", "entra");
    vi.stubEnv("AZURE_VISION_ENDPOINT", "https://entra.example.openai.azure.com");
    vi.stubEnv("AZURE_VISION_API_KEY", "");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "response", object: "response", status: "completed", output: [{ type: "message", role: "assistant", content: [{
        type: "output_text", text: JSON.stringify({
          title: "Pump", diagramType: "cutaway", audience: "learners", visualDirection: "A pump.",
          parts: ["case", "shaft", "seal", "rotor"].map((id) => ({ id, name: id, description: id })),
        }),
      }] }],
    }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(getAzureStatus().visionConfigured).toBe(true);
    expect((await planDiagramParts(planRequest)).parts).toHaveLength(4);
    const [, options] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer entra-test-token");
  });

  it("switches to Entra ID only when the resource explicitly disables key authentication", async () => {
    vi.stubEnv("AZURE_AUTH_MODE", "auto");
    vi.stubEnv("AZURE_GPT_IMAGE_ENDPOINT", "https://fallback.example.openai.azure.com");
    vi.stubEnv("AZURE_GPT_IMAGE_API_KEY", "old-key");
    const imageData = await whitePngBase64();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: {
        code: "AuthenticationTypeDisabled", message: "Key based authentication is disabled for this resource.",
      } }), { status: 403, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: imageData }] }), {
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await generateAzureImage(baseRequest)).mimeType).toBe("image/png");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, options] = fetchMock.mock.calls[1] as [unknown, RequestInit];
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer entra-test-token");
  });

  it("reports a malformed provider plan as a provider failure, not an invalid user request", async () => {
    vi.stubEnv("AZURE_AUTH_MODE", "api-key");
    vi.stubEnv("AZURE_VISION_ENDPOINT", "https://bad-plan.example.openai.azure.com");
    vi.stubEnv("AZURE_VISION_API_KEY", "key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "response", object: "response", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "{}" }] }],
    }), { headers: { "Content-Type": "application/json" } })));
    await expect(planDiagramParts(planRequest)).rejects.toThrow("invalid plan");
  });

  it("does not retry an ordinary authorization denial with a different identity", async () => {
    vi.stubEnv("AZURE_AUTH_MODE", "auto");
    vi.stubEnv("AZURE_VISION_ENDPOINT", "https://denied.example.openai.azure.com");
    vi.stubEnv("AZURE_VISION_API_KEY", "key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "AccessDenied", message: "Access denied" },
    }), { status: 403, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(planDiagramParts(planRequest)).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a mismatched Entra tenant as an actionable configuration error", async () => {
    vi.stubEnv("AZURE_AUTH_MODE", "entra");
    vi.stubEnv("AZURE_VISION_ENDPOINT", "https://wrong-tenant.example.openai.azure.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "Tenant provided in token does not match resource token", message: "Tenant mismatch" },
    }), { status: 400, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(planDiagramParts(planRequest)).rejects.toMatchObject({
      name: "AzureConfigurationError", message: expect.stringContaining("different tenant"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
