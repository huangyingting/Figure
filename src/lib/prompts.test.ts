import { describe, expect, it } from "vitest";

import type { GenerateDiagramRequest } from "@/lib/contracts";
import {
  buildImagePrompt,
  buildPlanSystemPrompt,
  buildPlanUserPrompt,
  buildVisionUserPrompt,
} from "@/lib/prompts";

const request: GenerateDiagramRequest = {
  subject: "离心泵",
  diagramType: "cutaway",
  audience: "工程学生",
  imageModel: "gpt-image-2",
  parts: [
    { id: "impeller", name: "叶轮", description: "传递机械能" },
    { id: "shaft", name: "主轴", description: "传递扭矩" },
  ],
};

describe("diagram prompts", () => {
  it("keeps labels out of the generated pixels", () => {
    const prompt = buildImagePrompt(request);
    expect(prompt).toContain("Do not draw any words, letters, numbers");
    expect(prompt).toContain("[impeller]");
    expect(prompt).toContain("converted to a transparent alpha channel");
    expect(prompt).toContain("generous transparent margin");
  });

  it("passes stable component IDs to spatial grounding", () => {
    const prompt = buildVisionUserPrompt(request);
    expect(prompt).toContain("[impeller]");
    expect(prompt).toContain("[shaft]");
  });

  it("plans a concise English component inventory before rendering", () => {
    const system = buildPlanSystemPrompt();
    const user = buildPlanUserPrompt(request);
    expect(system).toContain("Choose 4 to 9 components");
    expect(system).toContain("short English component names");
    expect(user).toContain("Topic: 离心泵");
    expect(user).toContain("Infer and return the best diagramType and audience");
    expect(user).not.toContain("Diagram format:");
  });

  it("passes the planned visual direction into image generation", () => {
    const prompt = buildImagePrompt({
      ...request,
      visualDirection: "Use a clean three-quarter cutaway with the rotor exposed.",
    });
    expect(prompt).toContain("Planned visual direction: Use a clean three-quarter cutaway");
  });
});
