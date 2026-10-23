import { describe, expect, it } from "vitest";

import { AnnotationUpdateSchema, DiagramPlanSchema, GenerateDiagramRequestSchema, PlanDiagramRequestSchema } from "@/lib/contracts";

const parts = ["case", "rotor", "shaft", "seal"].map((id) => ({
  id,
  name: id,
  description: `Visible ${id} component`,
}));

describe("diagram planning contracts", () => {
  it("accepts a topic as the only planning input", () => {
    expect(
      PlanDiagramRequestSchema.parse({
        subject: "Inside a turbine",
      }),
    ).toEqual({ subject: "Inside a turbine", locale: "en", visualStyle: "isometric" });
  });

  it("accepts Simplified Chinese as a first-class generation locale", () => {
    expect(PlanDiagramRequestSchema.parse({ subject: "离心泵内部结构", locale: "zh-CN" }))
      .toEqual({ subject: "离心泵内部结构", locale: "zh-CN", visualStyle: "isometric" });
    expect(() => PlanDiagramRequestSchema.parse({ subject: "Pump", locale: "zh-TW" }))
      .toThrow();
  });

  it("defaults to isometric rendering independently of diagram type and validates alternatives", () => {
    const input = { subject: "A turbine", locale: "en", diagramType: "cutaway", audience: "learners", imageModel: "gpt-image-2", parts };
    expect(GenerateDiagramRequestSchema.parse(input).visualStyle).toBe("isometric");
    for (const visualStyle of ["isometric", "realistic", "blueprint"]) {
      expect(GenerateDiagramRequestSchema.parse({ ...input, visualStyle }).visualStyle).toBe(visualStyle);
      expect(PlanDiagramRequestSchema.parse({ subject: input.subject, visualStyle }).visualStyle).toBe(visualStyle);
    }
    expect(GenerateDiagramRequestSchema.safeParse({ ...input, visualStyle: "unknown" }).success).toBe(false);
    expect(GenerateDiagramRequestSchema.safeParse({ ...input, diagramType: "isometric" }).success).toBe(false);
  });

  it("requires a useful component inventory and rejects duplicate IDs", () => {
    expect(
      DiagramPlanSchema.parse({
        title: "Turbine anatomy",
        diagramType: "cutaway",
        audience: "Curious adult learners",
        visualDirection: "A clear cutaway view",
        parts,
      }).parts,
    ).toHaveLength(4);

    expect(() =>
      DiagramPlanSchema.parse({
        title: "Turbine anatomy",
        diagramType: "cutaway",
        audience: "Curious adult learners",
        visualDirection: "A clear cutaway view",
        parts: [...parts.slice(0, 3), { ...parts[0] }],
      }),
    ).toThrow("Duplicate component ID");
  });
});

describe("AnnotationUpdateSchema", () => {
  const validPart = {
    id: "case",
    index: 0,
    name: "Casing",
    description: "Encloses the impeller.",
    visible: true,
    anchor: { x: 0.3, y: 0.4 },
    box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    confidence: 0.9,
    evidence: "Visible boundary.",
    reviewStatus: "human-edited" as const,
  };

  it("accepts a well-formed edited annotation", () => {
    const parsed = AnnotationUpdateSchema.parse({
      title: "Pump anatomy",
      summary: "An edited draft.",
      parts: [validPart],
      warnings: [],
    });
    expect(parsed.parts[0].reviewStatus).toBe("human-edited");
  });

  it("rejects out-of-range coordinates and unknown review status", () => {
    expect(() =>
      AnnotationUpdateSchema.parse({
        title: "Pump anatomy",
        summary: "An edited draft.",
        parts: [{ ...validPart, anchor: { x: 1.4, y: 0.4 } }],
        warnings: [],
      }),
    ).toThrow();
    expect(() =>
      AnnotationUpdateSchema.parse({
        title: "Pump anatomy",
        summary: "An edited draft.",
        parts: [{ ...validPart, reviewStatus: "made-up" }],
        warnings: [],
      }),
    ).toThrow();
  });

  it("rejects ambiguous component IDs, duplicate indexes and overflowing boxes", () => {
    const annotation = { title: "Pump", summary: "Draft", parts: [validPart], warnings: [] };
    expect(AnnotationUpdateSchema.safeParse({
      ...annotation,
      parts: [validPart, { ...validPart, id: "CASE", index: 1 }],
    }).success).toBe(false);
    expect(AnnotationUpdateSchema.safeParse({
      ...annotation,
      parts: [validPart, { ...validPart, id: "shaft" }],
    }).success).toBe(false);
    expect(AnnotationUpdateSchema.safeParse({
      ...annotation,
      parts: [{ ...validPart, id: "bad id" }],
    }).success).toBe(false);
    expect(AnnotationUpdateSchema.safeParse({
      ...annotation,
      parts: [{ ...validPart, box: { x: 0.9, y: 0.1, width: 0.2, height: 0.2 } }],
    }).success).toBe(false);
  });
});
