"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { AnnotationCanvas } from "@/components/annotation-canvas";
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

export function DiagramStudio() {
  const { data: session, status: sessionStatus, update: updateSession } = useSession();
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
    return (
      <div className="part-detail" id={`part-editor-${part.id}`}>
        <div className="detail-title-row">
          <div>
            <p>COMPONENT {String(part.index + 1).padStart(2, "0")}</p>
            <h3>{part.name}</h3>
          </div>
          <span data-status={part.reviewStatus}>{reviewLabel(part)}</span>
        </div>

        {!part.visible && (
          <div className="visibility-warning">
            This component could not be located reliably. Review it manually or regenerate.
          </div>
        )}

        <label className="description-editor">
          <span>Description</span>
          <textarea
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

        <div className="confidence-block">
          <div><span>Visual confidence</span><strong>{percent(part.confidence)}</strong></div>
          <div className="confidence-track"><i style={{ width: percent(part.confidence) }} /></div>
          <p>{part.evidence}</p>
        </div>

        <div className="coordinate-editor">
          <span>Normalized anchor</span>
          <div>
            <label>
              X
              <input
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
            <label>
              Y
              <input
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
          className="review-button"
          disabled={!part.visible || part.reviewStatus === "approved"}
          onClick={() =>
            updatePart(part.id, (current) => ({ ...current, reviewStatus: "approved" }))
          }
        >
          <span aria-hidden="true">✓</span>
          {part.reviewStatus === "approved" ? "Component reviewed" : "Approve annotation"}
        </button>
      </div>
    );
  }

  return (
    <div className="app-frame">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Figure home">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
          </span>
          <strong>FIGURE</strong>
          <span className="brand-divider" />
          <small>Visual intelligence studio</small>
        </Link>
        <div className="header-meta">
          <Link className="header-link" href="/discover">Discover</Link>
          <Link className="header-link" href="/library">My figures</Link>
          <Link className="header-link" href="/collections">Collections</Link>
          <Link className="header-link" href="/favorites">Favorites</Link>
          <Link className="header-link" href="/quiz">Quiz lab</Link>
          {session?.user ? (
            <>
              <Link className="studio-credit-link" href="/credits"><strong>{session.user.credits}</strong> credits</Link>
              <Link className="studio-account-chip" href="/account" aria-label="Account settings">
                <span>{session.user.name?.slice(0, 1).toUpperCase() || session.user.email?.slice(0, 1).toUpperCase() || "F"}</span>
              </Link>
              <button type="button" className="studio-signout" aria-label="Sign out" onClick={() => void signOut({ redirectTo: "/" })}><LogOut size={15} /></button>
            </>
          ) : (
            <Link className="studio-signin-link" href="/signin?callbackUrl=/studio">Sign in</Link>
          )}
          <div className="connection-status" data-ready={canGenerate}>
            <span className="status-dot" />
            {status === null
              ? "Checking Azure"
              : canGenerate
                ? "Pipeline ready"
                : "Sample mode"}
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="top">
          <div className="hero-aura" aria-hidden="true"><i /><i /><i /></div>
          <div className="hero-copy">
            <p className="eyebrow"><span /> ONE PROMPT. A COMPLETE VISUAL SYSTEM.</p>
            <h1>Turn any topic into an <em>annotated visual.</em></h1>
            <p className="hero-description">
              Figure plans the essential components, generates a clean image, and
              grounds every callout to visible pixels—automatically.
            </p>
            <div className="hero-proof" aria-label="Figure capabilities">
              <div><span>01</span><strong>Smart inventory</strong><small>AI selects what matters</small></div>
              <div><span>02</span><strong>Pixel grounded</strong><small>Every callout has coordinates</small></div>
              <div><span>03</span><strong>Fully editable</strong><small>Refine, review, and export</small></div>
            </div>
          </div>

          <div className="composer-card">
            <div className="composer-status"><i /> AI visual pipeline</div>
            <div className="composer-label-row">
              <label htmlFor="subject">What do you want to explain?</label>
              <span>01 / TOPIC</span>
            </div>
            <div className="prompt-composer">
              <span className="spark-icon" aria-hidden="true">✦</span>
              <textarea
                id="subject"
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
                className="generate-button"
                type="button"
                disabled={!canGenerate || isGenerating}
                onClick={() => void generate()}
              >
                {isGenerating ? <span className="spinner" /> : <span aria-hidden="true">↗</span>}
                {stage === "planning"
                  ? "Planning"
                  : stage === "rendering"
                    ? "Creating"
                    : "Generate figure"}
              </button>
            </div>

            <div className="composer-footer">
              <div className="prompt-ideas" aria-label="Example topics">
                <span>Try</span>
                {promptIdeas.map((idea) => (
                  <button key={idea} type="button" onClick={() => setSubject(idea)}>
                    {idea}
                  </button>
                ))}
              </div>
              <span className="shortcut">⌘ ↵</span>
            </div>

            <div className="auto-brief-note">
              <span aria-hidden="true">✦</span>
              <p>Visual format and audience are selected automatically</p>
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

            {error && <div className="error-box" role="alert">{error}</div>}
            {sessionStatus !== "loading" && !session?.user && (
              <p className="configuration-note signin-note">
                <Link href="/signin?callbackUrl=/studio">Sign in</Link> to generate, save, and quiz your own figures.
              </p>
            )}
            {session?.user && !canGenerate && status !== null && (
              <p className="configuration-note">
                Add Azure credentials to <code>.env.local</code> to enable live generation.
                The curated sample below remains fully interactive.
              </p>
            )}
          </div>

          <div className="pipeline" aria-label="Automatic generation pipeline">
            {[
              { key: "plan" as const, number: "01", title: "Plan", copy: "Build the component inventory" },
              { key: "render" as const, number: "02", title: "Render", copy: "Generate the label-free image" },
              { key: "annotate" as const, number: "03", title: "Annotate", copy: "Ground callouts to pixels" },
            ].map((item, index) => {
              const itemState = pipelineState(item.key, stage);
              return (
                <div className="pipeline-item" data-state={itemState} key={item.key}>
                  <span className="pipeline-number">
                    {itemState === "complete" ? "✓" : item.number}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.copy}</small>
                  </div>
                  {index < 2 && <i aria-hidden="true">→</i>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="workspace-section" id="figure-workspace">
          <div className="section-heading">
            <div>
              <p className="section-index">02 / FIGURE</p>
              <h2>{plan?.title || result.annotation.title}</h2>
            </div>
            <div className="workspace-actions">
              <div className="review-summary">
                <div className="review-ring" style={{ "--progress": `${reviewProgress * 360}deg` } as React.CSSProperties}>
                  <span>{Math.round(reviewProgress * 100)}</span>
                </div>
                <div><strong>Review progress</strong><small>{approvedCount} of {result.annotation.parts.length} approved</small></div>
              </div>
              {result.provenance.source !== "offline-demo" && (
                <Link className="workspace-open-figure" href={`/figures/${result.id}`}>
                  Open figure page <span aria-hidden="true">→</span>
                </Link>
              )}
              {result.provenance.source !== "offline-demo" && (
                <button type="button" onClick={() => void saveEdits()} disabled={saving}>
                  {saving ? "Saving…" : "Save edits"}
                </button>
              )}
              <button type="button" onClick={() => void copyAnnotations()}>Copy JSON</button>
              <button type="button" onClick={exportAnnotations}>Export JSON</button>
              <button type="button" className="action-primary" onClick={downloadImage}>
                Image <span aria-hidden="true">↓</span>
              </button>
            </div>
          </div>

          <div
            className={`workspace-grid${isFocusMode ? " is-focus-mode" : ""}`}
            style={canvasPanelHeight
              ? { "--canvas-panel-height": `${canvasPanelHeight}px` } as React.CSSProperties
              : undefined}
          >
            <section ref={canvasPanelRef} className="canvas-panel" aria-label="Annotated visual canvas">
              <div className="canvas-toolbar">
                <div className="canvas-meta">
                  <span className="source-chip">{sourceLabel(result)}</span>
                  <span>{result.provenance.imageModel}</span>
                  <i />
                  <span>{result.annotation.parts.length} components</span>
                  <i />
                  <span>{percent(averageConfidence)} avg. confidence</span>
                </div>
                <div className="canvas-controls">
                  <button
                    className="canvas-toggle"
                    type="button"
                    aria-pressed={showAnnotations}
                    onClick={() => setShowAnnotations((current) => !current)}
                  >
                    <span className="toggle-visual"><i /></span>
                    Annotations
                  </button>
                  <button
                    className="canvas-tool"
                    type="button"
                    aria-pressed={isFocusMode}
                    onClick={() => setIsFocusMode((current) => !current)}
                  >
                    <span aria-hidden="true">{isFocusMode ? "↙" : "↗"}</span>
                    {isFocusMode ? "Exit focus" : "Focus"}
                  </button>
                  <button className="sample-button" type="button" onClick={restoreDemo}>Reset</button>
                </div>
              </div>

              <div className="canvas-stage">
                <AnnotationCanvas
                  image={result.image}
                  parts={result.annotation.parts}
                  selectedId={selectedId}
                  showAnnotations={showAnnotations}
                  onSelect={setSelectedId}
                  onAnchorChange={moveAnchor}
                />
                {isGenerating && (
                  <div className="generation-overlay" aria-live="polite">
                    <div className="generation-orbit"><i /><i /><span>✦</span></div>
                    <strong>{stage === "planning" ? "Mapping the topic" : "Building your figure"}</strong>
                    <p>
                      {stage === "planning"
                        ? "Selecting the clearest visible components…"
                        : "Rendering the image, then grounding every component…"}
                    </p>
                  </div>
                )}
              </div>

              <div className="canvas-footer">
                <div className="legend">
                  <span><i className="legend-dot draft" />AI draft</span>
                  <span><i className="legend-dot uncertain" />Low confidence</span>
                  <span><i className="legend-dot approved" />Reviewed</span>
                </div>
                <p>{showAnnotations ? "Drag numbered anchors to correct their position." : "Clean image preview · Turn annotations on to edit."}</p>
              </div>
            </section>

            <aside className="component-panel" aria-label="Component inventory and review">
              <div className="component-heading">
                <div>
                  <p className="section-index">03 / COMPONENT MAP</p>
                  <h2>Parts &amp; callouts</h2>
                </div>
                <span>{plan?.parts.length || result.annotation.parts.length}</span>
              </div>

              {!isGenerating && (
                <div className="review-progress-card">
                  <div><span>Human review</span><strong>{Math.round(reviewProgress * 100)}%</strong></div>
                  <div className="review-progress-track"><i style={{ width: percent(reviewProgress) }} /></div>
                  <small>{approvedCount === result.annotation.parts.length ? "All annotations are ready." : "Select each component to verify its anchor and copy."}</small>
                </div>
              )}

              {stage === "planning" ? (
                <div className="planning-skeleton" aria-live="polite">
                  <p><span className="spinner-dark" />Building the component inventory</p>
                  {[0, 1, 2, 3, 4].map((item) => <i key={item} />)}
                </div>
              ) : stage === "rendering" && plan ? (
                <div className="planned-list" aria-live="polite">
                  <p className="plan-ready"><span>✓</span> Inventory generated</p>
                  {plan.parts.map((part, index) => (
                    <div className="planned-part" key={part.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{part.name}</strong><small>{part.description}</small></div>
                      <i />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <nav className="part-nav" aria-label="Components">
                    {result.annotation.parts.map((part) => {
                      const expanded = selectedId === part.id;
                      return (
                        <div className="part-accordion-item" key={part.id}>
                          <button
                            type="button"
                            className={expanded ? "is-selected" : ""}
                            data-visible={part.visible}
                            aria-expanded={expanded}
                            aria-controls={`part-editor-${part.id}`}
                            onClick={() => setSelectedId(expanded ? null : part.id)}
                          >
                            <span>{String(part.index + 1).padStart(2, "0")}</span>
                            <strong>{part.name}</strong>
                            <small>{percent(part.confidence)}</small>
                            <i data-status={part.reviewStatus} />
                            <em aria-hidden="true">{expanded ? "−" : "+"}</em>
                          </button>
                          {expanded && renderPartEditor(part)}
                        </div>
                      );
                    })}
                  </nav>
                </>
              )}

              {result.annotation.warnings.length > 0 && !isGenerating && (
                <details className="warnings">
                  <summary>Quality notes · {result.annotation.warnings.length}</summary>
                  <ul>
                    {result.annotation.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </details>
              )}
            </aside>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div><strong>FIGURE</strong><span>Pixels made explainable.</span></div>
        <p>AI-generated visuals and spatial locations are drafts. Expert review is required for medical, engineering, and safety-critical use.</p>
        <span>Stored securely · Semantic data stays separate</span>
      </footer>

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </div>
  );
}
