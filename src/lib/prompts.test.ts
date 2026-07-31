import { describe, expect, it } from "vitest";

import type { GenerateDiagramRequest } from "@/lib/contracts";
import { buildImagePrompt, buildVisionUserPrompt } from "@/lib/prompts";

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
    expect(prompt).toContain("generous neutral margin");
  });

  it("passes stable component IDs to spatial grounding", () => {
    const prompt = buildVisionUserPrompt(request);
    expect(prompt).toContain("[impeller]");
    expect(prompt).toContain("[shaft]");
  });
});
