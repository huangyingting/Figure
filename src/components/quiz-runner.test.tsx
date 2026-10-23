import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { QuizRunner } from "@/components/quiz-runner";
import { demoResult } from "@/lib/demo-data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("QuizRunner", () => {
  it("does not offer indistinguishable answer labels as different answers", () => {
    const parts = demoResult.annotation.parts.slice(0, 4).map((part, index) => ({
      ...part,
      visible: true,
      name: index < 2 ? "Rotor" : "Bearing",
    }));
    const markup = renderToStaticMarkup(
      <QuizRunner figureId="duplicates" title="Pump" parts={parts} persist={false} />,
    );

    expect(markup.match(/aria-pressed="false"/g) ?? []).toHaveLength(2);
  });
  it("does not show quiz controls for a figure without visible components", () => {
    const markup = renderToStaticMarkup(
      <QuizRunner figureId="empty" title="Empty" parts={demoResult.annotation.parts.map((part) => ({ ...part, visible: false }))} />,
    );

    expect(markup).toContain("Not enough visible components");
    expect(markup).not.toContain("Next question");
    expect(markup).not.toContain("See results");
  });

  it("exposes answer selection and feedback to assistive technology", () => {
    const markup = renderToStaticMarkup(
      <QuizRunner figureId={demoResult.id} title="Pump" parts={demoResult.annotation.parts} persist={false} />,
    );

    expect(markup.match(/aria-pressed="false"/g) ?? []).toHaveLength(4);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });
});
