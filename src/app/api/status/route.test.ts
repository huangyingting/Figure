import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("../../../../scripts/application-env.mjs", () => ({
  readApplicationEnv: () => process.env,
}));

beforeEach(() => {
  for (const key of Object.keys(process.env).filter((key) => key.startsWith("AZURE_"))) {
    vi.stubEnv(key, "");
  }
});

afterEach(() => vi.unstubAllEnvs());

describe("Azure configuration status", () => {
  it("returns configured deployments and the default profile without secrets", async () => {
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://status.services.ai.azure.com");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "private-key");
    vi.stubEnv("AZURE_VISION_DEPLOYMENT", "custom-vision");
    vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([{
      id: "editorial", label: "Editorial", api: "mai",
      endpoint: "https://status.services.ai.azure.com", deployment: "custom-mai",
      apiKeyEnv: "AZURE_OPENAI_API_KEY",
    }]));
    vi.stubEnv("AZURE_IMAGE_MODEL", "editorial");
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({
      configured: true,
      defaultImageModel: "editorial",
      imageModels: [
        { id: "editorial", configured: true, deployment: "custom-mai" },
      ],
      deployments: { vision: "custom-vision" },
    });
    expect(JSON.stringify(body)).not.toContain("private-key");
    expect(JSON.stringify(body)).not.toContain("https://");
  });

  it("reports a missing image registry as an explicit configuration error", async () => {
    const response = GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "AZURE_NOT_CONFIGURED",
      error: expect.stringContaining("AZURE_IMAGE_MODELS is required"),
    });
  });

  it("reports invalid configuration explicitly without echoing its value", async () => {
    vi.stubEnv("AZURE_IMAGE_QUALITY", "private-invalid-value");
    const response = GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("AZURE_NOT_CONFIGURED");
    expect(body.error).toContain("AZURE_IMAGE_QUALITY");
    expect(body.error).not.toContain("private-invalid-value");
  });

  it("publishes dynamic model choices without endpoints, keys or credential references", async () => {
    vi.stubEnv("AZURE_VISION_ENDPOINT", "https://vision.example.com");
    vi.stubEnv("AZURE_VISION_DEPLOYMENT", "vision-deployment");
    vi.stubEnv("AZURE_VISION_API_KEY", "private-vision-key");
    vi.stubEnv("PRIVATE_REGISTRY_KEY", "private-image-key");
    vi.stubEnv("AZURE_IMAGE_MODELS", JSON.stringify([
      {
        id: "first", label: "First model", api: "openai",
        endpoint: "https://one.example.com", deployment: "one",
        apiKeyEnv: "PRIVATE_REGISTRY_KEY",
      },
      {
        id: "second", label: "Second model", api: "openai",
        endpoint: "https://two.example.com", deployment: "two",
        authMode: "entra",
      },
    ]));
    vi.stubEnv("AZURE_IMAGE_MODEL", "second");
    const response = GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.defaultImageModel).toBe("second");
    expect(body.imageModels).toEqual([
      { id: "first", label: "First model", api: "openai", deployment: "one", configured: true },
      { id: "second", label: "Second model", api: "openai", deployment: "two", configured: true },
    ]);
    const serialized = JSON.stringify(body);
    for (const secret of ["private-image-key", "private-vision-key", "PRIVATE_REGISTRY_KEY", "https://", "apiKeyEnv", "authMode"]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
