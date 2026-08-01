import { describe, expect, it } from "vitest";

import type { GenerateDiagramRequest } from "@/lib/contracts";
import {
  buildImagePrompt,
  buildPlanSystemPrompt,
  buildPlanUserPrompt,
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
} from "@/lib/prompts";

const request: GenerateDiagramRequest = {
  subject: "离心泵",
  locale: "en",
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

  it("makes Simplified Chinese the output contract for planning and annotations", () => {
    const chineseRequest = { ...request, locale: "zh-CN" as const };
    const planningSystem = buildPlanSystemPrompt(chineseRequest.locale);
    const planningUser = buildPlanUserPrompt(chineseRequest);
    const visionSystem = buildVisionSystemPrompt(chineseRequest.locale);
    const visionUser = buildVisionUserPrompt(chineseRequest);

    expect(planningSystem).toContain("Simplified Chinese (zh-CN)");
    expect(planningSystem).toContain("component names, descriptions, summary, visual evidence, and warnings");
    expect(planningSystem).toContain("ASCII snake_case");
    expect(planningUser).toContain("简体中文组件清单");
    expect(visionSystem).toContain("Simplified Chinese (zh-CN)");
    expect(visionUser).toContain("标题、摘要、组件名称、说明、视觉证据和警告");
    expect(visionUser).toContain("组件 ID 必须保持原样");
  });

  it("passes the planned visual direction into image generation", () => {
    const prompt = buildImagePrompt({
      ...request,
      visualDirection: "Use a clean three-quarter cutaway with the rotor exposed.",
    });
    expect(prompt).toContain("Planned visual direction: Use a clean three-quarter cutaway");
  });
});
