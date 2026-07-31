import type {
  GenerateDiagramRequest,
  PartSpec,
  PlanDiagramRequest,
} from "@/lib/contracts";

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

export function buildPlanSystemPrompt(): string {
  return [
    "You are the planning stage of an educational visual-generation pipeline.",
    "Turn a topic into a concise inventory of the most visually meaningful components for one diagram.",
    "Infer the most useful diagram format: anatomy for natural or biological structures, cutaway for hidden internal systems, exploded for assembly relationships, and construction for layered or built structures.",
    "Infer a concise audience description from the topic. Use curious adult learners when the user does not signal a specific audience, and honor phrases such as for children, for technicians, or for engineering students.",
    "Choose 4 to 9 components that can coexist clearly in a single image. Prefer concrete visible structures over abstract concepts.",
    "Use short English component names and one-sentence English descriptions.",
    "Create stable lowercase snake_case IDs containing only letters, numbers, and underscores. IDs must be unique.",
    "The visual direction should specify composition, viewpoint, and what must be visibly distinguishable. Do not request labels or text inside the image.",
    "If the subject is broad, choose a representative system or scene instead of producing an exhaustive list.",
  ].join("\n");
}

export function buildPlanUserPrompt(input: PlanDiagramRequest): string {
  return [
    `Topic: ${input.subject}`,
    "Infer and return the best diagramType and audience from the topic itself.",
    "Return an English title, the inferred format and audience, a practical visual direction, and the component inventory for the image-generation and spatial-grounding stages.",
  ].join("\n");
}

export function buildImagePrompt(input: GenerateDiagramRequest): string {
  return [
    `Create a precise ${diagramTypeLabels[input.diagramType]} of: ${input.subject}.`,
    `Audience: ${input.audience}.`,
    input.visualDirection ? `Planned visual direction: ${input.visualDirection}` : "",
    "The image will receive a separate interactive SVG annotation layer, so make spatial identification unambiguous.",
    "Show every requested component clearly when physically possible. Use a clean three-quarter or orthographic composition, coherent scale, restrained educational colors, crisp boundaries, and generous neutral margin around the subject for external callout lines.",
    "Do not draw any words, letters, numbers, legends, arrows, leader lines, watermarks, UI, or captions inside the image.",
    "Do not invent extra internal structures that would make the requested components ambiguous.",
    "Requested components:",
    partLines(input.parts),
  ].filter(Boolean).join("\n");
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
