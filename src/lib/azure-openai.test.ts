import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import {
  generateAzureImage,
  getAzureStatus,
  locateDiagramParts,
  normalizeAzureBaseURL,
  normalizeMaiImageURL,
  planDiagramParts,
} from "@/lib/azure-openai";
import type { GenerateDiagramRequest } from "@/lib/contracts";

vi.mock("../../scripts/application-env.mjs", () => ({
  readApplicationEnv: () => process.env,
  loadApplicationEnv: () => process.env,
}));

const baseRequest: GenerateDiagramRequest = {
  subject: "A pump cutaway",
  locale: "en",
  diagramType: "cutaway",
  audience: "students",
  imageModel: "primary",
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

beforeEach(() => {
  for (const key of Object.keys(process.env).filter((key) => key.startsWith("AZURE_"))) {
    vi.stubEnv(key, "");
  }
  vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([{
    id: "primary", label: "Primary image", api: "openai",
    endpoint: "https://image.example.com", deployment: "configured-image",
    apiKeyEnv: "AZURE_IMAGE_KEY",
  }]));
  vi.stubEnv("AZURE_IMAGE_KEY", "test-key");
  vi.stubEnv("AZURE_VISION_DEPLOYMENT", "configured-vision");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([{
      id: "editorial", label: "Editorial", api: "mai",
      endpoint: "https://example.services.ai.azure.com", deployment: "mai-diagram",
      apiKeyEnv: "AZURE_IMAGE_KEY", size: "1024x1024",
    }]));
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
      imageModel: "editorial",
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

  it("adds the Azure preview query to OpenAI image requests", async () => {
    vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([{
      id: "primary", label: "Primary", api: "openai",
      endpoint: "https://example.openai.azure.com", deployment: "gpt-image-diagram",
      apiKeyEnv: "AZURE_IMAGE_KEY", size: "1024x1024",
    }]));
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
    const [, options] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({ model: "gpt-image-diagram" });
  });

  it("preserves MAI HTTP failures for credential-safe connectivity reports", async () => {
    vi.stubEnv("AZURE_AUTH_MODE", "api-key");
    vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([{
      id: "editorial", label: "Editorial", api: "mai",
      endpoint: "https://failure.services.ai.azure.com", deployment: "custom-mai",
      apiKeyEnv: "AZURE_IMAGE_KEY",
    }]));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(generateAzureImage({ ...baseRequest, imageModel: "editorial" }))
      .rejects.toMatchObject({ status: 400 });
  });

  it.each(["responses", "chat-completions"])("uses the configured vision deployment for planning and grounding with %s", async (api) => {
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://custom.example.openai.azure.com");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "key");
    vi.stubEnv("AZURE_VISION_DEPLOYMENT", "arbitrary-vision-deployment");
    vi.stubEnv("AZURE_VISION_API", api);
    const plan = {
      title: "Pump", diagramType: "cutaway", audience: "learners", visualDirection: "A pump.",
      parts: ["case", "shaft", "seal", "rotor"].map((id) => ({ id, name: id, description: id })),
    };
    const annotation = { title: "Pump", summary: "A pump.", parts: [], warnings: [] };
    const payload = (value: unknown) => api === "chat-completions"
      ? { choices: [{ message: { content: JSON.stringify(value) } }] }
      : { object: "response", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value) }] }] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload(plan)), { headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload(annotation)), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await planDiagramParts(planRequest)).title).toBe("Pump");
    expect((await locateDiagramParts(baseRequest, "data:image/png;base64,aW1hZ2U=")).title).toBe("Pump");
    for (const [, options] of fetchMock.mock.calls as [unknown, RequestInit][]) {
      expect(JSON.parse(String(options.body)).model).toBe("arbitrary-vision-deployment");
    }
  });

  it("reports configured deployments and the selected default without exposing credentials", () => {
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://custom.services.ai.azure.com");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "private-test-key");
    vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([
      {
        id: "primary", label: "Primary image", api: "openai",
        endpoint: "https://primary.example.com", deployment: "configured-image", apiKeyEnv: "AZURE_OPENAI_API_KEY",
      },
      {
        id: "editorial", label: "Editorial", api: "mai",
        endpoint: "https://editorial.services.ai.azure.com", deployment: "custom-mai", apiKeyEnv: "AZURE_OPENAI_API_KEY",
      },
    ]));
    vi.stubEnv("AZURE_IMAGE_MODEL", "editorial");
    const status = getAzureStatus();
    expect(status).toMatchObject({
      configured: true, defaultImageModel: "editorial",
      deployments: { vision: "configured-vision" },
    });
    expect(status.imageModels).toEqual([
      { id: "primary", label: "Primary image", api: "openai", deployment: "configured-image", configured: true },
      { id: "editorial", label: "Editorial", api: "mai", deployment: "custom-mai", configured: true },
    ]);
    expect(JSON.stringify(status)).not.toContain("private-test-key");
    expect(JSON.stringify(status)).not.toContain("https://");
  });

  it("rejects a missing image deployment before calling the provider", async () => {
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://custom.example.openai.azure.com");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "key");
    vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([{
      id: "primary", label: "Primary", api: "openai",
      endpoint: "https://image.example.com", deployment: "", apiKeyEnv: "AZURE_IMAGE_KEY",
    }]));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateAzureImage(baseRequest)).rejects.toThrow("invalid or duplicate model definitions");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes multiple OpenAI image models to their own endpoints, deployments, credentials and settings", async () => {
    vi.stubEnv("AZURE_AUTH_MODE", "entra");
    vi.stubEnv("REGISTRY_FAST_KEY", "fast-key");
    vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([
      {
        id: "fast", label: "Fast", api: "openai",
        endpoint: "https://fast.registry.openai.azure.com", deployment: "fast-deployment",
        apiKeyEnv: "REGISTRY_FAST_KEY", authMode: "api-key", quality: "low", size: "1024x1024",
      },
      {
        id: "detailed", label: "Detailed", api: "openai",
        endpoint: "https://detail.registry.openai.azure.com", deployment: "detail-deployment",
        authMode: "entra", quality: "high", size: "1024x1536",
      },
    ]));
    const imageData = await whitePngBase64();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ data: [{ b64_json: imageData }] }),
      { headers: { "Content-Type": "application/json" } },
    )));
    vi.stubGlobal("fetch", fetchMock);
    await generateAzureImage({ ...baseRequest, imageModel: "fast" });
    await generateAzureImage({ ...baseRequest, imageModel: "detailed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [index, expected] of [
      { host: "fast.registry.openai.azure.com", deployment: "fast-deployment", token: "fast-key", quality: "low", size: "1024x1024" },
      { host: "detail.registry.openai.azure.com", deployment: "detail-deployment", token: "entra-test-token", quality: "high", size: "1024x1536" },
    ].entries()) {
      const [request, options] = fetchMock.mock.calls[index] as [Request | string, RequestInit];
      const url = new URL(request instanceof Request ? request.url : request);
      expect(url.host).toBe(expected.host);
      expect(JSON.parse(String(options.body))).toMatchObject({
        model: expected.deployment, size: expected.size, quality: expected.quality,
      });
      expect(new Headers(options.headers).get("authorization")).toBe(`Bearer ${expected.token}`);
    }
  });

  it("selects the MAI protocol from registry configuration rather than a special model ID", async () => {
    vi.stubEnv("REGISTRY_MAI_KEY", "registry-mai-key");
    vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([{
      id: "editorial", label: "Editorial", api: "mai",
      endpoint: "https://editorial.registry.services.ai.azure.com", deployment: "custom-editorial",
      apiKeyEnv: "REGISTRY_MAI_KEY", authMode: "api-key", size: "1536x1024", timeoutMs: 120_000,
    }]));
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const imageData = await whitePngBase64();
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [{ b64_json: imageData }] }),
      { headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    await generateAzureImage({ ...baseRequest, imageModel: "editorial" });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://editorial.registry.services.ai.azure.com/mai/v1/images/generations");
    expect(options.headers).toMatchObject({ "api-key": "registry-mai-key" });
    expect(JSON.parse(String(options.body))).toMatchObject({
      model: "custom-editorial", width: 1536, height: 1024,
    });
    expect(timeout).toHaveBeenCalledWith(120_000);
  });

  it("rejects unknown model IDs without sending a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateAzureImage({ ...baseRequest, imageModel: "unknown-model" }))
      .rejects.toThrow("selected image model is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
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
    vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([{
      id: "primary", label: "Primary", api: "openai",
      endpoint: "https://fallback.example.openai.azure.com", deployment: "configured-image",
      apiKeyEnv: "AZURE_IMAGE_KEY",
    }]));
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
