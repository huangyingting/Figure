"use client";

import Image from "next/image";
import { useMemo, useState, type PointerEvent } from "react";

import { layoutCallouts } from "@/lib/callout-layout";
import type { AnnotatedPart, DiagramImage, Point } from "@/lib/contracts";

interface AnnotationCanvasProps {
  image: DiagramImage;
  parts: AnnotatedPart[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAnchorChange: (id: string, point: Point) => void;
}

function shortLabel(value: string): string {
  return value.length > 10 ? `${value.slice(0, 9)}…` : value;
}

function markerTone(part: AnnotatedPart): string {
  if (part.reviewStatus === "approved") return "approved";
  if (part.confidence < 0.65) return "uncertain";
  return "draft";
}

export function AnnotationCanvas({
  image,
  parts,
  selectedId,
  onSelect,
  onAnchorChange,
}: AnnotationCanvasProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const viewWidth = 1000;
  const viewHeight = (viewWidth * image.height) / image.width;
  const callouts = useMemo(() => layoutCallouts(parts), [parts]);
  const calloutById = useMemo(
    () => new Map(callouts.map((callout) => [callout.id, callout])),
    [callouts],
  );
  const selected = parts.find((part) => part.id === selectedId);

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!draggingId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    onAnchorChange(draggingId, { x, y });
  }

  function startDragging(
    event: PointerEvent<SVGCircleElement>,
    partId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(partId);
    onSelect(partId);
  }

  return (
    <div
      className="canvas-shell"
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
    >
      <Image
        className="diagram-image"
        src={image.src}
        alt="待标注的剖视图；文字说明位于独立标注层"
        width={image.width}
        height={image.height}
        unoptimized
        priority
      />
      <svg
        className={`annotation-overlay${draggingId ? " is-dragging" : ""}`}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label="可编辑的部件定位、边界框和引线标注层"
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDraggingId(null)}
        onPointerCancel={() => setDraggingId(null)}
      >
        {selected?.visible && (
          <rect
            className="selected-box"
            x={selected.box.x * viewWidth}
            y={selected.box.y * viewHeight}
            width={selected.box.width * viewWidth}
            height={selected.box.height * viewHeight}
            rx="10"
          />
        )}

        {parts
          .filter((part) => part.visible)
          .map((part) => {
            const callout = calloutById.get(part.id);
            if (!callout) return null;
            const anchorX = part.anchor.x * viewWidth;
            const anchorY = part.anchor.y * viewHeight;
            const labelX = callout.labelX * viewWidth;
            const labelY = callout.labelY * viewHeight;
            const elbowX = callout.elbowX * viewWidth;
            const selectedPart = selectedId === part.id;
            const pillWidth = 130;
            const pillX = callout.side === "left" ? labelX - pillWidth - 18 : labelX + 18;

            return (
              <g
                key={part.id}
                className={`callout ${selectedPart ? "is-selected" : ""}`}
                data-tone={markerTone(part)}
                role="button"
                tabIndex={0}
                aria-label={`选择部件 ${part.name}`}
                onClick={() => onSelect(part.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(part.id);
                  }
                }}
              >
                <polyline
                  className="leader-line leader-halo"
                  points={`${anchorX},${anchorY} ${elbowX},${labelY} ${labelX},${labelY}`}
                />
                <polyline
                  className="leader-line"
                  points={`${anchorX},${anchorY} ${elbowX},${labelY} ${labelX},${labelY}`}
                />
                <rect
                  className="callout-pill"
                  x={pillX}
                  y={labelY - 18}
                  width={pillWidth}
                  height="36"
                  rx="18"
                />
                <text
                  className="callout-text"
                  x={callout.side === "left" ? labelX - 29 : labelX + 29}
                  y={labelY + 5}
                  textAnchor={callout.side === "left" ? "end" : "start"}
                >
                  {shortLabel(part.name)}
                </text>
                <circle
                  className="callout-node"
                  cx={labelX}
                  cy={labelY}
                  r="12"
                />
                <circle
                  className="anchor-ring"
                  cx={anchorX}
                  cy={anchorY}
                  r={selectedPart ? 19 : 16}
                />
                <circle
                  className="anchor-hit-area"
                  cx={anchorX}
                  cy={anchorY}
                  r="28"
                  onPointerDown={(event) => startDragging(event, part.id)}
                />
                <circle
                  className="anchor-core"
                  cx={anchorX}
                  cy={anchorY}
                  r={selectedPart ? 13 : 11}
                  pointerEvents="none"
                />
                <text
                  className="anchor-number"
                  x={anchorX}
                  y={anchorY + 4}
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {part.index + 1}
                </text>
              </g>
            );
          })}
      </svg>
      <div className="canvas-hint" aria-hidden="true">
        <span className="drag-symbol">↔</span>
        拖动编号校正锚点
      </div>
    </div>
  );
}
