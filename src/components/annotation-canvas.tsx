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
      className="relative w-full overflow-hidden border border-[#c9ccc8] rounded-[5px] bg-[#e7ebe8] shadow-[inset_0_0_0_6px_rgb(255_255_255_/_34%)] isolate"
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
    >
      <Image
        className="w-full h-full block object-contain select-none"
        src={image.src}
        alt="Generated diagram with a separate editable annotation layer"
        width={image.width}
        height={image.height}
        unoptimized
        priority
      />
      {showAnnotations && <svg
        className={`absolute inset-0 w-full h-full overflow-visible [touch-action:none]${draggingId ? " cursor-grabbing" : ""}`}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label="Editable component locations, bounding boxes, and callout lines"
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDraggingId(null)}
        onPointerCancel={() => setDraggingId(null)}
      >
        {selected?.visible && (
          <rect
            className="fill-[rgb(101_87_232_/_7%)] stroke-violet [stroke-width:2] [stroke-dasharray:8_6] [vector-effect:non-scaling-stroke] pointer-events-none"
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
                className="group cursor-pointer outline-none [--marker:var(--color-violet)] data-[tone=uncertain]:[--marker:var(--color-amber)] data-[tone=approved]:[--marker:var(--color-green)]"
                data-tone={markerTone(part)}
                data-selected={selectedPart}
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
                  className="fill-none stroke-[rgb(255_255_255_/_86%)] [stroke-width:5] opacity-[0.92] [vector-effect:non-scaling-stroke] pointer-events-none"
                  points={`${anchorX},${anchorY} ${elbowX},${labelY} ${labelX},${labelY}`}
                />
                <polyline
                  className="fill-none stroke-[var(--marker)] [stroke-width:1.5] opacity-[0.92] [vector-effect:non-scaling-stroke] pointer-events-none group-focus:[stroke-width:2.5] group-focus:opacity-100 group-data-[selected=true]:[stroke-width:2.5] group-data-[selected=true]:opacity-100"
                  points={`${anchorX},${anchorY} ${elbowX},${labelY} ${labelX},${labelY}`}
                />
                <rect
                  className="fill-[rgb(255_255_255_/_90%)] stroke-[rgb(23_24_29_/_15%)] [stroke-width:1] [vector-effect:non-scaling-stroke] max-[580px]:hidden group-focus:stroke-[var(--marker)] group-focus:[stroke-width:2] group-data-[selected=true]:stroke-[var(--marker)] group-data-[selected=true]:[stroke-width:2]"
                  x={pillX}
                  y={labelY - 18}
                  width={pillWidth}
                  height="36"
                  rx="18"
                />
                <text
                  className="fill-ink font-sans text-[14px] font-bold pointer-events-none max-[580px]:hidden"
                  x={callout.side === "left" ? labelX - 29 : labelX + 29}
                  y={labelY + 5}
                  textAnchor={callout.side === "left" ? "end" : "start"}
                >
                  {shortLabel(part.name)}
                </text>
                <circle
                  className="fill-[var(--marker)] stroke-white [stroke-width:3] [vector-effect:non-scaling-stroke]"
                  cx={labelX}
                  cy={labelY}
                  r="12"
                />
                <circle
                  className="fill-[rgb(255_255_255_/_42%)] stroke-white [stroke-width:2] [vector-effect:non-scaling-stroke] [transition:r_150ms_ease] pointer-events-none"
                  cx={anchorX}
                  cy={anchorY}
                  r={selectedPart ? 19 : 16}
                />
                <circle
                  className="fill-transparent cursor-grab active:cursor-grabbing"
                  cx={anchorX}
                  cy={anchorY}
                  r="28"
                  onPointerDown={(event) => startDragging(event, part.id)}
                />
                <circle
                  className="fill-[var(--marker)] stroke-white [stroke-width:1.5] [vector-effect:non-scaling-stroke]"
                  cx={anchorX}
                  cy={anchorY}
                  r={selectedPart ? 13 : 11}
                  pointerEvents="none"
                />
                <text
                  className="fill-white font-display text-[11px] font-bold"
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
      {showAnnotations && <div className="absolute left-3 bottom-3 inline-flex items-center gap-[7px] px-[9px] py-1.5 border border-[rgb(255_255_255_/_55%)] rounded-[4px] text-[#343841] bg-[rgb(255_255_255_/_82%)] [backdrop-filter:blur(8px)] text-micro font-bold pointer-events-none max-[580px]:hidden" aria-hidden="true">
        <span className="text-violet font-display text-[13px]">↔</span>
        Drag a marker to refine its anchor
      </div>}
    </div>
  );
}
