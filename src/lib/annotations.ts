import type {
  AnnotatedPart,
  DiagramAnnotation,
  GenerateDiagramRequest,
  PartSpec,
  VisionModelPayload,
} from "@/lib/contracts";

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
    evidence: "视觉模型没有返回该部件，必须人工定位。",
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
      warnings.push(`未定位部件：${expected.name}（${expected.id}）`);
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
      evidence: String(candidate.evidence || "无视觉依据说明。").slice(0, 600),
      reviewStatus: "ai-draft" as const,
    };
  });

  const returnedIds = new Set(request.parts.map((part) => part.id.toLowerCase()));
  const unexpected = payload.parts.filter(
    (part) => !returnedIds.has(part.id.toLowerCase()),
  );
  if (unexpected.length > 0) {
    warnings.push(
      `视觉模型返回了 ${unexpected.length} 个未请求部件，已安全忽略。`,
    );
  }

  return {
    title: String(payload.title || request.subject).slice(0, 160),
    summary: String(payload.summary || "AI 视觉定位草稿").slice(0, 1000),
    parts,
    warnings: [...new Set(warnings.map((warning) => String(warning).slice(0, 500)))],
  };
}
