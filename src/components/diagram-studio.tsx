"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

import { AnnotationCanvas } from "@/components/annotation-canvas";
import { AppHeader, type HeaderUser } from "@/components/app-header";
import { CustomSelect } from "@/components/custom-select";
import type {
  AnnotatedPart,
  AzureStatus,
  DiagramPlan,
  DiagramResult,
  ImageModel,
  Point,
} from "@/lib/contracts";
import { demoResult } from "@/lib/demo-data";

type GenerationStage = "idle" | "planning" | "rendering" | "complete" | "error";

const promptIdeas = [
  "Anatomy of a volcano",
  "Inside a mechanical watch",
  "How a wind turbine works",
];

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function coordinate(value: number): string {
  return value.toFixed(3);
}

function sourceLabel(result: DiagramResult): string {
  return result.provenance.source === "offline-demo" ? "Curated sample" : "Azure generated";
}

function reviewLabel(part: AnnotatedPart): string {
  if (part.reviewStatus === "approved") return "Reviewed";
  if (part.reviewStatus === "human-edited") return "Edited";
  return "AI draft";
}

function pipelineState(
  item: "plan" | "render" | "annotate",
  stage: GenerationStage,
): "waiting" | "active" | "complete" {
  if (stage === "complete") return "complete";
  if (item === "plan") {
    if (stage === "planning") return "active";
    if (stage === "rendering") return "complete";
  }
  if (item === "render" && stage === "rendering") return "active";
  return "waiting";
}

interface ApiErrorPayload {
  error?: string;
  requestId?: string;
}

async function readApiError(response: Response, fallback: string): Promise<Error> {
  let payload: ApiErrorPayload = {};
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    // Keep the user-facing fallback when a proxy returns a non-JSON error page.
  }
  const request = payload.requestId ? ` · Request ${payload.requestId}` : "";
  return new Error(`${payload.error || fallback}${request}`);
}

export function DiagramStudio({ headerUser }: { headerUser: HeaderUser | null }) {
  const { data: session, update: updateSession } = useSession();
  const [result, setResult] = useState<DiagramResult>(demoResult);
  const [subject, setSubject] = useState("Inside a centrifugal pump");
  const [imageModel, setImageModel] = useState<ImageModel>("gpt-image-2");
  const [selectedId, setSelectedId] = useState<string | null>("impeller");
  const [status, setStatus] = useState<AzureStatus | null>(null);
  const [stage, setStage] = useState<GenerationStage>("idle");
  const [plan, setPlan] = useState<DiagramPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const canvasPanelRef = useRef<HTMLElement>(null);
  const [canvasPanelHeight, setCanvasPanelHeight] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Status unavailable");
        return (await response.json()) as AzureStatus;
      })
      .then((data) => {
        if (!active) return;
        setStatus(data);
        if (!data.imageModels["gpt-image-2"] && data.imageModels["mai-image-2.5"]) {
          setImageModel("mai-image-2.5");
        }
      })
      .catch(() => {
        if (active) setStatus(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const canvasPanel = canvasPanelRef.current;
    if (!canvasPanel || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      setCanvasPanelHeight(Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height));
    });
    observer.observe(canvasPanel);
    return () => observer.disconnect();
  }, []);

  const isGenerating = stage === "planning" || stage === "rendering";
  const selectedModelReady = status?.imageModels[imageModel] ?? false;
  const canGenerate = Boolean(session?.user?.id && status?.visionConfigured && selectedModelReady);
  // Seed the header from the server prop for a flicker-free first paint, then let the
  // live session take over so credit changes after a generation are reflected.
  const activeHeaderUser: HeaderUser | null = session?.user
    ? { name: session.user.name, email: session.user.email, credits: session.user.credits }
    : headerUser;
  const approvedCount = result.annotation.parts.filter(
    (part) => part.reviewStatus === "approved",
  ).length;
  const reviewProgress = result.annotation.parts.length
    ? approvedCount / result.annotation.parts.length
    : 0;
  const averageConfidence = result.annotation.parts.length
    ? result.annotation.parts.reduce((total, part) => total + part.confidence, 0) /
      result.annotation.parts.length
    : 0;

  function updatePart(partId: string, update: (part: AnnotatedPart) => AnnotatedPart) {
    setResult((current) => ({
      ...current,
      annotation: {
        ...current.annotation,
        parts: current.annotation.parts.map((part) =>
          part.id === partId ? update(part) : part,
        ),
      },
    }));
  }

  function moveAnchor(partId: string, point: Point) {
    updatePart(partId, (part) => ({
      ...part,
      anchor: point,
      reviewStatus: "human-edited",
    }));
  }

  async function generate() {
    const cleanSubject = subject.trim();
    if (cleanSubject.length < 2) {
      setError("Enter a topic with at least two characters.");
      return;
    }

    setError(null);
    setNotice(null);
    setPlan(null);
    setStage("planning");

    const planBrief = { subject: cleanSubject };
    try {
      const planResponse = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planBrief),
      });
      if (!planResponse.ok) {
        throw await readApiError(planResponse, "Component planning failed.");
      }
      const nextPlan = (await planResponse.json()) as DiagramPlan;
      setPlan(nextPlan);
      setStage("rendering");

      const generationBrief = {
        subject: cleanSubject,
        diagramType: nextPlan.diagramType,
        audience: nextPlan.audience,
        imageModel,
      };

      const generationResponse = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...generationBrief,
          visualDirection: nextPlan.visualDirection,
          parts: nextPlan.parts,
        }),
      });
      if (!generationResponse.ok) {
        throw await readApiError(generationResponse, "Visual generation failed.");
      }
      const payload = (await generationResponse.json()) as DiagramResult;
      setResult(payload);
      setSelectedId(payload.annotation.parts.find((part) => part.visible)?.id ?? null);
      setShowAnnotations(true);
      setStage("complete");
      await updateSession();
      setNotice("Your annotated figure is ready");
      window.setTimeout(() => {
        document.getElementById("figure-workspace")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (generationError) {
      setStage("error");
      setError(
        generationError instanceof Error
          ? generationError.message
          : "An unexpected error interrupted the pipeline.",
      );
    }
  }

  function restoreDemo() {
    setResult(demoResult);
    setPlan(null);
    setSelectedId("impeller");
    setError(null);
    setStage("idle");
    setShowAnnotations(true);
    setNotice("Sample figure restored");
  }

  function downloadImage() {
    const extension = result.image.mimeType.includes("svg")
      ? "svg"
      : result.image.mimeType.includes("jpeg")
        ? "jpg"
        : result.image.mimeType.includes("webp")
          ? "webp"
          : "png";
    const link = document.createElement("a");
    link.href = result.image.src;
    link.download = `${result.id}.${extension}`;
    link.click();
    setNotice("Figure image downloaded");
  }

  function exportAnnotations() {
    const exported = {
      schemaVersion: "1.0",
      diagramId: result.id,
      image: {
        width: result.image.width,
        height: result.image.height,
        mimeType: result.image.mimeType,
        source: result.provenance.source,
      },
      annotation: result.annotation,
      provenance: result.provenance,
    };
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.id}-annotations.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Annotation JSON downloaded");
  }

  async function copyAnnotations() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.annotation, null, 2));
      setNotice("Annotation JSON copied");
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  async function saveEdits() {
    if (saving || result.provenance.source === "offline-demo") return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/figures/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotation: result.annotation }),
      });
      if (!response.ok) throw await readApiError(response, "Could not save your edits.");
      setNotice("Annotation edits saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your edits.");
    } finally {
      setSaving(false);
    }
  }

  function renderPartEditor(part: AnnotatedPart) {
    const statusPill =
      part.reviewStatus === "human-edited"
        ? "bg-[#f9edcf] text-[#8e5f0e]"
        : part.reviewStatus === "approved"
          ? "bg-[#dff2ea] text-[#176d53]"
          : "bg-violet-pale text-violet-dark";
    return (
      <div
        className="border-t border-line px-3 pb-5 pt-[18px] [animation:accordion-open_180ms_ease-out_both] bg-[linear-gradient(180deg,#faf9ff,#fff)]"
        id={`part-editor-${part.id}`}
      >
        <div className="mb-4 flex items-start justify-between gap-[10px]">
          <div>
            <p className="m-0 font-display text-micro font-bold uppercase tracking-[0.13em] text-violet-dark">
              COMPONENT {String(part.index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-[3px] mb-0 font-display text-[25px] font-[550] tracking-[-0.04em]">
              {part.name}
            </h3>
          </div>
          <span
            className={`whitespace-nowrap rounded-full px-[7px] py-1 text-micro font-bold ${statusPill}`}
          >
            {reviewLabel(part)}
          </span>
        </div>

        {!part.visible && (
          <div className="mb-[13px] rounded-[3px] border-l-[3px] border-coral bg-[#fff0eb] px-3 py-[10px] text-ui leading-[1.55] text-[#933c29]">
            This component could not be located reliably. Review it manually or regenerate.
          </div>
        )}

        <label className="mb-4 grid gap-[7px]">
          <span className="text-meta font-bold text-ink-2">Description</span>
          <textarea
            className="min-h-[78px] w-full resize-y rounded-[5px] border border-line bg-[#faf9f6] p-[10px] text-ui leading-[1.55] text-ink-2 outline-none focus:border-violet focus:shadow-[0_0_0_3px_rgb(101_87_232_/_8%)]"
            value={part.description}
            rows={3}
            onChange={(event) =>
              updatePart(part.id, (current) => ({
                ...current,
                description: event.target.value,
                reviewStatus: "human-edited",
              }))
            }
          />
        </label>

        <div className="mb-[17px] rounded-md bg-[#f5f4f0] p-3">
          <div className="flex justify-between gap-3 text-meta text-muted">
            <span>Visual confidence</span>
            <strong className="font-display text-meta font-bold text-violet-dark">{percent(part.confidence)}</strong>
          </div>
          <div className="my-2 h-1 overflow-hidden rounded-full bg-[#d9d8d3]">
            <i className="block h-full rounded-[inherit] bg-[linear-gradient(90deg,var(--color-amber),var(--color-violet))]" style={{ width: percent(part.confidence) }} />
          </div>
          <p className="m-0 text-meta leading-[1.58] text-muted">{part.evidence}</p>
        </div>

        <div className="mb-4 grid gap-[7px]">
          <span className="text-meta font-bold text-ink-2">Normalized anchor</span>
          <div className="grid grid-cols-2 gap-[7px]">
            <label className="grid min-w-0 grid-cols-[27px_1fr] items-center rounded-[5px] border border-line bg-[#f5f4f0] text-center font-display text-micro font-bold text-muted">
              X
              <input
                className="h-[38px] rounded-r-[5px] border-0 border-l border-line px-2 font-display text-meta text-ink-2 outline-none focus:border-violet focus:shadow-[0_0_0_3px_rgb(101_87_232_/_8%)]"
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={coordinate(part.anchor.x)}
                disabled={!part.visible}
                onChange={(event) =>
                  moveAnchor(part.id, {
                    x: Math.min(1, Math.max(0, Number(event.target.value))),
                    y: part.anchor.y,
                  })
                }
              />
            </label>
            <label className="grid min-w-0 grid-cols-[27px_1fr] items-center rounded-[5px] border border-line bg-[#f5f4f0] text-center font-display text-micro font-bold text-muted">
              Y
              <input
                className="h-[38px] rounded-r-[5px] border-0 border-l border-line px-2 font-display text-meta text-ink-2 outline-none focus:border-violet focus:shadow-[0_0_0_3px_rgb(101_87_232_/_8%)]"
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={coordinate(part.anchor.y)}
                disabled={!part.visible}
                onChange={(event) =>
                  moveAnchor(part.id, {
                    x: part.anchor.x,
                    y: Math.min(1, Math.max(0, Number(event.target.value))),
                  })
                }
              />
            </label>
          </div>
        </div>

        <button
          type="button"
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md border border-ink bg-ink text-ui font-bold text-white hover:border-violet hover:bg-violet disabled:cursor-default disabled:border-line disabled:bg-[#eeede9] disabled:text-[#929298] [&:disabled_span]:bg-green [&:disabled_span]:text-white"
          disabled={!part.visible || part.reviewStatus === "approved"}
          onClick={() =>
            updatePart(part.id, (current) => ({ ...current, reviewStatus: "approved" }))
          }
        >
          <span className="grid h-[17px] w-[17px] place-items-center rounded-full bg-acid text-[10px] text-ink" aria-hidden="true">✓</span>
          {part.reviewStatus === "approved" ? "Component reviewed" : "Approve annotation"}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <AppHeader
        user={activeHeaderUser}
        extra={
          status === null || canGenerate ? (
            <div
              className="inline-flex min-h-[34px] items-center gap-2 rounded-full border border-line bg-white/65 px-3 py-[6px] text-meta font-bold text-muted"
              data-ready={canGenerate}
            >
              <span
                className={`h-[7px] w-[7px] rounded-full ${
                  canGenerate
                    ? "bg-green shadow-[0_0_0_4px_rgb(44_154_115_/_13%)]"
                    : "bg-amber shadow-[0_0_0_4px_rgb(235_168_57_/_13%)]"
                }`}
              />
              {status === null ? "Checking Azure" : "Pipeline ready"}
            </div>
          ) : null
        }
      />

      <main>
        <section
          className="relative mx-auto grid w-[min(1360px,calc(100%-64px))] grid-cols-1 items-center gap-11 py-[52px] lg:grid-cols-[minmax(410px,0.84fr)_minmax(560px,1.16fr)] lg:gap-x-[56px] lg:gap-y-11"
          id="top"
        >
          <div
            className="pointer-events-none absolute -z-[1] hidden h-[390px] w-[380px] rounded-[48%_52%_43%_57%] border border-[rgb(101_87_232_/_10%)] lg:block"
            style={{ inset: "18px 24px auto auto" }}
            aria-hidden="true"
          >
            <span className="absolute inset-[42px] rounded-full border border-dashed border-[rgb(101_87_232_/_12%)]" />
            <span className="absolute right-[85px] bottom-[90px] h-[170px] w-[170px] rounded-full bg-[rgb(217_255_112_/_13%)] blur-[2px]" />
            <i className="absolute z-[2] top-[30px] right-[95px] h-[9px] w-[9px] rounded-full bg-violet shadow-[0_0_0_6px_rgb(101_87_232_/_8%)]" />
            <i className="absolute z-[2] right-[17px] bottom-[118px] h-[9px] w-[9px] rounded-full bg-acid shadow-[0_0_0_6px_rgb(101_87_232_/_8%)]" />
            <i className="absolute z-[2] bottom-[7px] left-[130px] h-[6px] w-[6px] rounded-full bg-violet shadow-[0_0_0_6px_rgb(101_87_232_/_8%)]" />
          </div>
          <div className="relative z-[2] max-w-[720px] text-center lg:max-w-[620px] lg:text-left">
            <p className="eyebrow before:mr-2 before:inline-block before:h-[6px] before:w-[6px] before:rounded-full before:bg-violet before:shadow-[0_0_0_4px_rgb(101_87_232_/_10%)]">ONE PROMPT. A COMPLETE VISUAL SYSTEM.</p>
            <h1 className="mx-auto my-[18px] mt-4 max-w-[620px] font-display text-[clamp(44px,4.6vw,66px)] font-medium leading-[0.98] tracking-[-0.067em] lg:mx-0">
              Turn any topic into an{" "}
              <em className="relative whitespace-nowrap not-italic text-violet after:absolute after:-z-[1] after:-right-[5px] after:bottom-1 after:-left-[5px] after:h-[13px] after:-rotate-1 after:bg-acid">annotated visual.</em>
            </h1>
            <p className="mx-auto m-0 max-w-[560px] text-lead leading-[1.6] text-muted lg:mx-0">
              Figure plans the essential components, generates a clean image, and
              grounds every callout to visible pixels—automatically.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-[10px] border-t border-line pt-[18px] text-left" aria-label="Figure capabilities">
              <div className="grid min-w-0 grid-cols-[21px_1fr] gap-x-[7px] gap-y-[2px]">
                <span className="row-span-2 font-display text-micro font-bold text-violet">01</span>
                <strong className="text-ui leading-[1.2]">Smart inventory</strong>
                <small className="overflow-hidden text-meta leading-[1.35] text-muted">AI selects what matters</small>
              </div>
              <div className="grid min-w-0 grid-cols-[21px_1fr] gap-x-[7px] gap-y-[2px]">
                <span className="row-span-2 font-display text-micro font-bold text-violet">02</span>
                <strong className="text-ui leading-[1.2]">Pixel grounded</strong>
                <small className="overflow-hidden text-meta leading-[1.35] text-muted">Every callout has coordinates</small>
              </div>
              <div className="grid min-w-0 grid-cols-[21px_1fr] gap-x-[7px] gap-y-[2px]">
                <span className="row-span-2 font-display text-micro font-bold text-violet">03</span>
                <strong className="text-ui leading-[1.2]">Fully editable</strong>
                <small className="overflow-hidden text-meta leading-[1.35] text-muted">Refine, review, and export</small>
              </div>
            </div>
          </div>

          <div className="relative m-0 w-full rounded-[18px] border border-line-dark bg-white/[0.92] px-[18px] pb-[14px] pt-[18px] shadow-[0_28px_80px_rgb(36_31_86_/_11%),inset_0_-7px_var(--color-acid)] [animation:rise-in_650ms_100ms_cubic-bezier(.2,.8,.2,1)_both]">
            <div className="absolute -top-[30px] right-[2px] hidden items-center gap-[6px] text-micro font-bold uppercase tracking-[0.08em] text-muted lg:inline-flex">
              <i className="h-[6px] w-[6px] rounded-full bg-green shadow-[0_0_0_4px_rgb(44_154_115_/_10%)]" /> AI visual pipeline
            </div>
            <div className="flex items-center justify-between gap-4 px-[5px] pb-[11px]">
              <label htmlFor="subject" className="text-body font-[750]">What do you want to explain?</label>
              <span className="font-display text-micro font-bold tracking-[0.13em] text-muted-2">01 / TOPIC</span>
            </div>
            <div className="grid min-h-[86px] grid-cols-[auto_1fr] items-center gap-[13px] rounded-xl border border-[#d4d2cd] bg-[#faf9f6] py-[10px] pl-[18px] pr-[10px] transition-[border-color,box-shadow] duration-150 focus-within:border-violet focus-within:shadow-[0_0_0_4px_rgb(101_87_232_/_8%)] sm:grid-cols-[auto_1fr_auto]">
              <span className="text-[22px] text-violet" aria-hidden="true">✦</span>
              <textarea
                id="subject"
                className="max-h-[100px] w-full resize-none border-0 bg-transparent font-display text-[clamp(17px,2vw,23px)] font-[520] leading-[1.35] tracking-[-0.03em] text-ink outline-none placeholder:text-[#aaa9ad]"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canGenerate) {
                    void generate();
                  }
                }}
                rows={2}
                maxLength={240}
                placeholder="e.g. Inside a mechanical watch"
              />
              <button
                className="group relative col-span-2 flex min-h-[48px] min-w-[174px] items-center justify-center gap-[9px] overflow-hidden rounded-[9px] border-0 bg-ink px-5 text-body font-[750] text-white shadow-[0_10px_24px_rgb(23_24_29_/_18%)] transition-[transform,background,opacity] duration-150 hover:not-disabled:-translate-y-[2px] hover:not-disabled:bg-violet disabled:cursor-not-allowed disabled:bg-[#e2e1dd] disabled:text-[#999aa0] disabled:shadow-none after:absolute after:-top-[80%] after:-bottom-[80%] after:-left-[35%] after:w-[22%] after:-skew-x-[18deg] after:bg-[linear-gradient(90deg,transparent,rgb(255_255_255_/_24%),transparent)] after:transition-[left] after:duration-[550ms] hover:not-disabled:after:left-[115%] sm:col-span-1 sm:min-h-[57px]"
                type="button"
                disabled={!canGenerate || isGenerating}
                onClick={() => void generate()}
              >
                {isGenerating ? (
                  <span className="h-[15px] w-[15px] rounded-full border-2 border-white/[0.34] border-t-white [animation:spin_0.75s_linear_infinite]" />
                ) : (
                  <span className="grid h-[23px] w-[23px] place-items-center rounded-full bg-acid text-[14px] text-ink" aria-hidden="true">↗</span>
                )}
                {stage === "planning"
                  ? "Planning"
                  : stage === "rendering"
                    ? "Creating"
                    : "Generate figure"}
              </button>
            </div>

            <div className="flex items-center justify-between gap-[14px] px-[5px] pt-[11px]">
              <div className="flex flex-wrap items-center gap-[6px]" aria-label="Example topics">
                <span className="mr-[3px] hidden text-micro font-bold uppercase text-muted sm:inline">Try</span>
                {promptIdeas.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    className="min-h-[32px] rounded-full border border-line bg-white px-[10px] py-1 text-meta text-muted hover:border-violet hover:text-violet"
                    onClick={() => setSubject(idea)}
                  >
                    {idea}
                  </button>
                ))}
              </div>
              <span className="hidden whitespace-nowrap rounded border border-line px-[6px] py-1 text-micro text-muted-2 sm:inline">⌘ ↵</span>
            </div>

            <div className="mt-3 flex flex-col items-stretch gap-[7px] border-t border-[#e6e4df] px-[5px] pb-[7px] pt-[11px] text-meta leading-[1.4] text-muted sm:flex-row sm:items-center">
              <span className="text-ui text-violet" aria-hidden="true">✦</span>
              <p className="m-0 sm:mr-auto">Visual format and audience are selected automatically</p>
              <CustomSelect
                compact
                label="Image model"
                value={imageModel}
                onChange={(value) => setImageModel(value as ImageModel)}
                options={[
                  { value: "gpt-image-2", label: "GPT Image 2", hint: status?.imageModels["gpt-image-2"] ? "Ready" : "Not configured" },
                  { value: "mai-image-2.5", label: "MAI Image 2.5", hint: status?.imageModels["mai-image-2.5"] ? "Ready" : "Not configured" },
                ]}
              />
            </div>

            {error && (
              <div className="mx-1 mt-3 rounded-[3px] border-l-[3px] border-coral bg-[#fff0eb] px-3 py-[10px] text-ui leading-[1.55] text-[#933c29]" role="alert">
                {error}
              </div>
            )}
            {session?.user && !canGenerate && status !== null && (
              <p className="mx-1 mt-[11px] text-ui leading-[1.55] text-muted">
                Add Azure credentials to <code className="font-display text-violet-dark">.env.local</code> to enable live generation.
                The curated sample below remains fully interactive.
              </p>
            )}
          </div>

          <div className="col-span-full grid w-full grid-cols-1 rounded-[10px] border-y border-line bg-white/35 [animation:rise-in_650ms_180ms_cubic-bezier(.2,.8,.2,1)_both] sm:grid-cols-3" aria-label="Automatic generation pipeline">
            {[
              { key: "plan" as const, number: "01", title: "Plan", copy: "Build the component inventory" },
              { key: "render" as const, number: "02", title: "Render", copy: "Generate the label-free image" },
              { key: "annotate" as const, number: "03", title: "Annotate", copy: "Ground callouts to pixels" },
            ].map((item, index) => {
              const itemState = pipelineState(item.key, stage);
              return (
                <div
                  className={`relative grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-[15px] not-first:border-t not-first:border-line sm:not-first:border-l sm:not-first:border-t-0 ${
                    itemState === "active" ? "bg-[linear-gradient(90deg,rgb(101_87_232_/_6%),transparent)]" : ""
                  }`}
                  key={item.key}
                >
                  <span
                    className={`grid h-[30px] w-[30px] place-items-center rounded-full border font-display text-micro font-bold ${
                      itemState === "active"
                        ? "border-violet bg-violet text-white shadow-[0_0_0_5px_rgb(101_87_232_/_9%)] [animation:pulse_1.4s_ease-in-out_infinite]"
                        : itemState === "complete"
                          ? "border-green bg-green text-white"
                          : "border-line-dark text-muted"
                    }`}
                  >
                    {itemState === "complete" ? "✓" : item.number}
                  </span>
                  <div className="grid min-w-0 gap-[2px]">
                    <strong className="font-display text-ui">{item.title}</strong>
                    <small className="text-meta leading-[1.35] text-muted">{item.copy}</small>
                  </div>
                  {index < 2 && (
                    <i className="absolute right-0 grid h-4 w-4 place-items-center rounded-full bg-[#f7f6f2] text-micro not-italic text-muted-2 max-sm:-bottom-2 max-sm:left-[27px] max-sm:right-auto max-sm:rotate-90" aria-hidden="true">→</i>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section
          className="border-t border-[rgb(23_24_29_/_8%)] bg-[linear-gradient(rgb(23_24_29_/_2.5%)_1px,transparent_1px),linear-gradient(90deg,rgb(23_24_29_/_2.5%)_1px,transparent_1px),#efeee9] bg-[length:34px_34px] px-[max(14px,calc((100vw-1440px)/2))] pb-[60px] pt-12 [scroll-margin-top:20px]"
          id="figure-workspace"
        >
          <div className="mx-auto mb-4 flex w-[min(1440px,100%)] flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">02 / FIGURE</p>
              <h2 className="mt-[5px] mb-0 font-display text-[clamp(26px,2.7vw,38px)] font-[530] tracking-[-0.045em]">{plan?.title || result.annotation.title}</h2>
            </div>
            <div className="flex max-sm:w-full items-center gap-[7px]">
              <div className="mr-[6px] hidden items-center gap-[9px] border-r border-line-dark pr-[14px] sm:flex">
                <div
                  className="grid h-[35px] w-[35px] place-items-center rounded-full bg-[conic-gradient(var(--color-violet)_var(--progress),#d9d7d1_0)] before:col-start-1 before:row-start-1 before:h-[27px] before:w-[27px] before:rounded-full before:bg-[#efeee9] before:content-['']"
                  style={{ "--progress": `${reviewProgress * 360}deg` } as React.CSSProperties}
                >
                  <span className="z-[1] col-start-1 row-start-1 font-display text-micro font-bold text-violet-dark after:content-['%']">{Math.round(reviewProgress * 100)}</span>
                </div>
                <div className="grid gap-[2px]">
                  <strong className="whitespace-nowrap text-ui">Review progress</strong>
                  <small className="whitespace-nowrap text-micro text-muted">{approvedCount} of {result.annotation.parts.length} approved</small>
                </div>
              </div>
              {result.provenance.source !== "offline-demo" && (
                <Link
                  className="inline-flex min-h-[38px] items-center gap-[7px] rounded-md border border-violet bg-violet px-[13px] text-meta font-[750] text-white no-underline hover:border-violet-dark hover:bg-violet-dark"
                  href={`/figures/${result.id}`}
                >
                  Open figure page <span aria-hidden="true">→</span>
                </Link>
              )}
              {result.provenance.source !== "offline-demo" && (
                <button
                  type="button"
                  className="min-h-[38px] max-sm:flex-1 rounded-md border border-line-dark bg-white/[0.72] px-3 text-meta font-bold text-ink-2 hover:border-violet hover:text-violet"
                  onClick={() => void saveEdits()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save edits"}
                </button>
              )}
              <button
                type="button"
                className="min-h-[38px] max-sm:flex-1 rounded-md border border-line-dark bg-white/[0.72] px-3 text-meta font-bold text-ink-2 hover:border-violet hover:text-violet"
                onClick={() => void copyAnnotations()}
              >
                Copy JSON
              </button>
              <button
                type="button"
                className="min-h-[38px] max-sm:flex-1 rounded-md border border-line-dark bg-white/[0.72] px-3 text-meta font-bold text-ink-2 hover:border-violet hover:text-violet"
                onClick={exportAnnotations}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="min-h-[38px] max-sm:flex-1 rounded-md border border-ink bg-ink px-3 text-meta font-bold text-white"
                onClick={downloadImage}
              >
                Image <span className="ml-[6px] text-acid" aria-hidden="true">↓</span>
              </button>
            </div>
          </div>

          <div
            className={`mx-auto grid w-[min(1440px,100%)] items-start gap-[14px] ${
              isFocusMode
                ? "grid-cols-[minmax(0,1fr)]"
                : "grid-cols-1 lg:grid-cols-[minmax(520px,1fr)_320px] xl:grid-cols-[minmax(560px,1fr)_370px]"
            }`}
            style={canvasPanelHeight
              ? { "--canvas-panel-height": `${canvasPanelHeight}px` } as React.CSSProperties
              : undefined}
          >
            <section
              ref={canvasPanelRef}
              className={`min-w-0 rounded-[10px] border border-[#d2d0ca] bg-white/[0.94] p-[14px] shadow-float ${isFocusMode ? "[animation:focus-in_220ms_ease_both]" : ""}`}
              aria-label="Annotated visual canvas"
            >
              <div className="flex min-h-[43px] flex-col items-start justify-between gap-4 px-[3px] pb-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2 font-display text-micro text-muted">
                  <span className="rounded-full bg-violet-pale px-[7px] py-1 font-sans font-[750] text-violet-dark">{sourceLabel(result)}</span>
                  <span>{result.provenance.imageModel}</span>
                  <i className="h-[3px] w-[3px] rounded-full bg-muted-2" />
                  <span>{result.annotation.parts.length} components</span>
                  <i className="h-[3px] w-[3px] rounded-full bg-muted-2" />
                  <span>{percent(averageConfidence)} avg. confidence</span>
                </div>
                <div className="flex items-center gap-[6px] max-sm:w-full">
                  <button
                    className="group inline-flex min-h-[32px] max-sm:flex-1 max-sm:justify-center items-center gap-[6px] rounded-[5px] border border-line bg-[#faf9f6] px-[10px] text-micro font-bold text-muted hover:border-violet hover:text-violet-dark aria-pressed:[&_.toggle-visual]:bg-violet aria-pressed:[&_.toggle-visual_i]:translate-x-[10px]"
                    type="button"
                    aria-pressed={showAnnotations}
                    onClick={() => setShowAnnotations((current) => !current)}
                  >
                    <span className="toggle-visual relative h-[14px] w-[24px] rounded-full bg-[#d3d2cd] transition-[background] duration-150">
                      <i className="absolute left-[3px] top-[3px] h-2 w-2 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0_/_20%)] transition-transform duration-150" />
                    </span>
                    Annotations
                  </button>
                  <button
                    className="inline-flex min-h-[32px] max-sm:flex-1 max-sm:justify-center items-center gap-[6px] rounded-[5px] border border-line bg-[#faf9f6] px-[10px] text-micro font-bold text-muted hover:border-violet hover:text-violet-dark"
                    type="button"
                    aria-pressed={isFocusMode}
                    onClick={() => setIsFocusMode((current) => !current)}
                  >
                    <span aria-hidden="true">{isFocusMode ? "↙" : "↗"}</span>
                    {isFocusMode ? "Exit focus" : "Focus"}
                  </button>
                  <button
                    className="min-h-[32px] flex-none max-sm:flex-1 max-sm:justify-center rounded-md border border-line-dark bg-white/[0.72] px-3 text-meta font-bold text-ink-2 hover:border-violet hover:text-violet"
                    type="button"
                    onClick={restoreDemo}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="relative">
                <AnnotationCanvas
                  image={result.image}
                  parts={result.annotation.parts}
                  selectedId={selectedId}
                  showAnnotations={showAnnotations}
                  onSelect={setSelectedId}
                  onAnchorChange={moveAnchor}
                />
                {isGenerating && (
                  <div className="absolute inset-0 z-[5] grid place-content-center justify-items-center p-6 text-center text-white bg-[rgb(20_21_26_/_84%)] backdrop-blur-[13px]" aria-live="polite">
                    <div className="relative mb-5 grid h-[78px] w-[78px] place-items-center rounded-full border border-white/[0.22] [animation:orbit_3s_linear_infinite] before:absolute before:inset-[11px] before:rounded-full before:border before:border-dashed before:border-[rgb(217_255_112_/_52%)] before:content-['']">
                      <i className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-violet" />
                      <i className="absolute right-[5px] bottom-2 h-[7px] w-[7px] rounded-full bg-acid" />
                      <span className="text-[22px] text-acid">✦</span>
                    </div>
                    <strong className="font-display text-[21px]">{stage === "planning" ? "Mapping the topic" : "Building your figure"}</strong>
                    <p className="mt-[7px] mb-0 text-ui text-white/[0.62]">
                      {stage === "planning"
                        ? "Selecting the clearest visible components…"
                        : "Rendering the image, then grounding every component…"}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex min-h-[43px] flex-col items-start justify-between gap-2 px-[3px] pt-[11px] sm:flex-row sm:items-center sm:gap-[18px]">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-[5px] text-micro text-muted"><i className="inline-block h-[7px] w-[7px] rounded-full bg-violet" />AI draft</span>
                  <span className="inline-flex items-center gap-[5px] text-micro text-muted"><i className="inline-block h-[7px] w-[7px] rounded-full bg-amber" />Low confidence</span>
                  <span className="inline-flex items-center gap-[5px] text-micro text-muted"><i className="inline-block h-[7px] w-[7px] rounded-full bg-green" />Reviewed</span>
                </div>
                <p className="m-0 text-micro text-muted max-sm:text-left sm:text-right">{showAnnotations ? "Drag numbered anchors to correct their position." : "Clean image preview · Turn annotations on to edit."}</p>
              </div>
            </section>

            <aside
              className={`min-w-0 self-stretch overflow-auto rounded-[10px] border border-[#d2d0ca] bg-white/[0.94] p-5 shadow-float [scrollbar-color:#c9c7c1_transparent] [scrollbar-width:thin] lg:sticky lg:top-[14px] lg:h-[var(--canvas-panel-height,auto)] ${isFocusMode ? "hidden" : ""}`}
              aria-label="Component inventory and review"
            >
              <div className="flex items-start justify-between gap-[18px] border-b border-line pb-[17px]">
                <div>
                  <p className="eyebrow">03 / COMPONENT MAP</p>
                  <h2 className="mt-[5px] mb-0 font-display text-[24px] font-[530] tracking-[-0.045em]">Parts &amp; callouts</h2>
                </div>
                <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-ink font-display text-micro font-bold text-white">{plan?.parts.length || result.annotation.parts.length}</span>
              </div>

              {!isGenerating && (
                <div className="mx-0 my-[7px] mt-[14px] rounded-[7px] border border-[#e5e2da] bg-[linear-gradient(135deg,#f8f7f3,#f2f0ff)] px-3 py-[11px]">
                  <div className="flex items-center justify-between gap-3 text-meta font-bold">
                    <span>Human review</span>
                    <strong className="font-display text-violet-dark">{Math.round(reviewProgress * 100)}%</strong>
                  </div>
                  <div className="my-[7px] h-[3px] overflow-hidden rounded-full bg-[#d9d7d1]">
                    <i className="block h-full rounded-[inherit] bg-[linear-gradient(90deg,var(--color-violet),#947eff)] transition-[width] duration-[260ms]" style={{ width: percent(reviewProgress) }} />
                  </div>
                  <small className="text-micro leading-[1.4] text-muted">{approvedCount === result.annotation.parts.length ? "All annotations are ready." : "Select each component to verify its anchor and copy."}</small>
                </div>
              )}

              {stage === "planning" ? (
                <div className="pb-[5px] pt-[17px]" aria-live="polite">
                  <p className="mb-[15px] mt-0 flex items-center gap-2 text-ui font-bold text-violet-dark">
                    <span className="h-[13px] w-[13px] rounded-full border-2 border-[rgb(101_87_232_/_20%)] border-t-violet [animation:spin_0.75s_linear_infinite]" />
                    Building the component inventory
                  </p>
                  {[0, 1, 2, 3, 4].map((item, index) => (
                    <i
                      key={item}
                      className="mt-[7px] block h-[47px] rounded-[5px] bg-[linear-gradient(90deg,#f0efeb_25%,#f7f6f2_50%,#f0efeb_75%)] bg-[length:200%_100%] [animation:skeleton_1.25s_ease-in-out_infinite]"
                      style={index === 1 ? { width: "93%" } : index === 2 ? { width: "97%" } : index === 3 ? { width: "88%" } : undefined}
                    />
                  ))}
                </div>
              ) : stage === "rendering" && plan ? (
                <div className="pt-[13px]" aria-live="polite">
                  <p className="mb-2 mt-0 flex items-center gap-[7px] text-meta font-bold text-green">
                    <span className="grid h-[17px] w-[17px] place-items-center rounded-full bg-green text-white">✓</span> Inventory generated
                  </p>
                  {plan.parts.map((part, index) => (
                    <div className="relative grid min-h-[63px] grid-cols-[29px_1fr_auto] items-center gap-2 border-b border-[#eceae5]" key={part.id}>
                      <span className="text-center font-display text-micro font-bold text-violet">{String(index + 1).padStart(2, "0")}</span>
                      <div className="grid min-w-0 gap-[3px]">
                        <strong className="text-ui">{part.name}</strong>
                        <small className="line-clamp-2 overflow-hidden text-micro leading-[1.4] text-muted">{part.description}</small>
                      </div>
                      <i className="h-[7px] w-[7px] rounded-full border-2 border-[#d7d5d0] border-t-violet [animation:spin_0.9s_linear_infinite]" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <nav className="my-[18px] mt-[5px] grid" aria-label="Components">
                    {result.annotation.parts.map((part) => {
                      const expanded = selectedId === part.id;
                      const dotColor =
                        part.reviewStatus === "human-edited"
                          ? "bg-amber"
                          : part.reviewStatus === "approved"
                            ? "bg-green"
                            : "bg-violet";
                      return (
                        <div key={part.id}>
                          <button
                            type="button"
                            className={`relative grid min-h-[48px] min-w-0 grid-cols-[30px_1fr_auto_22px] items-center gap-2 border-0 border-b border-[#eceae5] bg-transparent px-[5px] py-1 text-left hover:bg-[#f6f4ff] hover:text-violet-dark ${
                              expanded
                                ? "bg-[#f6f4ff] text-violet-dark shadow-[inset_3px_0_var(--color-violet)]"
                                : "text-muted"
                            } ${part.visible ? "" : "opacity-50"}`}
                            aria-expanded={expanded}
                            aria-controls={`part-editor-${part.id}`}
                            onClick={() => setSelectedId(expanded ? null : part.id)}
                          >
                            <span className="text-center font-display text-micro font-bold">{String(part.index + 1).padStart(2, "0")}</span>
                            <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-ui font-[650] text-ink-2">{part.name}</strong>
                            <small className="text-micro text-muted-2">{percent(part.confidence)}</small>
                            <i className={`absolute right-[30px] h-[5px] w-[5px] rounded-full ${dotColor}`} />
                            <em className={`col-start-4 text-center font-display text-[17px] font-medium not-italic leading-none ${expanded ? "text-violet" : "text-muted-2"}`} aria-hidden="true">{expanded ? "−" : "+"}</em>
                          </button>
                          {expanded && renderPartEditor(part)}
                        </div>
                      );
                    })}
                  </nav>
                </>
              )}

              {result.annotation.warnings.length > 0 && !isGenerating && (
                <details className="mt-[15px] border-t border-line text-meta text-muted">
                  <summary className="cursor-pointer pb-[5px] pt-3 font-bold text-[#a44e36]">Quality notes · {result.annotation.warnings.length}</summary>
                  <ul className="mt-[5px] pl-[17px] leading-[1.55] [&>li+li]:mt-[5px]">
                    {result.annotation.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </details>
              )}
            </aside>
          </div>
        </section>
      </main>

      <footer className="mx-auto grid min-h-[105px] w-[min(1440px,calc(100%-64px))] grid-cols-1 items-center gap-[10px] text-micro text-muted sm:grid-cols-[auto_1fr] sm:gap-9 lg:grid-cols-[auto_1fr_auto]">
        <div className="flex items-center gap-[10px]">
          <strong className="font-display tracking-[0.12em] text-ink">FIGURE</strong>
          <span>Pixels made explainable.</span>
        </div>
        <p className="m-0 mx-auto max-w-[600px] leading-[1.55] max-sm:text-left sm:text-center">AI-generated visuals and spatial locations are drafts. Expert review is required for medical, engineering, and safety-critical use.</p>
        <span className="text-right max-lg:hidden">Stored securely · Semantic data stays separate</span>
      </footer>

      {notice && (
        <div className="fixed bottom-[22px] right-[22px] z-20 flex items-center gap-[9px] rounded-[7px] bg-[rgb(23_24_29_/_96%)] px-[14px] py-[11px] text-ui font-bold text-white shadow-[0_16px_45px_rgb(0_0_0_/_22%)] [animation:toast-in_180ms_ease-out]" role="status">
          <span className="grid h-[17px] w-[17px] place-items-center rounded-full bg-acid text-[10px] text-ink">✓</span>{notice}
        </div>
      )}
    </div>
  );
}
