import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { unlinkSync } from "node:fs";
import { lstat, mkdir, readFile, readlink, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import demo from "../src/lib/demo-pump.generated.json";

const require = createRequire(import.meta.url);
const root = process.cwd();
const fixtureDir = path.join(root, ".e2e");
const appPort = process.env.FIGURE_E2E_APP_PORT;
const providerPort = process.env.FIGURE_E2E_PROVIDER_PORT;
if (!appPort || !providerPort) throw new Error("Run this fixture through Playwright.");
const providerOrigin = `http://127.0.0.1:${providerPort}`;
const imageModels = [
  { id: "fast-image", label: "Fast image", api: "openai", endpoint: `${providerOrigin}/fast`, deployment: "fixture-fast" },
  { id: "gpt-image-2", label: "Detailed image", api: "openai", endpoint: `${providerOrigin}/detail`, deployment: "fixture-image" },
  { id: "mai-image-2.5", label: "MAI Image", api: "mai", endpoint: `${providerOrigin}/editorial`, deployment: "fixture-mai" },
].map((model) => ({ ...model, apiKeyEnv: "FIGURE_E2E_IMAGE_KEY", authMode: "api-key" }));
await mkdir(fixtureDir, { recursive: true });
const settings = {
  DATABASE_URL: `file:${path.join(fixtureDir, "test.db")}`,
  FIGURE_STORAGE: "local",
  FIGURE_STORAGE_DIR: path.join(fixtureDir, "media"),
  AUTH_SECRET: "figure-e2e-only-secret-not-for-production-0123456789",
  AUTH_URL: `http://127.0.0.1:${appPort}`,
  AUTH_TRUST_HOST: "true",
  AUTH_GOOGLE_ID: "",
  AUTH_GOOGLE_SECRET: "",
  AUTH_FACEBOOK_ID: "",
  AUTH_FACEBOOK_SECRET: "",
  AZURE_AUTH_MODE: "api-key",
  AZURE_OPENAI_ENDPOINT: providerOrigin,
  AZURE_OPENAI_API_KEY: "e2e-provider-only",
  AZURE_VISION_ENDPOINT: providerOrigin,
  AZURE_VISION_API_KEY: "e2e-provider-only",
  AZURE_VISION_API: "responses",
  AZURE_VISION_DEPLOYMENT: "fixture-vision",
  AZURE_IMAGE_MODEL: "fast-image",
  AZURE_IMAGE_MODELS: JSON.stringify(imageModels),
  FIGURE_E2E_IMAGE_KEY: "e2e-provider-only",
};
await writeFile(path.join(fixtureDir, ".env"), Object.entries(settings)
  .map(([key, value]) => `${key}='${value}'`).join("\n") + "\n", { mode: 0o600 });
const conflictingSettings = "AUTH_SECRET=wrong-source-secret\nAUTH_URL=http://wrong.example.com\nDATABASE_URL=file:wrong-source.db\nAZURE_IMAGE_MODELS=invalid-json\nAZURE_IMAGE_MODEL=wrong-model\n";
await writeFile(path.join(fixtureDir, ".env.local"), conflictingSettings);
await writeFile(path.join(fixtureDir, ".env.production.local"), conflictingSettings);
const fixtureLinks: string[] = [];
for (const entry of [".next", "next.config.ts", "scripts", "public", "src", "package.json", "tsconfig.json"]) {
  const link = path.join(fixtureDir, entry);
  const target = path.join(root, entry);
  try {
    const stat = await lstat(link);
    if (!stat.isSymbolicLink() || await readlink(link) !== target) {
      throw new Error(`Unexpected browser fixture path: ${link}`);
    }
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
    await symlink(target, link);
  }
  fixtureLinks.push(link);
}
let cleanedUp = false;
function cleanupFixture() {
  if (cleanedUp) return;
  cleanedUp = true;
  for (const link of fixtureLinks) unlinkSync(link);
  unlinkSync(path.join(fixtureDir, ".env.local"));
  unlinkSync(path.join(fixtureDir, ".env.production.local"));
}
process.once("exit", cleanupFixture);
const env = {
  ...process.env,
  AUTH_SECRET: "wrong-inherited-secret",
  AUTH_URL: "http://wrong.example.com",
  DATABASE_URL: "file:wrong-inherited.db",
  AZURE_IMAGE_MODELS: "invalid-inherited-json",
};
execFileSync(process.execPath, [path.join(root, "scripts/prisma.mjs"),
  "migrate", "reset", "--force", "--skip-seed", "--schema", path.join(root, "prisma/schema.prisma")], {
  env, cwd: fixtureDir, stdio: "inherit",
});
execFileSync(process.execPath, ["--import", "tsx", path.join(root, "prisma/seed.ts")], {
  env: { ...env, NODE_ENV: "test" }, cwd: fixtureDir, stdio: "inherit",
});

const image = (await readFile(path.join(root, "public/demo-pump.png"))).toString("base64");
const provider = createServer(async (request, response) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
    response.setHeader("Content-Type", "application/json");
    if (String(body.prompt).includes("Simulate provider failure")) {
      response.writeHead(503).end(JSON.stringify({ error: { message: "Simulated provider failure", type: "server_error" } }));
      return;
    }
    if (request.url?.includes("/images/generations")) {
      const model = imageModels.find((model) => model.deployment === body.model);
      if (!model || !request.url.startsWith(`${new URL(model.endpoint).pathname}/`)) {
        throw new Error("The selected image deployment was sent to the wrong endpoint.");
      }
      response.end(JSON.stringify({ data: [{ b64_json: image }] }));
      return;
    }
    const format = (body.text as { format?: { name?: string } } | undefined)?.format?.name;
    const output = format === "diagram_component_plan" ? {
      title: "Pump lesson",
      diagramType: "cutaway",
      audience: "curious learners",
      visualDirection: "A clear pump cutaway.",
      parts: demo.annotation.parts.map(({ id, name, description }) => ({ id, name, description })),
    } : demo.annotation;
    response.end(JSON.stringify({
      id: "e2e-response", object: "response", status: "completed",
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output), annotations: [] }] }],
    }));
  } catch (error) {
    console.error("E2E provider failed", error);
    response.writeHead(500).end(JSON.stringify({ error: { message: "Fixture failed" } }));
  }
});
await new Promise<void>((resolve, reject) => {
  provider.once("error", reject);
  provider.listen(Number(providerPort), "127.0.0.1", resolve);
});
const app = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", appPort], {
  env: { ...env, NODE_ENV: "production" }, cwd: fixtureDir, stdio: "inherit",
});
app.on("error", (error) => { console.error(error); provider.close(); process.exitCode = 1; });
app.on("exit", (code) => { provider.close(); process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { cleanupFixture(); app.kill(signal); provider.close(); });
}
