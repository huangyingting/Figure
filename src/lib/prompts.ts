import type { GenerateDiagramRequest, PartSpec } from "@/lib/contracts";

const diagramTypeLabels = {
  anatomy: "scientific anatomical cutaway",
  cutaway: "technical cutaway",
  exploded: "exploded assembly",
  construction: "construction diagram",
} as const;

function partLines(parts: PartSpec[]): string {
  return parts
    .map(
      (part, index) =>
        `${index + 1}. [${part.id}] ${part.name}: ${part.description}`,
    )
    .join("\n");
}

export function buildImagePrompt(input: GenerateDiagramRequest): string {
  return [
    `Create a precise ${diagramTypeLabels[input.diagramType]} of: ${input.subject}.`,
    `Audience: ${input.audience}.`,
    "The image will receive a separate interactive SVG annotation layer, so make spatial identification unambiguous.",
    "Show every requested component clearly when physically possible. Use a clean three-quarter or orthographic composition, coherent scale, restrained educational colors, crisp boundaries, and generous neutral margin around the subject for external callout lines.",
    "Do not draw any words, letters, numbers, legends, arrows, leader lines, watermarks, UI, or captions inside the image.",
    "Do not invent extra internal structures that would make the requested components ambiguous.",
    "Requested components:",
    partLines(input.parts),
  ].join("\n");
}

export function buildVisionSystemPrompt(): string {
  return [
    "You are the spatial-grounding stage of an educational diagram pipeline.",
    "Analyze only visible pixels. Never claim that an obscured or absent component is visible.",
    "Return one result for every requested component ID and no additional components.",
    "All coordinates are normalized to the image: top-left is (0,0), bottom-right is (1,1).",
    "anchor must land on a representative visible pixel of that component, not on nearby whitespace or another component.",
    "box is the tight visible bounding box. If a component is absent or cannot be distinguished, set visible=false, confidence=0, anchor=(0.5,0.5), box=(0,0,0,0), and explain why in evidence.",
    "Confidence is a number from 0 to 1. Mention ambiguity, occlusion, or possible structural errors in warnings.",
    "This is a draft for human review, not a medical or engineering certification.",
  ].join("\n");
}

export function buildVisionUserPrompt(input: GenerateDiagramRequest): string {
  return [
    `Diagram subject: ${input.subject}`,
    `Diagram type: ${diagramTypeLabels[input.diagramType]}`,
    `Audience: ${input.audience}`,
    "Locate these exact component IDs:",
    partLines(input.parts),
    "Keep each supplied name and description semantically faithful. Describe what the image visibly shows; do not silently repair an inaccurate generated image.",
  ].join("\n");
}
