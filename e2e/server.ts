import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
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
await mkdir(fixtureDir, { recursive: true });
const env = {
  ...process.env,
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
  AZURE_GPT_IMAGE_ENDPOINT: providerOrigin,
  AZURE_GPT_IMAGE_API_KEY: "e2e-provider-only",
  AZURE_MAI_IMAGE_ENDPOINT: providerOrigin,
  AZURE_MAI_IMAGE_API_KEY: "e2e-provider-only",
};
execFileSync(process.execPath, [path.join(path.dirname(require.resolve("prisma/package.json")), "build/index.js"),
  "migrate", "reset", "--force", "--skip-seed"], { env, stdio: "inherit" });
execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
  env: { ...env, NODE_ENV: "test" }, stdio: "inherit",
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
  env: { ...env, NODE_ENV: "production" }, stdio: "inherit",
});
app.on("error", (error) => { console.error(error); provider.close(); process.exitCode = 1; });
app.on("exit", (code) => { provider.close(); process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { app.kill(signal); provider.close(); });
}
