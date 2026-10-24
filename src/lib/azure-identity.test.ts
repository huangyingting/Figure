import { createRequire } from "node:module";

import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { CryptoProvider } from "@azure/msal-node";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const commonJsMsal: typeof import("@azure/msal-node") = require("@azure/msal-node");
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

afterEach(() => vi.unstubAllEnvs());

describe("Azure Identity dependency compatibility", () => {
  it("supports the documented Azure CLI credential selector", () => {
    vi.stubEnv("AZURE_TOKEN_CREDENTIALS", "AzureCliCredential");
    expect(() => new DefaultAzureCredential()).not.toThrow();
  });

  it("preserves MSAL GUID generation with the patched UUID dependency in both module formats", () => {
    expect(new CryptoProvider().createNewGuid()).toMatch(guidPattern);
    expect(new commonJsMsal.CryptoProvider().createNewGuid()).toMatch(guidPattern);
  });

  it("provides bearer tokens through the real Azure Identity helper without network access", async () => {
    const getToken = vi.fn().mockResolvedValue({
      token: "test-bearer-token",
      expiresOnTimestamp: Date.now() + 60_000,
    });
    const provider = getBearerTokenProvider(
      { getToken },
      "https://cognitiveservices.azure.com/.default",
    );
    expect(await provider()).toBe("test-bearer-token");
    expect(getToken).toHaveBeenCalled();
  });
});
