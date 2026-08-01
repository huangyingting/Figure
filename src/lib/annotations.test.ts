import { describe, expect, it } from "vitest";

import { normalizeVisionPayload, parseStoredAnnotation } from "@/lib/annotations";
import type {
  GenerateDiagramRequest,
  VisionModelPayload,
} from "@/lib/contracts";

const request: GenerateDiagramRequest = {
  subject: "测试剖视图",
  diagramType: "cutaway",
  audience: "学生",
  imageModel: "gpt-image-2",
  parts: [
    { id: "case", name: "外壳", description: "包围内部结构" },
    { id: "rotor", name: "转子", description: "旋转部件" },
  ],
};

describe("normalizeVisionPayload", () => {
  it("clamps coordinates, preserves requested copy, and ignores extras", () => {
    const payload: VisionModelPayload = {
      title: "定位",
      summary: "结果",
      warnings: [],
      parts: [
        {
          id: "case",
          name: "模型改写的名称",
          description: "模型改写的说明",
          visible: true,
          anchor: { x: 1.4, y: -0.2 },
          box: { x: 0.8, y: 0.9, width: 0.5, height: 0.4 },
          confidence: 1.5,
          evidence: "边界清楚",
        },
        {
          id: "extra",
          name: "多余",
          description: "多余",
          visible: true,
          anchor: { x: 0.2, y: 0.2 },
          box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
          confidence: 0.9,
          evidence: "不应保留",
        },
      ],
    };

    const normalized = normalizeVisionPayload(payload, request);
    expect(normalized.parts).toHaveLength(2);
    expect(normalized.parts[0]).toMatchObject({
      id: "case",
      name: "外壳",
      description: "包围内部结构",
      anchor: { x: 1, y: 0 },
      confidence: 1,
    });
    expect(normalized.parts[0].box).toMatchObject({ x: 0.8, y: 0.9 });
    expect(normalized.parts[0].box.width).toBeCloseTo(0.2);
    expect(normalized.parts[0].box.height).toBeCloseTo(0.1);
    expect(normalized.parts[1]).toMatchObject({
      id: "rotor",
      visible: false,
      confidence: 0,
      reviewStatus: "ai-draft",
    });
    expect(normalized.warnings).toContain("Component not located: 转子 (rotor)");
    expect(normalized.warnings.at(-1)).toContain("unrequested component");
  });

  it("zeros geometry when the model says a part is not visible", () => {
    const missing: VisionModelPayload = {
      title: "定位",
      summary: "结果",
      warnings: ["存在遮挡"],
      parts: request.parts.map((part) => ({
        ...part,
        visible: false,
        anchor: { x: 0.9, y: 0.8 },
        box: { x: 0.2, y: 0.2, width: 0.4, height: 0.4 },
        confidence: 0.8,
        evidence: "无法区分",
      })),
    };
    const normalized = normalizeVisionPayload(missing, request);
    expect(normalized.parts[0].anchor).toEqual({ x: 0.5, y: 0.5 });
    expect(normalized.parts[0].box).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(normalized.parts[0].confidence).toBe(0);
  });
});

describe("parseStoredAnnotation", () => {
  it("returns a safe fallback for malformed JSON", () => {
    const result = parseStoredAnnotation("{not json");
    expect(result.parts).toEqual([]);
    expect(result.warnings[0]).toContain("malformed");
  });

  it("returns a safe fallback when parts are missing", () => {
    const result = parseStoredAnnotation(JSON.stringify({ title: "T", summary: "S" }));
    expect(result.parts).toEqual([]);
  });

  it("passes through a well-formed annotation", () => {
    const annotation = { title: "Pump", summary: "S", parts: [{ id: "case" }], warnings: [] };
    const result = parseStoredAnnotation(JSON.stringify(annotation));
    expect(result.title).toBe("Pump");
    expect(result.parts).toHaveLength(1);
  });

  it("normalizes malformed parts into a safe, renderable shape", () => {
    const annotation = {
      title: "Pump",
      summary: "S",
      parts: [
        { id: "case" },
        { id: "rotor", visible: true, anchor: { x: 5, y: -2 }, confidence: 9 },
        "not-an-object",
        null,
      ],
      warnings: ["keep", 42],
    };
    const result = parseStoredAnnotation(JSON.stringify(annotation));
    expect(result.parts).toHaveLength(4);
    for (const part of result.parts) {
      expect(typeof part.anchor.x).toBe("number");
      expect(part.anchor.x).toBeGreaterThanOrEqual(0);
      expect(part.anchor.x).toBeLessThanOrEqual(1);
      expect(part.box).toMatchObject({ x: 0, y: 0, width: 0, height: 0 });
      expect(part.reviewStatus).toBe("ai-draft");
    }
    expect(result.parts[1].anchor).toEqual({ x: 1, y: 0 });
    expect(result.parts[1].confidence).toBe(1);
    expect(result.parts[2].id).toBe("part-3");
    expect(result.warnings).toEqual(["keep"]);
  });
});
