import type {
  GenerateDiagramRequest,
  PartSpec,
  PlanDiagramRequest,
  VisualStyle,
} from "@/lib/contracts";

const diagramTypeLabels = {
  anatomy: "scientific anatomical cutaway",
  cutaway: "technical cutaway",
  exploded: "exploded assembly",
  construction: "construction diagram",
} as const;

const visualStyleDirections = {
  isometric: "Create a stylish isometric 3D illustration with an orthographic, equal-axis view. Use sculpted forms, crisp silhouettes, soft material shading within the subject, and a restrained teal, sage, warm coral, and graphite palette. Simplify surfaces without distorting the real component relationships; make the result feel like a polished editorial design object, not a toy.",
  realistic: "Create a refined, realistic technical illustration with physically plausible materials, proportions, and subtle studio lighting. Favor crisp engineering detail and a clean three-quarter or orthographic view over decorative effects.",
  blueprint: "Create an elegant blueprint-style technical illustration using precise navy and teal linework, restrained cyan accents, and selective solid fills. Keep the backdrop pure white for transparency, not blue paper. Do not add grids, measurements, text, or decorative drafting marks.",
} satisfies Record<VisualStyle, string>;

function outputLanguage(locale: "en" | "zh-CN"): string {
  return locale === "zh-CN"
    ? [
        "Write every user-facing field in natural Simplified Chinese (zh-CN).",
        "This includes the title, audience, visual direction, component names, descriptions, summary, visual evidence, and warnings.",
        "Keep component IDs in stable lowercase ASCII snake_case so downstream matching stays language-independent.",
      ].join(" ")
    : "Write every user-facing field in clear English.";
}

function partLines(parts: PartSpec[]): string {
  return parts
    .map(
      (part, index) =>
        `${index + 1}. [${part.id}] ${part.name}: ${part.description}`,
    )
    .join("\n");
}

export function buildPlanSystemPrompt(locale: "en" | "zh-CN" = "en"): string {
  return [
    "You are the planning stage of an educational visual-generation pipeline.",
    "Turn a topic into a concise inventory of the most visually meaningful components for one diagram.",
    "Infer the most useful diagram format: anatomy for natural or biological structures, cutaway for hidden internal systems, exploded for assembly relationships, and construction for layered or built structures.",
    "Infer a concise audience description from the topic. Use curious adult learners when the user does not signal a specific audience, and honor phrases such as for children, for technicians, or for engineering students.",
    "Choose 4 to 9 components that can coexist clearly in a single image. Prefer concrete visible structures over abstract concepts.",
    outputLanguage(locale),
    locale === "zh-CN"
      ? "Use short Simplified Chinese component names and one-sentence Simplified Chinese descriptions."
      : "Use short English component names and one-sentence English descriptions.",
    "Create stable lowercase snake_case IDs containing only letters, numbers, and underscores. IDs must be unique.",
    "The visual direction should specify composition, viewpoint, and what must be visibly distinguishable. Do not request labels or text inside the image.",
    "If the subject is broad, choose a representative system or scene instead of producing an exhaustive list.",
  ].join("\n");
}

export function buildPlanUserPrompt(input: PlanDiagramRequest): string {
  return [
    `Topic: ${input.subject}`,
    `Selected visual style: ${input.visualStyle}. ${visualStyleDirections[input.visualStyle]}`,
    "Compose the visual direction for this selected style; it is independent of the structural diagram format.",
    "Infer and return the best diagramType and audience from the topic itself.",
    input.locale === "zh-CN"
      ? "返回简体中文标题、推断出的格式与受众、实用的视觉方向，以及供图像生成和空间定位阶段使用的简体中文组件清单。"
      : "Return an English title, the inferred format and audience, a practical visual direction, and the component inventory for the image-generation and spatial-grounding stages.",
  ].join("\n");
}

export function buildImagePrompt(input: GenerateDiagramRequest): string {
  return [
    `Create a precise ${diagramTypeLabels[input.diagramType]} of: ${input.subject}.`,
    `Audience: ${input.audience}.`,
    input.visualDirection ? `Planned visual direction: ${input.visualDirection}` : "",
    `Selected visual style: ${input.visualStyle}. ${visualStyleDirections[input.visualStyle]}`,
    "Honor the selected visual style over any conflicting planned aesthetic, while preserving the requested structure and component inventory.",
    "The image will receive a separate interactive SVG annotation layer, so make spatial identification unambiguous.",
    "Isolate the subject on a perfectly uniform pure white (#FFFFFF) backdrop with no scene, floor, horizon, border, vignette, background texture, or cast shadow. Keep the subject separated from every image edge; the backdrop will be converted to a transparent alpha channel after generation.",
    "Show every requested component clearly when physically possible. Use a composition appropriate to the selected style, coherent scale, restrained educational colors, crisp boundaries, and generous transparent margin around the subject for external callout lines.",
    "Do not draw any words, letters, numbers, legends, arrows, leader lines, watermarks, UI, or captions inside the image.",
    "Do not invent extra internal structures that would make the requested components ambiguous.",
    input.locale === "zh-CN"
      ? "The source brief is in Simplified Chinese. Interpret its terminology faithfully while keeping the rendered image completely free of text."
      : "Interpret the English source brief faithfully while keeping the rendered image completely free of text.",
    "Requested components:",
    partLines(input.parts),
  ].filter(Boolean).join("\n");
}

export function buildVisionSystemPrompt(locale: "en" | "zh-CN" = "en"): string {
  return [
    "You are the spatial-grounding stage of an educational diagram pipeline.",
    "Analyze only visible pixels. Never claim that an obscured or absent component is visible.",
    "Return one result for every requested component ID and no additional components.",
    "All coordinates are normalized to the image: top-left is (0,0), bottom-right is (1,1).",
    "anchor must land on a representative visible pixel of that component, not on nearby whitespace or another component.",
    "box is the tight visible bounding box. If a component is absent or cannot be distinguished, set visible=false, confidence=0, anchor=(0.5,0.5), box=(0,0,0,0), and explain why in evidence.",
    "Confidence is a number from 0 to 1. Mention ambiguity, occlusion, or possible structural errors in warnings.",
    "This is a draft for human review, not a medical or engineering certification.",
    outputLanguage(locale),
  ].join("\n");
}

export function buildVisionUserPrompt(input: GenerateDiagramRequest): string {
  return [
    `Diagram subject: ${input.subject}`,
    `Diagram type: ${diagramTypeLabels[input.diagramType]}`,
    `Visual style: ${input.visualStyle}`,
    `Audience: ${input.audience}`,
    "Locate these exact component IDs:",
    partLines(input.parts),
    "Keep each supplied name and description semantically faithful. Describe what the image visibly shows; do not silently repair an inaccurate generated image.",
    input.locale === "zh-CN"
      ? "所有面向用户的返回字段必须使用简体中文，包括标题、摘要、组件名称、说明、视觉证据和警告；组件 ID 必须保持原样。"
      : "Return the title, summary, names, descriptions, visual evidence, and warnings in English; preserve component IDs exactly.",
  ].join("\n");
}
