import type { AnnotatedPart } from "@/lib/contracts";

export interface CalloutPosition {
  id: string;
  side: "left" | "right";
  labelX: number;
  labelY: number;
  elbowX: number;
}

function distribute(
  parts: AnnotatedPart[],
  side: "left" | "right",
): CalloutPosition[] {
  const sorted = [...parts].sort((a, b) => a.anchor.y - b.anchor.y);
  const top = 0.1;
  const bottom = 0.9;
  return sorted.map((part, index) => {
    const evenlySpaced = top + ((index + 1) / (sorted.length + 1)) * (bottom - top);
    const blendedY = Math.min(
      bottom,
      Math.max(top, evenlySpaced * 0.7 + part.anchor.y * 0.3),
    );
    return {
      id: part.id,
      side,
      labelX: side === "left" ? 0.165 : 0.835,
      labelY: blendedY,
      elbowX: side === "left" ? 0.245 : 0.755,
    };
  });
}

export function layoutCallouts(parts: AnnotatedPart[]): CalloutPosition[] {
  const visible = parts.filter((part) => part.visible);
  const left: AnnotatedPart[] = [];
  const right: AnnotatedPart[] = [];

  for (const part of visible) {
    (part.anchor.x < 0.5 ? left : right).push(part);
  }

  return [...distribute(left, "left"), ...distribute(right, "right")];
}
