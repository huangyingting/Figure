import { describe, expect, it } from "vitest";

import { DiagramPlanSchema, PlanDiagramRequestSchema } from "@/lib/contracts";

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
    ).toEqual({ subject: "Inside a turbine" });
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
