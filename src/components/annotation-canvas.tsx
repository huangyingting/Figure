"use client";

import Image from "next/image";
import { useMemo, useState, type PointerEvent } from "react";

import { layoutCallouts } from "@/lib/callout-layout";
import type { AnnotatedPart, DiagramImage, Point } from "@/lib/contracts";
import { useI18n } from "@/components/i18n-provider";

interface AnnotationCanvasProps {
  image: DiagramImage;
  parts: AnnotatedPart[];
  selectedId: string | null;
  showAnnotations?: boolean;
  /** When false, markers are selectable but anchors cannot be dragged. */
  editable?: boolean;
  onSelect: (id: string) => void;
  onAnchorChange?: (id: string, point: Point) => void;
}

function shortLabel(value: string): string {
  return value.length > 16 ? `${value.slice(0, 15)}…` : value;
}

export function AnnotationCanvas({
  image,
  parts,
  selectedId,
  showAnnotations = true,
  editable = true,
  onSelect,
  onAnchorChange,
}: AnnotationCanvasProps) {
  const { t } = useI18n();
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
    if (!editable || !draggingId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    onAnchorChange?.(draggingId, { x, y });
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
      className="relative w-full overflow-hidden border border-[#cdc5ae] rounded-[5px] bg-[#ece6d5] shadow-[inset_0_0_0_6px_rgb(255_255_255_/_34%)] isolate"
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
    >
      <Image
        className="w-full h-full block object-contain select-none"
        src={image.src}
        alt={t("Generated diagram with a separate editable annotation layer")}
        width={image.width}
        height={image.height}
        unoptimized
        priority
      />
      {showAnnotations && <svg
        className={`absolute inset-0 w-full h-full overflow-visible [touch-action:none]${draggingId ? " cursor-grabbing" : ""}`}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label={editable ? t("Editable component locations, bounding boxes, and callout lines") : t("Component locations and callout lines")}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDraggingId(null)}
        onPointerCancel={() => setDraggingId(null)}
      >
        {selected?.visible && (
          <rect
            className="fill-[rgb(28_107_82_/_7%)] stroke-pine [stroke-width:2] [stroke-dasharray:8_6] [vector-effect:non-scaling-stroke] pointer-events-none"
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
              ? Math.max(pillWidth + 10, rawLabelX)
              : Math.min(viewWidth - pillWidth - 10, rawLabelX);
            const labelY = callout.labelY * viewHeight;
            const routeX = labelX + (anchorX - labelX) * 0.35;
            const pillX = callout.side === "left" ? labelX - pillWidth : labelX;

            return (
              <g
                key={part.id}
                className="group cursor-pointer outline-none [--marker:var(--color-pine)]"
                data-selected={selectedPart}
                role="button"
                tabIndex={0}
                aria-label={`${t("Select component")} ${part.name}`}
                onClick={() => onSelect(part.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(part.id);
                  }
                }}
              >
                <polyline
                  className="fill-none stroke-[var(--marker)] [stroke-width:1.5] [stroke-linecap:round] [stroke-linejoin:round] [vector-effect:non-scaling-stroke] pointer-events-none group-focus:[stroke-width:2.5] group-data-[selected=true]:[stroke-width:2.5]"
                  points={`${anchorX},${anchorY} ${routeX},${anchorY} ${routeX},${labelY} ${labelX},${labelY}`}
                />
                <rect
                  className="fill-[rgb(255_255_255_/_90%)] stroke-[rgb(35_33_27_/_15%)] [stroke-width:1] [vector-effect:non-scaling-stroke] max-[580px]:hidden group-focus:stroke-[var(--marker)] group-focus:[stroke-width:2] group-data-[selected=true]:stroke-[var(--marker)] group-data-[selected=true]:[stroke-width:2]"
                  x={pillX}
                  y={labelY - 18}
                  width={pillWidth}
                  height="36"
                  rx="18"
                />
                <text
                  className="fill-ink font-sans text-[14px] font-bold pointer-events-none max-[580px]:hidden"
                  x={callout.side === "left" ? labelX - 16 : labelX + 16}
                  y={labelY + 5}
                  textAnchor={callout.side === "left" ? "end" : "start"}
                >
                  {shortLabel(part.name)}
                </text>
                {editable && (
                  <circle
                    className="fill-transparent cursor-grab active:cursor-grabbing"
                    cx={anchorX}
                    cy={anchorY}
                    r="28"
                    onPointerDown={(event) => startDragging(event, part.id)}
                  />
                )}
                <circle
                  className="fill-[var(--marker)] stroke-white [stroke-width:1.5] [vector-effect:non-scaling-stroke]"
                  cx={anchorX}
                  cy={anchorY}
                  r={selectedPart ? 13 : 11}
                  pointerEvents="none"
                />
                <text
                  className="fill-white font-display text-micro font-bold"
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
      {showAnnotations && editable && <div className="absolute left-3 bottom-3 inline-flex items-center gap-[7px] px-[9px] py-1.5 border border-[rgb(255_255_255_/_55%)] rounded-[4px] text-[#454138] bg-[rgb(255_255_255_/_82%)] [backdrop-filter:blur(8px)] text-micro font-bold pointer-events-none max-[580px]:hidden" aria-hidden="true">
        <span className="text-pine font-display text-[13px]">↔</span>
        {t("Drag a marker to refine its anchor")}
      </div>}
    </div>
  );
}
