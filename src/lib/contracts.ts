import { z } from "zod";

export const DiagramTypeSchema = z.enum([
  "anatomy",
  "cutaway",
  "exploded",
  "construction",
]);

export const ImageModelSchema = z.enum(["gpt-image-2", "mai-image-2.5"]);

export const PartSpecSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .regex(
      /^[a-z0-9][a-z0-9_-]*$/i,
      "Component IDs may only contain letters, numbers, underscores, and hyphens",
    ),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
});

export const DiagramBriefSchema = z.object({
  subject: z.string().trim().min(2).max(240),
  diagramType: DiagramTypeSchema,
  audience: z.string().trim().min(1).max(120),
  imageModel: ImageModelSchema,
});

export const PlanDiagramRequestSchema = z.object({
  subject: z.string().trim().min(2).max(240),
});

export const DiagramPlanSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    diagramType: DiagramTypeSchema,
    audience: z.string().trim().min(1).max(120),
    visualDirection: z.string().trim().min(1).max(1500),
    parts: z.array(PartSpecSchema).min(4).max(9),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    for (const [index, part] of value.parts.entries()) {
      const key = part.id.toLowerCase();
      if (ids.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate component ID: ${part.id}`,
          path: ["parts", index, "id"],
        });
      }
      ids.add(key);
    }
  });

export const GenerateDiagramRequestSchema = z
  .object({
    ...DiagramBriefSchema.shape,
    visualDirection: z.string().trim().min(1).max(1500).optional(),
    parts: z.array(PartSpecSchema).min(2).max(12),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    for (const [index, part] of value.parts.entries()) {
      const key = part.id.toLowerCase();
      if (ids.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate component ID: ${part.id}`,
          path: ["parts", index, "id"],
        });
      }
      ids.add(key);
    }
  });

export type DiagramType = z.infer<typeof DiagramTypeSchema>;
export type ImageModel = z.infer<typeof ImageModelSchema>;
export type PartSpec = z.infer<typeof PartSpecSchema>;
export type DiagramBrief = z.infer<typeof DiagramBriefSchema>;
export type DiagramPlan = z.infer<typeof DiagramPlanSchema>;
export type PlanDiagramRequest = z.infer<typeof PlanDiagramRequestSchema>;
export type GenerateDiagramRequest = z.infer<
  typeof GenerateDiagramRequestSchema
>;

export type ReviewStatus = "ai-draft" | "human-edited" | "approved";

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox extends Point {
  width: number;
  height: number;
}

export interface AnnotatedPart extends PartSpec {
  index: number;
  visible: boolean;
  anchor: Point;
  box: BoundingBox;
  confidence: number;
  evidence: string;
  reviewStatus: ReviewStatus;
}

export interface DiagramAnnotation {
  title: string;
  summary: string;
  parts: AnnotatedPart[];
  warnings: string[];
}

export interface DiagramImage {
  src: string;
  mimeType: string;
  width: number;
  height: number;
  revisedPrompt: string | null;
}

export interface DiagramProvenance {
  source: "azure-generated" | "offline-demo";
  imageModel: string;
  visionModel: string;
  generatedAt: string;
  reviewRequired: true;
}

export interface DiagramResult {
  id: string;
  image: DiagramImage;
  annotation: DiagramAnnotation;
  provenance: DiagramProvenance;
}

export interface AzureStatus {
  configured: boolean;
  visionConfigured: boolean;
  imageModels: Record<ImageModel, boolean>;
  deployments: {
    vision: string;
    gptImage: string;
    maiImage: string;
  };
}

const VisionPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const VisionModelPayloadSchema = z.object({
  title: z.string(),
  summary: z.string(),
  parts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      visible: z.boolean(),
      anchor: VisionPointSchema,
      box: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
      confidence: z.number(),
      evidence: z.string(),
    }),
  ),
  warnings: z.array(z.string()),
});

export type VisionModelPayload = z.infer<typeof VisionModelPayloadSchema>;

const unit = z.number().min(0).max(1);
const ReviewStatusSchema = z.enum(["ai-draft", "human-edited", "approved"]);

export const AnnotationUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(1000),
  parts: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(48),
        index: z.number().int().min(0).max(99),
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().min(1).max(500),
        visible: z.boolean(),
        anchor: z.object({ x: unit, y: unit }),
        box: z.object({ x: unit, y: unit, width: unit, height: unit }),
        confidence: unit,
        evidence: z.string().max(600),
        reviewStatus: ReviewStatusSchema,
      }),
    )
    .min(1)
    .max(12),
  warnings: z.array(z.string().max(500)).max(30),
});

export type AnnotationUpdate = z.infer<typeof AnnotationUpdateSchema>;

export const diagramPlanJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    diagramType: {
      type: "string",
      enum: ["anatomy", "cutaway", "exploded", "construction"],
    },
    audience: { type: "string" },
    visualDirection: { type: "string", maxLength: 1500 },
    parts: {
      type: "array",
      minItems: 4,
      maxItems: 9,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "name", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "diagramType", "audience", "visualDirection", "parts"],
  additionalProperties: false,
} as const;

const pointSchema = {
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
  },
  required: ["x", "y"],
  additionalProperties: false,
} as const;

export const visionAnnotationJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          visible: { type: "boolean" },
          anchor: pointSchema,
          box: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
            required: ["x", "y", "width", "height"],
            additionalProperties: false,
          },
          confidence: { type: "number" },
          evidence: { type: "string" },
        },
        required: [
          "id",
          "name",
          "description",
          "visible",
          "anchor",
          "box",
          "confidence",
          "evidence",
        ],
        additionalProperties: false,
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["title", "summary", "parts", "warnings"],
  additionalProperties: false,
} as const;
