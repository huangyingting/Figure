"use client";

import Image from "next/image";
import { useMemo, useState, type PointerEvent } from "react";

import { layoutCallouts } from "@/lib/callout-layout";
import type { AnnotatedPart, DiagramImage, Point } from "@/lib/contracts";

interface AnnotationCanvasProps {
  image: DiagramImage;
  parts: AnnotatedPart[];
  selectedId: string | null;
  showAnnotations?: boolean;
  onSelect: (id: string) => void;
  onAnchorChange: (id: string, point: Point) => void;
}

function shortLabel(value: string): string {
  return value.length > 16 ? `${value.slice(0, 15)}…` : value;
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
  showAnnotations = true,
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
        alt="Generated diagram with a separate editable annotation layer"
        width={image.width}
        height={image.height}
        unoptimized
        priority
      />
      {showAnnotations && <svg
        className={`annotation-overlay${draggingId ? " is-dragging" : ""}`}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label="Editable component locations, bounding boxes, and callout lines"
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
            const selectedPart = selectedId === part.id;
            const pillWidth = Math.max(130, Math.min(180, part.name.length * 8 + 42));
            const rawLabelX = callout.labelX * viewWidth;
            const labelX = callout.side === "left"
              ? Math.max(pillWidth + 28, rawLabelX)
              : Math.min(viewWidth - pillWidth - 28, rawLabelX);
            const labelY = callout.labelY * viewHeight;
            const elbowX = callout.elbowX * viewWidth;
            const pillX = callout.side === "left" ? labelX - pillWidth - 18 : labelX + 18;

            return (
              <g
                key={part.id}
                className={`callout ${selectedPart ? "is-selected" : ""}`}
                data-tone={markerTone(part)}
                role="button"
                tabIndex={0}
                aria-label={`Select component ${part.name}`}
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
      </svg>}
      {showAnnotations && <div className="canvas-hint" aria-hidden="true">
        <span className="drag-symbol">↔</span>
        Drag a marker to refine its anchor
      </div>}
    </div>
  );
}
