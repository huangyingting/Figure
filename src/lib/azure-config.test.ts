import { describe, expect, it } from "vitest";

import {
  AzureConfigurationError,
  getAzureConfig,
  getAzureImageConfig,
  isAzureResourceConfigured,
  requireAzureResource,
  UnknownImageModelError,
} from "@/lib/azure-config";

const shared = {
  AZURE_OPENAI_ENDPOINT: " https://example.openai.azure.com/ ",
  AZURE_OPENAI_API_KEY: " shared-key ",
  AZURE_VISION_DEPLOYMENT: " my-planning-model ",
  AZURE_IMAGE_MODELS: JSON.stringify([{
    id: "primary", label: "Primary image", api: "openai",
    endpoint: "https://image.example.com", deployment: "my-image-model", apiKeyEnv: "IMAGE_KEY",
  }]),
  IMAGE_KEY: " image-key ",
};

describe("central Azure configuration", () => {
  it("resolves arbitrary deployment names and trims shared credentials", () => {
    const config = getAzureConfig(shared);
    expect(config.vision).toEqual({
      endpoint: "https://example.openai.azure.com/",
      apiKey: "shared-key",
      deployment: "my-planning-model",
      authMode: "auto",
      timeoutMs: 180_000,
    });
    expect(config.images.primary.deployment).toBe("my-image-model");
    expect(config.defaultImageModel).toBe("primary");
    expect(config.timeoutMs).toBe(180_000);
  });

  it("prefers dedicated resources and accepts configured image tuning", () => {
    const config = getAzureConfig({
      ...shared,
      AZURE_VISION_ENDPOINT: "https://vision.example.com",
      AZURE_VISION_API_KEY: "vision-key",
      AZURE_IMAGE_MODELS: JSON.stringify([{
        id: "primary", label: "Primary image", api: "openai",
        endpoint: "https://image.example.com", deployment: "my-image-model",
        apiKeyEnv: "IMAGE_KEY", size: "1024x1536",
      }]),
      AZURE_IMAGE_QUALITY: "high",
      AZURE_VISION_API: "chat-completions",
      AZURE_REQUEST_TIMEOUT_MS: "250000",
    });
    expect(config.vision.endpoint).toBe("https://vision.example.com");
    expect(config.vision.apiKey).toBe("vision-key");
    expect(config.images.primary).toMatchObject({
      endpoint: "https://image.example.com", apiKey: "image-key",
      size: "1024x1536", width: 1024, height: 1536,
    });
    expect(config).toMatchObject({ imageQuality: "high", visionApi: "chat-completions", timeoutMs: 250_000 });
  });

  it("never invents deployments or marks missing deployments ready", () => {
    const config = getAzureConfig({ ...shared, AZURE_VISION_DEPLOYMENT: "" });
    expect(config.vision.deployment).toBe("");
    expect(isAzureResourceConfigured(config.vision)).toBe(false);
    expect(() => requireAzureResource(config.vision, "AZURE_VISION"))
      .toThrow("AZURE_VISION deployment is required");
  });

  const registry = [
    {
      id: "fast-image", label: "Fast image", api: "openai",
      endpoint: "https://fast.openai.azure.com", deployment: "fast-deployment",
      apiKeyEnv: "FAST_IMAGE_KEY",
    },
    {
      id: "detailed-image", label: "Detailed image", api: "openai",
      endpoint: "https://detail.openai.azure.com", deployment: "detail-deployment",
      apiKeyEnv: "DETAIL_IMAGE_KEY",
      size: "1024x1536", quality: "high", timeoutMs: 250_000, authMode: "api-key",
    },
  ];

  describe("image model registry", () => {
    it("resolves multiple deployments of the same protocol on independent resources", () => {
      const config = getAzureConfig({
        ...shared,
        AZURE_IMAGE_MODELS: JSON.stringify(registry),
        FAST_IMAGE_KEY: "fast-key",
        DETAIL_IMAGE_KEY: "detail-key",
        AZURE_IMAGE_MODEL: "detailed-image",
      });
      expect(Object.keys(config.images)).toEqual(["fast-image", "detailed-image"]);
      expect(config.defaultImageModel).toBe("detailed-image");
      expect(config.images["fast-image"]).toMatchObject({
        endpoint: "https://fast.openai.azure.com", apiKey: "fast-key",
        deployment: "fast-deployment", api: "openai", label: "Fast image",
        authMode: "auto", size: "1536x1024", quality: "medium", timeoutMs: 180_000,
      });
      expect(config.images["detailed-image"]).toMatchObject({
        endpoint: "https://detail.openai.azure.com", apiKey: "detail-key",
        deployment: "detail-deployment", width: 1024, height: 1536,
        authMode: "api-key", quality: "high", timeoutMs: 250_000,
      });
    });

    it("does not use shared vision credentials for image resources", () => {
      const config = getAzureConfig({ ...shared, AZURE_IMAGE_MODELS: JSON.stringify(registry) });
      expect(Object.keys(config.images)).toEqual(["fast-image", "detailed-image"]);
      expect(config.images["fast-image"].apiKey).toBe("");
      expect(isAzureResourceConfigured(config.images["fast-image"])).toBe(false);
    });

    it("selects the first ready model when a default is not specified", () => {
      const config = getAzureConfig({
        AZURE_IMAGE_MODELS: JSON.stringify(registry), DETAIL_IMAGE_KEY: "key",
      });
      expect(config.defaultImageModel).toBe("detailed-image");
    });

    it("supports independent keyless and key-based models regardless of the global auth mode", () => {
      const config = getAzureConfig({
        AZURE_AUTH_MODE: "entra",
        AZURE_IMAGE_MODELS: JSON.stringify([
          { ...registry[0], authMode: "entra" },
          registry[1],
        ]),
        DETAIL_IMAGE_KEY: "key",
      });
      expect(isAzureResourceConfigured(config.images["fast-image"])).toBe(true);
      expect(config.images["detailed-image"].authMode).toBe("api-key");
      expect(isAzureResourceConfigured(config.images["detailed-image"])).toBe(true);
    });

    it("supports MAI under arbitrary IDs and keeps vision on its own auth mode", () => {
      const config = getAzureConfig({
        ...shared,
        AZURE_AUTH_MODE: "entra",
        AZURE_VISION_AUTH_MODE: "api-key",
        AZURE_IMAGE_MODELS: JSON.stringify([{
          ...registry[0], id: "mai-editorial", api: "mai",
          endpoint: "https://mai.services.ai.azure.com",
        }]),
      });
      expect(config.images["mai-editorial"]).toMatchObject({ api: "mai", size: "1024x1024", authMode: "entra" });
      expect(config.vision.authMode).toBe("api-key");
    });

    it("rejects unknown selections and inherited object names", () => {
      const config = getAzureConfig({ AZURE_IMAGE_MODELS: JSON.stringify(registry) });
      expect(getAzureImageConfig("fast-image", config).deployment).toBe("fast-deployment");
      expect(() => getAzureImageConfig("missing", config)).toThrow(UnknownImageModelError);
      expect(() => getAzureImageConfig("constructor", config)).toThrow(UnknownImageModelError);
      expect(() => getAzureImageConfig("__proto__", config)).toThrow(UnknownImageModelError);
    });

    it("rejects a default ID that is not in the registry", () => {
      expect(() => getAzureConfig({
        AZURE_IMAGE_MODELS: JSON.stringify(registry), AZURE_IMAGE_MODEL: "missing",
      })).toThrow("AZURE_IMAGE_MODEL must name an ID");
    });

    it("rejects malformed JSON without echoing configuration values", () => {
      expect(() => getAzureConfig({ AZURE_IMAGE_MODELS: "private-invalid-json" }))
        .toThrow("AZURE_IMAGE_MODELS must be a valid JSON array");
    });

    it.each([
      [],
      [registry[0], registry[0]],
      [{ ...registry[0], id: "Bad ID" }],
      [{ ...registry[0], label: "" }],
      [{ ...registry[0], api: "unknown" }],
      [{ ...registry[0], endpoint: "not-a-url" }],
      [{ ...registry[0], endpoint: "file:///tmp/image" }],
      [{ ...registry[0], deployment: "" }],
      [{ ...registry[0], apiKey: "inline-secret" }],
      [{ ...registry[0], apiKeyEnv: "invalid key" }],
      [{ ...registry[0], authMode: "unknown" }],
      [{ ...registry[0], size: "bad-size" }],
      [{ ...registry[0], quality: "bad-quality" }],
      [{ ...registry[0], timeoutMs: 1 }],
    ])("rejects invalid registry definitions %#", (...models) => {
      expect(() => getAzureConfig({ AZURE_IMAGE_MODELS: JSON.stringify(models) }))
        .toThrow("AZURE_IMAGE_MODELS has invalid or duplicate model definitions");
    });
  });

  it("requires an explicit registry instead of inventing legacy model choices", () => {
    expect(() => getAzureConfig({}))
      .toThrow("AZURE_IMAGE_MODELS is required");
  });

  it("supports keyless Entra resources and rejects missing keys in API-key mode", () => {
    const config = getAzureConfig({
      ...shared, AZURE_OPENAI_API_KEY: "", AZURE_AUTH_MODE: "entra",
    });
    expect(isAzureResourceConfigured(config.vision)).toBe(true);
    expect(() => requireAzureResource({ ...config.vision, authMode: "api-key" }, "AZURE_VISION")).toThrow("missing an API key");
  });

  it("reports a missing endpoint before making a request", () => {
    const config = getAzureConfig({ ...shared, AZURE_OPENAI_ENDPOINT: "" });
    expect(() => requireAzureResource(config.vision, "AZURE_VISION")).toThrow("missing an Azure endpoint");
  });

  it.each([
    ["AZURE_AUTH_MODE", "unknown"],
    ["AZURE_VISION_API", "typo"],
    ["AZURE_IMAGE_MODEL", "unknown-profile"],
    ["AZURE_IMAGE_QUALITY", "ultra"],
    ["AZURE_REQUEST_TIMEOUT_MS", "not-a-number"],
    ["AZURE_REQUEST_TIMEOUT_MS", "0"],
    ["AZURE_REQUEST_TIMEOUT_MS", "300001"],
  ])("rejects invalid %s instead of silently using another setting", (key, value) => {
    expect(() => getAzureConfig({ ...shared, [key]: value })).toThrow(AzureConfigurationError);
    expect(() => getAzureConfig({ ...shared, [key]: value })).toThrow(key);
  });

  it("uses tuning defaults for empty settings", () => {
    expect(getAzureConfig({ ...shared, AZURE_REQUEST_TIMEOUT_MS: " " }).timeoutMs).toBe(180_000);
  });
});
