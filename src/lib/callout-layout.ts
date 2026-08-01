import type { AnnotatedPart } from "@/lib/contracts";

export interface CalloutPosition {
  id: string;
  side: "left" | "right";
  labelX: number;
  labelY: number;
}

interface PositionBlock {
  start: number;
  end: number;
  sum: number;
  count: number;
}

function compactLabelPositions(parts: AnnotatedPart[]): number[] {
  if (!parts.length) return [];
  const top = 0.1;
  const bottom = 0.9;
  const minimumGap = parts.length === 1
    ? 0
    : Math.min(0.11, (bottom - top) / (parts.length - 1));
  const blocks: PositionBlock[] = [];

  // Isotonic regression on (anchorY - index * gap) finds the closest ordered
  // positions with a guaranteed gap, rather than stretching labels across the
  // entire column when their anchors are clustered together.
  for (const [index, part] of parts.entries()) {
    blocks.push({
      start: index,
      end: index,
      sum: part.anchor.y - index * minimumGap,
      count: 1,
    });
    while (blocks.length > 1) {
      const current = blocks[blocks.length - 1];
      const previous = blocks[blocks.length - 2];
      if (previous.sum / previous.count <= current.sum / current.count) break;
      blocks.splice(-2, 2, {
        start: previous.start,
        end: current.end,
        sum: previous.sum + current.sum,
        count: previous.count + current.count,
      });
    }
  }

  const basePositions = Array.from({ length: parts.length }, () => 0);
  const maximumBase = bottom - (parts.length - 1) * minimumGap;
  for (const block of blocks) {
    const fitted = Math.min(
      maximumBase,
      Math.max(top, block.sum / block.count),
    );
    for (let index = block.start; index <= block.end; index += 1) {
      basePositions[index] = fitted;
    }
  }

  return basePositions.map((position, index) =>
    position + index * minimumGap,
  );
}

function distribute(
  parts: AnnotatedPart[],
  side: "left" | "right",
): CalloutPosition[] {
  const sorted = [...parts].sort((a, b) => a.anchor.y - b.anchor.y);
  const labelPositions = compactLabelPositions(sorted);
  return sorted.map((part, index) => {
    return {
      id: part.id,
      side,
      labelX: side === "left" ? 0.165 : 0.835,
      labelY: labelPositions[index],
    };
  });
}

export function layoutCallouts(parts: AnnotatedPart[]): CalloutPosition[] {
  const visible = parts.filter((part) => part.visible);
  // Balance the two columns: sort by horizontal anchor and split at the median
  // so left/right receive near-equal counts (the extra goes left on odd totals)
  // while the leftmost anchors still land on the left and the rightmost on the
  // right. This keeps callouts distributed across both sides instead of piling
  // up wherever the anchors happen to cluster.
  const byX = [...visible].sort((a, b) => a.anchor.x - b.anchor.x);
  const half = Math.ceil(byX.length / 2);
  const left = byX.slice(0, half);
  const right = byX.slice(half);

  return [...distribute(left, "left"), ...distribute(right, "right")];
}
