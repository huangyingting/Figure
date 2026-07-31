import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateAzureImage,
  normalizeAzureBaseURL,
  normalizeMaiImageURL,
} from "@/lib/azure-openai";
import type { GenerateDiagramRequest } from "@/lib/contracts";

const baseRequest: GenerateDiagramRequest = {
  subject: "A pump cutaway",
  diagramType: "cutaway",
  audience: "students",
  imageModel: "gpt-image-2",
  parts: [
    { id: "case", name: "case", description: "outer case" },
    { id: "rotor", name: "rotor", description: "rotating component" },
  ],
};

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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "AAAA" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = await generateAzureImage({
      ...baseRequest,
      imageModel: "mai-image-2.5",
    });

    expect(image.src).toBe("data:image/png;base64,AAAA");
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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "BBBB" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = await generateAzureImage(baseRequest);

    expect(image.src).toBe("data:image/png;base64,BBBB");
    const [request] = fetchMock.mock.calls[0] as [Request];
    const url = request instanceof Request ? request.url : String(request);
    expect(url).toContain("/openai/v1/images/generations");
    expect(url).toContain("api-version=preview");
  });
});
