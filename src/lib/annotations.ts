import type {
  AnnotatedPart,
  DiagramAnnotation,
  GenerateDiagramRequest,
  PartSpec,
  ReviewStatus,
  VisionModelPayload,
} from "@/lib/contracts";

const REVIEW_STATUSES: ReadonlySet<string> = new Set([
  "ai-draft",
  "human-edited",
  "approved",
]);

function normalizeStoredPart(raw: unknown, index: number): AnnotatedPart {
  const part = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const anchor = (part.anchor ?? {}) as Record<string, unknown>;
  const box = (part.box ?? {}) as Record<string, unknown>;
  const visible = Boolean(part.visible);
  const reviewStatus =
    typeof part.reviewStatus === "string" &&
    REVIEW_STATUSES.has(part.reviewStatus)
      ? (part.reviewStatus as ReviewStatus)
      : "ai-draft";
  return {
    id: typeof part.id === "string" && part.id ? part.id : `part-${index + 1}`,
    name: typeof part.name === "string" ? part.name : "Untitled component",
    description: typeof part.description === "string" ? part.description : "",
    index: typeof part.index === "number" && Number.isFinite(part.index) ? part.index : index,
    visible,
    anchor: { x: clamp01(anchor.x, 0.5), y: clamp01(anchor.y, 0.5) },
    box: {
      x: clamp01(box.x),
      y: clamp01(box.y),
      width: clamp01(box.width),
      height: clamp01(box.height),
    },
    confidence: clamp01(part.confidence),
    evidence: typeof part.evidence === "string" ? part.evidence : "",
    reviewStatus,
  };
}

export function parseStoredAnnotation(annotationJson: string): DiagramAnnotation {
  try {
    const parsed = JSON.parse(annotationJson) as Partial<DiagramAnnotation>;
    if (!parsed || !Array.isArray(parsed.parts)) throw new Error("missing parts");
    return {
      title: typeof parsed.title === "string" ? parsed.title : "Untitled figure",
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      parts: parsed.parts.map(normalizeStoredPart),
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.filter((w): w is string => typeof w === "string")
        : [],
    };
  } catch {
    return {
      title: "Untitled figure",
      summary: "This figure's annotation data could not be read.",
      parts: [],
      warnings: ["The stored annotation was malformed and could not be parsed."],
    };
  }
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function clamp01(value: unknown, fallback = 0): number {
  return Math.min(1, Math.max(0, finite(value, fallback)));
}

function missingPart(part: PartSpec, index: number): AnnotatedPart {
  return {
    ...part,
    index,
    visible: false,
    anchor: { x: 0.5, y: 0.5 },
    box: { x: 0, y: 0, width: 0, height: 0 },
    confidence: 0,
    evidence: "The vision model did not return this component; manual placement is required.",
    reviewStatus: "ai-draft",
  };
}

export function normalizeVisionPayload(
  payload: VisionModelPayload,
  request: GenerateDiagramRequest,
): DiagramAnnotation {
  const candidates = new Map(
    payload.parts.map((part) => [part.id.toLowerCase(), part]),
  );
  const warnings = [...payload.warnings];

  const parts = request.parts.map((expected, index) => {
    const candidate = candidates.get(expected.id.toLowerCase());
    if (!candidate) {
      warnings.push(`Component not located: ${expected.name} (${expected.id})`);
      return missingPart(expected, index);
    }

    const visible = Boolean(candidate.visible);
    const boxX = clamp01(candidate.box?.x);
    const boxY = clamp01(candidate.box?.y);
    const boxWidth = Math.min(
      clamp01(candidate.box?.width),
      Math.max(0, 1 - boxX),
    );
    const boxHeight = Math.min(
      clamp01(candidate.box?.height),
      Math.max(0, 1 - boxY),
    );

    return {
      ...expected,
      index,
      visible,
      anchor: visible
        ? {
            x: clamp01(candidate.anchor?.x, 0.5),
            y: clamp01(candidate.anchor?.y, 0.5),
          }
        : { x: 0.5, y: 0.5 },
      box: visible
        ? { x: boxX, y: boxY, width: boxWidth, height: boxHeight }
        : { x: 0, y: 0, width: 0, height: 0 },
      confidence: visible ? clamp01(candidate.confidence) : 0,
      evidence: String(candidate.evidence || "No visual evidence was provided.").slice(0, 600),
      reviewStatus: "ai-draft" as const,
    };
  });

  const returnedIds = new Set(request.parts.map((part) => part.id.toLowerCase()));
  const unexpected = payload.parts.filter(
    (part) => !returnedIds.has(part.id.toLowerCase()),
  );
  if (unexpected.length > 0) {
    warnings.push(
      `The vision model returned ${unexpected.length} unrequested component(s); they were ignored.`,
    );
  }

  return {
    title: String(payload.title || request.subject).slice(0, 160),
    summary: String(payload.summary || "AI spatial-grounding draft").slice(0, 1000),
    parts,
    warnings: [...new Set(warnings.map((warning) => String(warning).slice(0, 500)))],
  };
}
