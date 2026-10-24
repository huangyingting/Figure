import { z } from "zod";

import { readApplicationEnv } from "../../scripts/application-env.mjs";
import { ImageModelSchema, type ImageModel } from "@/lib/contracts";

export class AzureConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AzureConfigurationError";
  }
}

export class UnknownImageModelError extends Error {
  constructor() {
    super("The selected image model is not configured. Choose a model from the current model list.");
    this.name = "UnknownImageModelError";
  }
}

const authModeSchema = z.enum(["auto", "api-key", "entra"]);
const timeoutSchema = z.number().int().min(10_000).max(300_000);
const imageQualitySchema = z.enum(["low", "medium", "high", "auto"]);

export interface AzureResourceConfig {
  apiKey: string;
  endpoint: string;
  deployment: string;
  authMode: z.infer<typeof authModeSchema>;
  timeoutMs: number;
}

const imageSizeSchema = z.enum(["1024x1024", "1536x1024", "1024x1536"]);
const imageRegistrySchema = z.array(z.object({
  id: ImageModelSchema,
  label: z.string().trim().min(1).max(100),
  api: z.enum(["openai", "mai"]),
  endpoint: z.string().trim().url().regex(/^https?:\/\//i),
  deployment: z.string().trim().min(1),
  apiKeyEnv: z.string().regex(/^[A-Z_][A-Z0-9_]*$/).optional(),
  authMode: authModeSchema.optional(),
  size: imageSizeSchema.optional(),
  quality: imageQualitySchema.optional(),
  timeoutMs: timeoutSchema.optional(),
}).strict()).min(1).superRefine((models, context) => {
  const ids = new Set<string>();
  for (const [index, model] of models.entries()) {
    if (ids.has(model.id)) {
      context.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate image model ID" });
    }
    ids.add(model.id);
  }
});

export interface AzureImageConfig extends AzureResourceConfig {
  id: ImageModel;
  label: string;
  api: "openai" | "mai";
  size: z.infer<typeof imageSizeSchema>;
  width: number;
  height: number;
  quality: z.infer<typeof imageQualitySchema>;
}

type Environment = Readonly<Record<string, string | undefined>>;

function environmentValue(env: Environment, ...keys: string[]): string {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function setting<T>(env: Environment, key: string, schema: z.ZodType<T>, fallback: T): T {
  const value = environmentValue(env, key);
  if (!value) return fallback;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AzureConfigurationError(`${key} has an invalid value. Check .env.example for supported settings.`);
  }
  return result.data;
}

export function getAzureConfig(env: Environment = readApplicationEnv()) {
  const authMode = setting(env, "AZURE_AUTH_MODE", authModeSchema, "auto");
  const timeoutMs = setting(env, "AZURE_REQUEST_TIMEOUT_MS", z.coerce.number().pipe(timeoutSchema), 180_000);
  const imageQuality = setting(env, "AZURE_IMAGE_QUALITY", imageQualitySchema, "medium");
  const sharedEndpoint = environmentValue(env, "AZURE_OPENAI_ENDPOINT");
  const vision: AzureResourceConfig = {
    endpoint: environmentValue(env, "AZURE_VISION_ENDPOINT") || sharedEndpoint,
    apiKey: environmentValue(env, "AZURE_VISION_API_KEY", "AZURE_OPENAI_API_KEY"),
    deployment: environmentValue(env, "AZURE_VISION_DEPLOYMENT"),
    authMode: setting(env, "AZURE_VISION_AUTH_MODE", authModeSchema, authMode),
    timeoutMs: setting(env, "AZURE_VISION_TIMEOUT_MS", z.coerce.number().pipe(timeoutSchema), timeoutMs),
  };
  const dimensions = (size: z.infer<typeof imageSizeSchema>) => {
    const [width, height] = size.split("x").map(Number);
    return { size, width, height };
  };
  const registry = environmentValue(env, "AZURE_IMAGE_MODELS");
  if (!registry) {
    throw new AzureConfigurationError("AZURE_IMAGE_MODELS is required. Configure image models in .env using .env.example.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(registry);
  } catch {
    throw new AzureConfigurationError("AZURE_IMAGE_MODELS must be a valid JSON array. See .env.example.");
  }
  const result = imageRegistrySchema.safeParse(parsed);
  if (!result.success) {
    throw new AzureConfigurationError("AZURE_IMAGE_MODELS has invalid or duplicate model definitions. See .env.example.", { cause: result.error });
  }
  const models: AzureImageConfig[] = result.data.map((model) => ({
    id: model.id,
    label: model.label,
    api: model.api,
    endpoint: model.endpoint,
    deployment: model.deployment,
    apiKey: model.apiKeyEnv ? environmentValue(env, model.apiKeyEnv) : "",
    authMode: model.authMode ?? authMode,
    timeoutMs: model.timeoutMs ?? timeoutMs,
    quality: model.quality ?? imageQuality,
    ...dimensions(model.size ?? (model.api === "mai" ? "1024x1024" : "1536x1024")),
  }));
  const images = Object.fromEntries(models.map((model) => [model.id, model] as const));
  const defaultImageModel = setting(
    env,
    "AZURE_IMAGE_MODEL",
    ImageModelSchema,
    models.find((model) => isAzureResourceConfigured(model))?.id ?? models[0].id,
  );
  if (!Object.hasOwn(images, defaultImageModel)) {
    throw new AzureConfigurationError("AZURE_IMAGE_MODEL must name an ID in the configured image model list.");
  }
  return {
    authMode,
    timeoutMs,
    defaultImageModel,
    imageQuality,
    visionApi: setting(env, "AZURE_VISION_API", z.enum(["responses", "chat-completions"]), "responses"),
    vision,
    images,
  };
}

export function isAzureResourceConfigured(
  resource: AzureResourceConfig,
): boolean {
  return Boolean(resource.endpoint && resource.deployment && (resource.apiKey || resource.authMode === "entra"));
}

export function requireAzureResource(
  resource: AzureResourceConfig,
  label: string,
): AzureResourceConfig {
  if (!resource.endpoint) {
    throw new AzureConfigurationError(`${label} is missing an Azure endpoint. Check its endpoint configuration.`);
  }
  if (!resource.deployment) {
    throw new AzureConfigurationError(`${label} deployment is required. Set it to your Azure deployment name.`);
  }
  if (!resource.apiKey && resource.authMode !== "entra") {
    throw new AzureConfigurationError(`${label} is missing an API key. Check its credential environment variable or use Entra authentication.`);
  }
  return resource;
}

export function getAzureImageConfig(model: ImageModel, config = getAzureConfig()): AzureImageConfig {
  if (!Object.hasOwn(config.images, model)) throw new UnknownImageModelError();
  return config.images[model];
}

export function getAzureModelDeployments(model: ImageModel) {
  const config = getAzureConfig();
  return {
    imageModel: getAzureImageConfig(model, config).deployment,
    visionModel: config.vision.deployment,
  };
}
