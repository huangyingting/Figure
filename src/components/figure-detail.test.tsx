import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FigureDetail } from "@/components/figure-detail";
import { demoResult } from "@/lib/demo-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("FigureDetail annotations", () => {
  it("renders a callout label and leader line for every visible part", () => {
    const markup = renderToStaticMarkup(
      <FigureDetail
        result={demoResult}
        owner={false}
        isPublic
        collections={[]}
        favorited={false}
        signedIn={false}
      />,
    );
    const visibleParts = demoResult.annotation.parts.filter((part) => part.visible);

    expect(markup.match(/<polyline/g) ?? []).toHaveLength(visibleParts.length);
    expect(markup.match(/aria-label="Select component /g) ?? []).toHaveLength(visibleParts.length);
  });
});