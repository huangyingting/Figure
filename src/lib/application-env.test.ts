import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadApplicationEnv, readApplicationEnv } from "../../scripts/application-env.mjs";
import { getAzureConfig } from "@/lib/azure-config";
import { getApplicationConfig } from "@/lib/config";

const directories: string[] = [];
let originalEnv: NodeJS.ProcessEnv;

function fixture(contents: string) {
  const directory = mkdtempSync(path.join(process.cwd(), ".figure-env-test-"));
  directories.push(directory);
  writeFileSync(path.join(directory, ".env"), contents);
  return directory;
}

beforeEach(() => {
  originalEnv = process.env;
  process.env = { ...originalEnv };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.env = originalEnv;
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe("authoritative application configuration", () => {
  it("reads only .env, ignoring local, mode-specific and inherited application settings", () => {
    const directory = fixture("AZURE_OPENAI_ENDPOINT=https://correct.example.com\nAUTH_SECRET=file-secret\n");
    for (const name of [".env.local", ".env.development", ".env.production", ".env.production.local"]) {
      writeFileSync(path.join(directory, name), "AZURE_OPENAI_ENDPOINT=https://wrong.example.com\nAZURE_VISION_ENDPOINT=https://stale.example.com\n");
    }
    const target = {
      AZURE_OPENAI_ENDPOINT: "https://inherited.example.com",
      AZURE_VISION_ENDPOINT: "https://inherited-vision.example.com",
      AUTH_SECRET: "inherited-secret",
      DATABASE_URL: "file:inherited.db",
      FIGURE_STORAGE: "azure",
      OPENAI_API_KEY: "inherited-openai-key",
      OPENAI_ADMIN_KEY: "inherited-admin-key",
      OPENAI_CUSTOM_HEADERS: "Authorization: Bearer inherited-header",
      OPENAI_ORG_ID: "inherited-org",
      OPENAI_PROJECT_ID: "inherited-project",
      OPENAI_LOG: "debug",
      NODE_ENV: "production",
      PATH: "/bin",
    };
    const settings = loadApplicationEnv(directory, target);
    expect(settings).toEqual({
      AZURE_OPENAI_ENDPOINT: "https://correct.example.com", AUTH_SECRET: "file-secret",
    });
    expect(target).toEqual({
      ...settings, NODE_ENV: "production", PATH: "/bin",
    });
  });

  it("supports registry JSON, explicit empty values and arbitrary credential references", () => {
    const directory = fixture(`AZURE_IMAGE_MODELS='[
      {"id":"fast","label":"Fast","api":"openai","endpoint":"https://example.com","deployment":"image","apiKeyEnv":"CUSTOM_KEY"}
    ]'\nCUSTOM_KEY="key-with-#-character"\nAUTH_GOOGLE_ID=\n`);
    const target: Record<string, string | undefined> = { CUSTOM_KEY: "inherited-key" };
    const settings = loadApplicationEnv(directory, target);
    expect(JSON.parse(settings.AZURE_IMAGE_MODELS ?? "")).toHaveLength(1);
    expect(target.CUSTOM_KEY).toBe("key-with-#-character");
    expect(target.AUTH_GOOGLE_ID).toBe("");
  });

  it("does not let file settings change runtime controls", () => {
    const directory = fixture("NODE_ENV=development\nPATH=/wrong\n__NEXT_PRIVATE_FLAG=wrong\n");
    const target = { NODE_ENV: "production", PATH: "/bin", __NEXT_PRIVATE_FLAG: "original" };
    loadApplicationEnv(directory, target);
    expect(target).toEqual({ NODE_ENV: "production", PATH: "/bin", __NEXT_PRIVATE_FLAG: "original" });
  });

  it("reports a missing .env instead of falling back to other sources", () => {
    const directory = fixture("");
    rmSync(path.join(directory, ".env"));
    writeFileSync(path.join(directory, ".env.local"), "AUTH_SECRET=wrong-source\n");
    expect(() => readApplicationEnv(directory)).toThrow("Create .env using .env.example");
  });

  it("does not mutate process environment when reading settings", () => {
    const directory = fixture("AUTH_SECRET=file-secret\n");
    const before = process.env.AUTH_SECRET;
    expect(readApplicationEnv(directory).AUTH_SECRET).toBe("file-secret");
    expect(process.env.AUTH_SECRET).toBe(before);
  });

  it("resolves real Azure models from .env despite conflicting process and local configuration", () => {
    const models = [
      { id: "configured-fast", label: "Configured fast", api: "openai", endpoint: "https://first.example.com", deployment: "custom-image-a", apiKeyEnv: "FILE_IMAGE_KEY" },
      { id: "configured-detail", label: "Configured detail", api: "openai", endpoint: "https://second.example.com", deployment: "custom-image-b", authMode: "entra" },
    ];
    const directory = fixture(`AZURE_IMAGE_MODELS='${JSON.stringify(models)}'\nAZURE_IMAGE_MODEL=configured-detail\nFILE_IMAGE_KEY=file-key\nAZURE_VISION_DEPLOYMENT=file-vision\n`);
    writeFileSync(path.join(directory, ".env.local"), "AZURE_IMAGE_MODEL=wrong-model\nAZURE_VISION_DEPLOYMENT=wrong-vision\n");
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    vi.stubEnv("AZURE_IMAGE_MODELS", "invalid-inherited-json");
    vi.stubEnv("AZURE_IMAGE_MODEL", "wrong-model");
    vi.stubEnv("FILE_IMAGE_KEY", "wrong-key");
    vi.stubEnv("AZURE_VISION_DEPLOYMENT", "wrong-vision");
    const config = getAzureConfig();
    expect(config.defaultImageModel).toBe("configured-detail");
    expect(Object.keys(config.images)).toEqual(["configured-fast", "configured-detail"]);
    expect(config.images["configured-fast"]).toMatchObject({
      deployment: "custom-image-a", endpoint: "https://first.example.com", apiKey: "file-key",
    });
    expect(config.images["configured-detail"].deployment).toBe("custom-image-b");
    expect(config.vision.deployment).toBe("file-vision");
  });

  it("resolves database, authentication, storage and site settings from the same file", () => {
    const directory = fixture("DATABASE_URL=file:authoritative.db\nAUTH_SECRET=file-secret\nAUTH_URL=https://figure.example.com/\nFIGURE_STORAGE=azure\nAZURE_STORAGE_CONTAINER=file-container\n");
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    vi.stubEnv("DATABASE_URL", "file:wrong.db");
    vi.stubEnv("AUTH_SECRET", "wrong-secret");
    vi.stubEnv("AUTH_URL", "https://wrong.example.com");
    vi.stubEnv("FIGURE_STORAGE", "local");
    const config = getApplicationConfig();
    expect(config.databaseUrl).toBe("file:authoritative.db");
    expect(config.auth.secret).toBe("file-secret");
    expect(config.siteUrl).toBe("https://figure.example.com");
    expect(config.storage).toMatchObject({ kind: "azure", container: "file-container" });
  });
});
