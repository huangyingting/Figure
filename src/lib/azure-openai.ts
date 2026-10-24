import OpenAI from "openai";
import { AggregateAuthenticationError, DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

import { loadApplicationEnv } from "../../scripts/application-env.mjs";
import {
  type AzureStatus,
  type DiagramPlan,
  DiagramPlanSchema,
  type DiagramImage,
  type GenerateDiagramRequest,
  type PlanDiagramRequest,
  type VisionModelPayload,
  VisionModelPayloadSchema,
  diagramPlanJsonSchema,
  visionAnnotationJsonSchema,
} from "@/lib/contracts";
import {
  buildImagePrompt,
  buildPlanSystemPrompt,
  buildPlanUserPrompt,
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
} from "@/lib/prompts";
import { makeBackgroundTransparent } from "@/lib/image-transparency";
import {
  AzureConfigurationError,
  getAzureConfig,
  getAzureImageConfig,
  isAzureResourceConfigured,
  requireAzureResource,
  type AzureResourceConfig,
} from "@/lib/azure-config";

export { AzureConfigurationError } from "@/lib/azure-config";

interface GeneratedImage extends DiagramImage {
  prompt: string;
}

export function normalizeAzureBaseURL(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/\/openai\/v1$/i.test(trimmed)) return `${trimmed}/`;
  if (/\/openai$/i.test(trimmed)) return `${trimmed}/v1/`;
  return `${trimmed}/openai/v1/`;
}

let tokenProvider: (() => Promise<string>) | undefined;
const entraEndpoints = new Set<string>();

async function azureRequest<T>(
  config: AzureResourceConfig,
  execute: (token: string, bearer: boolean) => Promise<T>,
): Promise<T> {
  const mode = config.authMode;
  const useEntra = mode === "entra" || (mode === "auto" && entraEndpoints.has(config.endpoint));
  const withEntra = async () => {
    try {
      loadApplicationEnv();
      tokenProvider ??= getBearerTokenProvider(new DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default");
      return await execute(await tokenProvider(), true);
    } catch (error) {
      if (error instanceof AggregateAuthenticationError) {
        throw new AzureConfigurationError("Azure authentication is unavailable. Configure a managed identity, workload identity, or Azure CLI login for the resource.", { cause: error });
      }
      if (error && typeof error === "object" && "code" in error &&
          error.code === "Tenant provided in token does not match resource token") {
        throw new AzureConfigurationError("The Azure identity belongs to a different tenant than the configured resource. Use credentials from the resource tenant.", { cause: error });
      }
      throw error;
    }
  };
  if (useEntra) return withEntra();
  try {
    return await execute(config.apiKey, false);
  } catch (error) {
    if (mode !== "auto" || !error || typeof error !== "object" ||
        !("code" in error) || error.code !== "AuthenticationTypeDisabled") throw error;
    entraEndpoints.add(config.endpoint);
    return withEntra();
  }
}

export function getAzureStatus(): AzureStatus {
  const { vision, images, defaultImageModel } = getAzureConfig();
  const visionConfigured = isAzureResourceConfigured(vision);
  const imageModels = Object.values(images).map((model) => ({
    id: model.id,
    label: model.label,
    api: model.api,
    deployment: model.deployment,
    configured: isAzureResourceConfigured(model),
  }));

  return {
    configured:
      visionConfigured &&
      imageModels.some((model) => model.configured),
    visionConfigured,
    imageModels,
    defaultImageModel,
    deployments: {
      vision: vision.deployment,
    },
  };
}

function client(
  config: AzureResourceConfig,
  defaultQuery?: Record<string, string>,
): OpenAI {
  // The SDK reads OPENAI_* settings directly, including custom request headers.
  loadApplicationEnv();
  return new OpenAI({
    apiKey: config.apiKey,
    adminAPIKey: null,
    organization: null,
    project: null,
    baseURL: normalizeAzureBaseURL(config.endpoint),
    defaultQuery,
    timeout: config.timeoutMs,
    maxRetries: 1,
  });
}

export function normalizeMaiImageURL(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/\/mai\/v1\/images\/generations$/i.test(trimmed)) return trimmed;
  const resourceRoot = trimmed
    .replace(/\/openai\/v1$/i, "")
    .replace(/\/mai\/v1$/i, "");
  return `${resourceRoot}/mai/v1/images/generations`;
}

function mimeTypeFor(format: string | undefined): string {
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}

async function remoteImageToDataURL(url: string, mimeType: string, timeoutMs: number): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("The image service returned a non-HTTPS URL, so the download was blocked.");
  }

  const response = await fetch(parsed, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Image download failed (HTTP ${response.status}).`);
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > 25 * 1024 * 1024) {
    throw new Error("The image response exceeds the 25 MB safety limit.");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > 25 * 1024 * 1024) {
    throw new Error("The image response exceeds the 25 MB safety limit.");
  }
  const responseMime = response.headers.get("content-type")?.split(";")[0];
  return `data:${responseMime || mimeType};base64,${bytes.toString("base64")}`;
}

interface ImageResponseItem {
  b64_json?: string;
  url?: string;
  revised_prompt?: string;
}

function imageFromResponseItem(
  item: ImageResponseItem,
  mimeType: string,
  timeoutMs: number,
): Promise<{ src: string; revisedPrompt: string | null }> {
  if (item.b64_json) {
    return Promise.resolve({
      src: `data:${mimeType};base64,${item.b64_json}`,
      revisedPrompt: item.revised_prompt ?? null,
    });
  }
  if (item.url) {
    return remoteImageToDataURL(item.url, mimeType, timeoutMs).then((src) => ({
      src,
      revisedPrompt: item.revised_prompt ?? null,
    }));
  }
  throw new Error("The Azure image response contains neither b64_json nor a URL.");
}

async function imageWithTransparentBackground(src: string): Promise<{
  src: string;
  mimeType: "image/png";
  width: number;
  height: number;
}> {
  const match = /^data:[^;]+;base64,(.+)$/s.exec(src);
  if (!match) {
    throw new Error("The generated image is not a base64 data URL.");
  }
  const image = await makeBackgroundTransparent(
    Buffer.from(match[1], "base64"),
  );
  return {
    src: `data:image/png;base64,${image.bytes.toString("base64")}`,
    mimeType: "image/png",
    width: image.width,
    height: image.height,
  };
}

async function generateMaiImage(
  config: AzureResourceConfig,
  prompt: string,
  dimensions: { width: number; height: number },
): Promise<{ src: string; revisedPrompt: null }> {
  const response = await azureRequest(config, async (token, bearer) => {
    const response = await fetch(normalizeMaiImageURL(config.endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${token}` } : { "api-key": token }),
      },
      body: JSON.stringify({
        model: config.deployment,
        prompt,
        width: dimensions.width,
        height: dimensions.height,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (response.status === 403) {
      const text = await response.clone().text();
      let payload: { error?: { code?: string } } | undefined;
      try { payload = JSON.parse(text); } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
      if (payload?.error?.code === "AuthenticationTypeDisabled") {
        throw Object.assign(new Error("Key based authentication is disabled for this resource."), { code: "AuthenticationTypeDisabled" });
      }
    }
    return response;
  });
  if (!response.ok) {
    throw Object.assign(new Error(`MAI image generation failed (HTTP ${response.status}).`), { status: response.status });
  }
  const payload = (await response.json()) as { data?: ImageResponseItem[] };
  const item = payload.data?.[0];
  if (!item) throw new Error("The MAI image model returned no image.");
  const result = await imageFromResponseItem(item, "image/png", config.timeoutMs);
  return { src: result.src, revisedPrompt: null };
}

export async function generateAzureImage(
  input: GenerateDiagramRequest,
): Promise<GeneratedImage> {
  const azure = getAzureConfig();
  const model = getAzureImageConfig(input.imageModel, azure);
  const config = requireAzureResource(model, `Image model "${model.id}"`);
  const prompt = buildImagePrompt(input);
  const dimensions = model;

  if (model.api === "mai") {
    const image = await generateMaiImage(config, prompt, dimensions);
    const transparentImage = await imageWithTransparentBackground(image.src);
    return {
      ...transparentImage,
      revisedPrompt: image.revisedPrompt,
      prompt,
    };
  }

  const response = await azureRequest(config, (token) => client({ ...config, apiKey: token }, { "api-version": "preview" }).images.generate({
    model: config.deployment,
    prompt,
    n: 1,
    size: dimensions.size,
    quality: model.quality,
  }));

  const item = response.data?.[0];
  if (!item) throw new Error("The Azure image model returned no image.");
  const outputFormat =
    "output_format" in item ? String(item.output_format) : "png";
  const mimeType = mimeTypeFor(outputFormat);
  const image = await imageFromResponseItem(item, mimeType, config.timeoutMs);
  const transparentImage = await imageWithTransparentBackground(image.src);

  return {
    ...transparentImage,
    revisedPrompt: image.revisedPrompt,
    prompt,
  };
}

function parseStructuredText(text: string): VisionModelPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The vision model did not return valid JSON.");
  }
  const result = VisionModelPayloadSchema.safeParse(parsed);
  if (!result.success) throw new Error("The vision model returned an invalid annotation.", { cause: result.error });
  return result.data;
}

function parsePlanText(text: string): DiagramPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The planning model did not return valid JSON.");
  }
  const result = DiagramPlanSchema.safeParse(parsed);
  if (!result.success) throw new Error("The planning model returned an invalid plan.", { cause: result.error });
  return result.data;
}

export async function planDiagramParts(
  input: PlanDiagramRequest,
): Promise<DiagramPlan> {
  const azure = getAzureConfig();
  const config = requireAzureResource(azure.vision, "AZURE_VISION");

  if (azure.visionApi === "chat-completions") {
    const response = await azureRequest(config, (token) => client({ ...config, apiKey: token }).chat.completions.create({
      model: config.deployment,
      messages: [
        { role: "system", content: buildPlanSystemPrompt(input.locale) },
        { role: "user", content: buildPlanUserPrompt(input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "diagram_component_plan",
          strict: true,
          schema: diagramPlanJsonSchema,
        },
      },
    }));
    const text = response.choices[0]?.message.content;
    if (!text) throw new Error("The planning model returned no content.");
    return parsePlanText(text);
  }

  const response = await azureRequest(config, (token) => client({ ...config, apiKey: token }).responses.create({
    model: config.deployment,
    store: false,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: buildPlanSystemPrompt(input.locale) }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: buildPlanUserPrompt(input) }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "diagram_component_plan",
        strict: true,
        schema: diagramPlanJsonSchema,
      },
    },
    max_output_tokens: 2400,
  }));
  if (!response.output_text) {
    throw new Error("The planning model returned no output text.");
  }
  return parsePlanText(response.output_text);
}

async function locateWithResponses(
  config: AzureResourceConfig,
  input: GenerateDiagramRequest,
  imageDataURL: string,
): Promise<VisionModelPayload> {
  const response = await azureRequest(config, (token) => client({ ...config, apiKey: token }).responses.create({
    model: config.deployment,
    store: false,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: buildVisionSystemPrompt(input.locale) }],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: buildVisionUserPrompt(input) },
          {
            type: "input_image",
            image_url: imageDataURL,
            detail: "high",
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "diagram_spatial_annotation",
        strict: true,
        schema: visionAnnotationJsonSchema,
      },
    },
    max_output_tokens: 6000,
  }));

  if (!response.output_text) {
    throw new Error("The vision model response contains no output text.");
  }
  return parseStructuredText(response.output_text);
}

async function locateWithChatCompletions(
  config: AzureResourceConfig,
  input: GenerateDiagramRequest,
  imageDataURL: string,
): Promise<VisionModelPayload> {
  const response = await azureRequest(config, (token) => client({ ...config, apiKey: token }).chat.completions.create({
    model: config.deployment,
    messages: [
      { role: "system", content: buildVisionSystemPrompt(input.locale) },
      {
        role: "user",
        content: [
          { type: "text", text: buildVisionUserPrompt(input) },
          {
            type: "image_url",
            image_url: { url: imageDataURL, detail: "high" },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "diagram_spatial_annotation",
        strict: true,
        schema: visionAnnotationJsonSchema,
      },
    },
  }));

  const text = response.choices[0]?.message.content;
  if (!text) throw new Error("The vision model response contains no text.");
  return parseStructuredText(text);
}

export async function locateDiagramParts(
  input: GenerateDiagramRequest,
  imageDataURL: string,
): Promise<VisionModelPayload> {
  const azure = getAzureConfig();
  const config = requireAzureResource(azure.vision, "AZURE_VISION");
  return azure.visionApi === "chat-completions"
    ? locateWithChatCompletions(config, input, imageDataURL)
    : locateWithResponses(config, input, imageDataURL);
}
