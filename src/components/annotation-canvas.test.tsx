import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnnotationCanvas } from "@/components/annotation-canvas";
import type { AnnotatedPart } from "@/lib/contracts";

function part(
  id: string,
  index: number,
  name: string,
  x: number,
  y: number,
): AnnotatedPart {
  return {
    id,
    index,
    name,
    description: name,
    visible: true,
    anchor: { x, y },
    box: { x, y, width: 0.1, height: 0.1 },
    confidence: 0.9,
    evidence: "visible",
    reviewStatus: "ai-draft",
  };
}

function numericAttribute(tag: string, name: string): number {
  const match = new RegExp(`${name}="([^"]+)"`).exec(tag);
  if (!match) throw new Error(`Missing ${name} in ${tag}`);
  return Number(match[1]);
}

function calloutGroups(markup: string): string[] {
  return [...markup.matchAll(/<g[^>]+aria-label="Select component [^"]+"[^>]*>([\s\S]*?)<\/g>/g)]
    .map((match) => match[1]);
}

const parts = [
  part("inlet", 0, "Inlet", 0.171, 0.585),
  part("bearing", 1, "Bearing", 0.772, 0.397),
];

function renderCallouts(): string[] {
  const markup = renderToStaticMarkup(
    <AnnotationCanvas
      image={{
        src: "/demo-pump.png",
        mimeType: "image/png",
        width: 1536,
        height: 1024,
        revisedPrompt: null,
      }}
      parts={parts}
      selectedId={null}
      editable={false}
      onSelect={() => undefined}
    />,
  );
  return calloutGroups(markup);
}

function geometry(group: string): {
  points: number[][];
  pillX: number;
  pillWidth: number;
} {
  const polyline = group.match(/<polyline[^>]+>/)?.[0];
  const label = group.match(/<rect[^>]+height="36"[^>]*>/)?.[0];
  if (!polyline || !label) throw new Error("Missing callout geometry");
  const pointsMatch = /points="([^"]+)"/.exec(polyline);
  if (!pointsMatch) throw new Error("Missing polyline points");
  return {
    points: pointsMatch[1]
      .split(" ")
      .map((point) => point.split(",").map(Number)),
    pillX: numericAttribute(label, "x"),
    pillWidth: numericAttribute(label, "width"),
  };
}

describe("AnnotationCanvas callout geometry", () => {
  it("connects every leader line directly to its label edge", () => {
    const groups = renderCallouts();
    expect(groups).toHaveLength(parts.length);
    for (const group of groups) {
      const { points, pillX, pillWidth } = geometry(group);
      const anchor = points[0];
      const lineEnd = points.at(-1);
      if (!lineEnd) throw new Error("Missing line endpoint");
      const pillEdge = lineEnd[0] < anchor[0] ? pillX + pillWidth : pillX;

      expect(lineEnd[0]).toBeCloseTo(pillEdge, 6);
    }
  });

  it("routes monotonically toward the label without folding back", () => {
    for (const group of renderCallouts()) {
      const { points } = geometry(group);
      const movingLeft = points.at(-1)![0] < points[0][0];
      for (let index = 1; index < points.length; index += 1) {
        if (movingLeft) {
          expect(points[index][0]).toBeLessThanOrEqual(points[index - 1][0]);
        } else {
          expect(points[index][0]).toBeGreaterThanOrEqual(points[index - 1][0]);
        }
      }
    }
  });
});
