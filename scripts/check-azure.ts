import { parseArgs } from "node:util";

import { loadApplicationEnv } from "./application-env.mjs";

import { AzureConfigurationError, getAzureConfig } from "../src/lib/azure-config";
import {
  generateAzureImage,
  getAzureStatus,
  locateDiagramParts,
  planDiagramParts,
} from "../src/lib/azure-openai";
import type { GenerateDiagramRequest } from "../src/lib/contracts";

async function main(): Promise<void> {
  parseArgs({ options: {} });
  loadApplicationEnv();
  console.log("Testing authoritative .env application configuration; local files and inherited application settings are ignored.");
  const config = getAzureConfig();
  const status = getAzureStatus();
  console.log(`Default image profile: ${config.defaultImageModel}; vision API: ${config.visionApi}.`);
  console.log("Live checks send synthetic pump prompts and generate one image per configured profile (provider charges may apply).");
  let failed = false;
  const check = async <T>(label: string, run: () => Promise<T>): Promise<T | undefined> => {
    try {
      const result = await run();
      console.log(`PASS ${label}`);
      return result;
    } catch (error) {
      failed = true;
      if (error instanceof AzureConfigurationError) {
        console.error(`FAIL ${label}: ${error.message}`);
      } else {
        const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        const safeCode = typeof code === "string" && /^[\w.-]{1,100}$/.test(code) ? ` (${code})` : "";
        console.error(`FAIL ${label}: ${typeof status === "number" ? `HTTP ${status}` : "provider request failed"}${safeCode}. Credentials and response bodies are omitted.`);
      }
      return undefined;
    }
  };
  const brief = { subject: "A simple centrifugal water pump", locale: "en", visualStyle: "isometric" } as const;
  await check(`planning (${config.vision.deployment || "deployment missing"})`, () => planDiagramParts(brief));
  for (const model of status.imageModels) {
    if (!model.configured) {
      console.log(`SKIP ${model.id}: endpoint, deployment, or credentials are not configured.`);
      continue;
    }
    const input: GenerateDiagramRequest = {
      ...brief,
      diagramType: "cutaway",
      audience: "students",
      imageModel: model.id,
      parts: [
        { id: "casing", name: "Casing", description: "The outer pump housing." },
        { id: "impeller", name: "Impeller", description: "The rotating vanes inside the casing." },
        { id: "shaft", name: "Shaft", description: "The drive shaft connected to the impeller." },
        { id: "inlet", name: "Inlet", description: "The opening where water enters." },
      ],
    };
    const image = await check(`image generation ${model.label} (${model.deployment})`, () => generateAzureImage(input));
    if (image) {
      await check(`spatial grounding (${config.vision.deployment}) for ${model.id}`, () => locateDiagramParts(input, image.src));
    }
  }
  if (!status.imageModels.some((model) => model.configured)) {
    failed = true;
    console.error("FAIL no image profile is configured.");
  }
  if (!status.imageModels.find((model) => model.id === config.defaultImageModel)?.configured) {
    failed = true;
    console.error("FAIL the default image profile is not configured.");
  }
  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof AzureConfigurationError
    ? error.message
    : "Azure check could not load or validate the environment. Check the file path and settings; credentials are omitted.");
  process.exitCode = 1;
});
