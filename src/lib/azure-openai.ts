import OpenAI from "openai";

import {
  type AzureStatus,
  type DiagramImage,
  type GenerateDiagramRequest,
  type ImageModel,
  type VisionModelPayload,
  VisionModelPayloadSchema,
  visionAnnotationJsonSchema,
} from "@/lib/contracts";
import {
  buildImagePrompt,
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
} from "@/lib/prompts";

type VisionApi = "responses" | "chat-completions";

interface AzureResourceConfig {
  apiKey: string;
  endpoint: string;
  deployment: string;
}

interface GeneratedImage extends DiagramImage {
  prompt: string;
}

export class AzureConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AzureConfigurationError";
  }
}

function firstEnvironmentValue(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function normalizeAzureBaseURL(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/\/openai\/v1$/i.test(trimmed)) return `${trimmed}/`;
  if (/\/openai$/i.test(trimmed)) return `${trimmed}/v1/`;
  return `${trimmed}/openai/v1/`;
}

function visionConfig(): AzureResourceConfig {
  return {
    endpoint: firstEnvironmentValue(
      "AZURE_VISION_ENDPOINT",
      "AZURE_OPENAI_ENDPOINT",
    ),
    apiKey: firstEnvironmentValue(
      "AZURE_VISION_API_KEY",
      "AZURE_OPENAI_API_KEY",
    ),
    deployment:
      firstEnvironmentValue("AZURE_VISION_DEPLOYMENT") || "gpt-5.6-terra",
  };
}

function imageConfig(model: ImageModel): AzureResourceConfig {
  const isMai = model === "mai-image-2.5";
  const prefix = isMai ? "AZURE_MAI_IMAGE" : "AZURE_GPT_IMAGE";
  const dedicatedEndpoint = firstEnvironmentValue(`${prefix}_ENDPOINT`);
  const sharedEndpoint = firstEnvironmentValue("AZURE_OPENAI_ENDPOINT");
  const endpoint =
    dedicatedEndpoint ||
    (!isMai || /\.services\.ai\.azure\.com(?:\/|$)/i.test(sharedEndpoint)
      ? sharedEndpoint
      : "");
  return {
    endpoint,
    apiKey: firstEnvironmentValue(
      `${prefix}_API_KEY`,
      "AZURE_OPENAI_API_KEY",
    ),
    deployment:
      firstEnvironmentValue(`${prefix}_DEPLOYMENT`) ||
      (isMai ? "MAI-Image-2.5" : "gpt-image-2"),
  };
}

function isConfigured(config: AzureResourceConfig): boolean {
  return Boolean(config.apiKey && config.endpoint && config.deployment);
}

function requireConfig(
  config: AzureResourceConfig,
  label: string,
): AzureResourceConfig {
  if (!config.endpoint) {
    throw new AzureConfigurationError(
      `${label} 缺少 Azure endpoint。请设置专用 endpoint 或 AZURE_OPENAI_ENDPOINT。`,
    );
  }
  if (!config.apiKey) {
    throw new AzureConfigurationError(
      `${label} 缺少 API key。请设置专用 key 或 AZURE_OPENAI_API_KEY。`,
    );
  }
  return config;
}

export function getAzureStatus(): AzureStatus {
  const vision = visionConfig();
  const gptImage = imageConfig("gpt-image-2");
  const maiImage = imageConfig("mai-image-2.5");
  const visionConfigured = isConfigured(vision);
  const imageModels = {
    "gpt-image-2": isConfigured(gptImage),
    "mai-image-2.5": isConfigured(maiImage),
  };

  return {
    configured:
      visionConfigured &&
      (imageModels["gpt-image-2"] || imageModels["mai-image-2.5"]),
    visionConfigured,
    imageModels,
    deployments: {
      vision: vision.deployment,
      gptImage: gptImage.deployment,
      maiImage: maiImage.deployment,
    },
  };
}

function requestTimeout(): number {
  const configured = Number(process.env.AZURE_REQUEST_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return 180_000;
  return Math.min(300_000, Math.max(10_000, configured));
}

function client(
  config: AzureResourceConfig,
  defaultQuery?: Record<string, string>,
): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: normalizeAzureBaseURL(config.endpoint),
    defaultQuery,
    timeout: requestTimeout(),
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

function configuredImageSize(model: ImageModel): {
  size: "1024x1024" | "1536x1024" | "1024x1536";
  width: number;
  height: number;
} {
  const key =
    model === "mai-image-2.5"
      ? "AZURE_MAI_IMAGE_SIZE"
      : "AZURE_GPT_IMAGE_SIZE";
  const fallback = model === "mai-image-2.5" ? "1024x1024" : "1536x1024";
  const size = firstEnvironmentValue(key) || fallback;
  if (size === "1024x1536") return { size, width: 1024, height: 1536 };
  if (size === "1536x1024") return { size, width: 1536, height: 1024 };
  return { size: "1024x1024", width: 1024, height: 1024 };
}

function mimeTypeFor(format: string | undefined): string {
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}

async function remoteImageToDataURL(url: string, mimeType: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("图片服务返回了非 HTTPS URL，已拒绝下载。 ");
  }

  const response = await fetch(parsed, {
    signal: AbortSignal.timeout(requestTimeout()),
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`图片下载失败（HTTP ${response.status}）。`);
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > 25 * 1024 * 1024) {
    throw new Error("图片响应超过 25 MB 安全上限。 ");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > 25 * 1024 * 1024) {
    throw new Error("图片响应超过 25 MB 安全上限。 ");
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
): Promise<{ src: string; revisedPrompt: string | null }> {
  if (item.b64_json) {
    return Promise.resolve({
      src: `data:${mimeType};base64,${item.b64_json}`,
      revisedPrompt: item.revised_prompt ?? null,
    });
  }
  if (item.url) {
    return remoteImageToDataURL(item.url, mimeType).then((src) => ({
      src,
      revisedPrompt: item.revised_prompt ?? null,
    }));
  }
  throw new Error("Azure 图片响应缺少 b64_json 或 url。 ");
}

async function generateMaiImage(
  config: AzureResourceConfig,
  prompt: string,
  dimensions: { width: number; height: number },
): Promise<{ src: string; revisedPrompt: null }> {
  const response = await fetch(normalizeMaiImageURL(config.endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey,
    },
    body: JSON.stringify({
      model: config.deployment,
      prompt,
      width: dimensions.width,
      height: dimensions.height,
    }),
    signal: AbortSignal.timeout(requestTimeout()),
  });
  if (!response.ok) {
    throw new Error(`MAI 图片生成失败（HTTP ${response.status}）。`);
  }
  const payload = (await response.json()) as { data?: ImageResponseItem[] };
  const item = payload.data?.[0];
  if (!item) throw new Error("MAI 图片模型没有返回图片。 ");
  const result = await imageFromResponseItem(item, "image/png");
  return { src: result.src, revisedPrompt: null };
}

export async function generateAzureImage(
  input: GenerateDiagramRequest,
): Promise<GeneratedImage> {
  const imageLabel =
    input.imageModel === "mai-image-2.5"
      ? "MAI 图片模型（AZURE_MAI_IMAGE_ENDPOINT 需指向 .services.ai.azure.com 资源）"
      : "GPT 图片模型";
  const config = requireConfig(imageConfig(input.imageModel), imageLabel);
  const prompt = buildImagePrompt(input);
  const dimensions = configuredImageSize(input.imageModel);
  const quality = firstEnvironmentValue("AZURE_IMAGE_QUALITY") || "medium";

  if (input.imageModel === "mai-image-2.5") {
    const image = await generateMaiImage(config, prompt, dimensions);
    return {
      src: image.src,
      mimeType: "image/png",
      width: dimensions.width,
      height: dimensions.height,
      revisedPrompt: image.revisedPrompt,
      prompt,
    };
  }

  const response = await client(config, { "api-version": "preview" }).images.generate({
    model: config.deployment,
    prompt,
    n: 1,
    size: dimensions.size,
    quality: quality as "low" | "medium" | "high" | "auto",
  });

  const item = response.data?.[0];
  if (!item) throw new Error("Azure 图片模型没有返回图片。 ");
  const outputFormat =
    "output_format" in item ? String(item.output_format) : "png";
  const mimeType = mimeTypeFor(outputFormat);
  const image = await imageFromResponseItem(item, mimeType);

  return {
    src: image.src,
    mimeType,
    width: dimensions.width,
    height: dimensions.height,
    revisedPrompt: image.revisedPrompt,
    prompt,
  };
}

function parseStructuredText(text: string): VisionModelPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("视觉模型没有返回有效 JSON。 ");
  }
  return VisionModelPayloadSchema.parse(parsed);
}

function selectedVisionApi(): VisionApi {
  return process.env.AZURE_VISION_API === "chat-completions"
    ? "chat-completions"
    : "responses";
}

async function locateWithResponses(
  config: AzureResourceConfig,
  input: GenerateDiagramRequest,
  imageDataURL: string,
): Promise<VisionModelPayload> {
  const response = await client(config).responses.create({
    model: config.deployment,
    store: false,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: buildVisionSystemPrompt() }],
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
  });

  if (!response.output_text) {
    throw new Error("视觉模型响应中没有 output_text。 ");
  }
  return parseStructuredText(response.output_text);
}

async function locateWithChatCompletions(
  config: AzureResourceConfig,
  input: GenerateDiagramRequest,
  imageDataURL: string,
): Promise<VisionModelPayload> {
  const response = await client(config).chat.completions.create({
    model: config.deployment,
    messages: [
      { role: "system", content: buildVisionSystemPrompt() },
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
  });

  const text = response.choices[0]?.message.content;
  if (!text) throw new Error("视觉模型响应中没有文本内容。 ");
  return parseStructuredText(text);
}

export async function locateDiagramParts(
  input: GenerateDiagramRequest,
  imageDataURL: string,
): Promise<VisionModelPayload> {
  const config = requireConfig(visionConfig(), "视觉模型");
  return selectedVisionApi() === "chat-completions"
    ? locateWithChatCompletions(config, input, imageDataURL)
    : locateWithResponses(config, input, imageDataURL);
}
