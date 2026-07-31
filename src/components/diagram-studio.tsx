"use client";

import { useEffect, useMemo, useState } from "react";

import { AnnotationCanvas } from "@/components/annotation-canvas";
import type {
  AnnotatedPart,
  AzureStatus,
  DiagramResult,
  DiagramType,
  ImageModel,
  Point,
} from "@/lib/contracts";
import { demoResult } from "@/lib/demo-data";
import { parsePartLines } from "@/lib/part-lines";

const initialPartLines = [
  "[casing] 泵壳 | 包围叶轮并形成蜗形流道，将部分速度能转化为压力能。",
  "[impeller] 叶轮 | 随主轴旋转，通过叶片向液体传递机械能。",
  "[shaft] 主轴 | 把驱动端扭矩传递给叶轮并保持旋转中心。",
  "[seal] 机械密封 | 限制液体沿旋转主轴向泵体外泄漏。",
  "[inlet] 进水口 | 沿叶轮轴向把液体引入叶轮中央。",
  "[outlet] 出水口 | 将泵壳内增压后的液体导向外部管路。",
  "[bearing] 轴承 | 支撑主轴、控制径向位移并降低摩擦。",
].join("\n");

const diagramTypes: Array<{ value: DiagramType; label: string }> = [
  { value: "anatomy", label: "解剖" },
  { value: "cutaway", label: "剖视" },
  { value: "exploded", label: "爆炸" },
  { value: "construction", label: "构造" },
];

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function coordinate(value: number): string {
  return value.toFixed(3);
}

function sourceLabel(result: DiagramResult): string {
  return result.provenance.source === "offline-demo" ? "离线样例" : "Azure 生成";
}

function reviewLabel(part: AnnotatedPart): string {
  if (part.reviewStatus === "approved") return "已人工复核";
  if (part.reviewStatus === "human-edited") return "已人工校正";
  return "AI 草稿";
}

export function DiagramStudio() {
  const [result, setResult] = useState<DiagramResult>(demoResult);
  const [subject, setSubject] = useState("工业离心泵的内部结构");
  const [diagramType, setDiagramType] = useState<DiagramType>("cutaway");
  const [audience, setAudience] = useState("职业教育与设备维护初学者");
  const [imageModel, setImageModel] = useState<ImageModel>("gpt-image-2");
  const [partLines, setPartLines] = useState(initialPartLines);
  const [selectedId, setSelectedId] = useState<string | null>("impeller");
  const [status, setStatus] = useState<AzureStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("status unavailable");
        return (await response.json()) as AzureStatus;
      })
      .then((data) => {
        if (active) setStatus(data);
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
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedPart = useMemo(
    () => result.annotation.parts.find((part) => part.id === selectedId) ?? null,
    [result, selectedId],
  );

  const selectedModelReady = status?.imageModels[imageModel] ?? false;
  const canGenerate = Boolean(status?.visionConfigured && selectedModelReady);
  const approvedCount = result.annotation.parts.filter(
    (part) => part.reviewStatus === "approved",
  ).length;

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
    setError(null);
    setNotice(null);
    let parts;
    try {
      parts = parsePartLines(partLines);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "部件格式错误。 ");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, diagramType, audience, imageModel, parts }),
      });
      const payload = (await response.json()) as DiagramResult & {
        error?: string;
        requestId?: string;
      };
      if (!response.ok) {
        throw new Error(
          `${payload.error || "生成失败。"}${payload.requestId ? `（${payload.requestId}）` : ""}`,
        );
      }
      setResult(payload);
      setSelectedId(payload.annotation.parts.find((part) => part.visible)?.id ?? null);
      setNotice("图片与空间标注已生成");
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "生成过程中发生未知错误。 ",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function restoreDemo() {
    setResult(demoResult);
    setSelectedId("impeller");
    setError(null);
    setNotice("已恢复离线样例");
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
    setNotice("标注 JSON 已导出");
  }

  async function copyAnnotations() {
    await navigator.clipboard.writeText(
      JSON.stringify(result.annotation, null, 2),
    );
    setNotice("标注 JSON 已复制");
  }

  return (
    <div className="app-frame">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Semantic Diagram Lab 首页">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>Semantic Diagram</strong>
            <small>Azure AI spatial annotation PoC</small>
          </span>
        </a>
        <div className="connection-status" data-ready={canGenerate}>
          <span className="status-dot" />
          {status === null
            ? "正在检查 Azure 配置"
            : canGenerate
              ? "Azure 管线已就绪"
              : "离线模式 · Azure 未配置"}
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">PIXELS + SEMANTICS</p>
          <h1>
            让每个部件
            <span>有位置，也有解释。</span>
          </h1>
        </div>
        <p className="intro-copy">
          Azure 负责生成和视觉定位；坐标、引线、说明及审核状态保存在独立 JSON
          语义层。拖动图中编号，即可人工纠正 AI 定位。
        </p>
      </section>

      <main className="studio-grid">
        <aside className="panel control-panel" aria-label="生成设置">
          <div className="panel-heading">
            <span className="step-index">01</span>
            <div>
              <p className="panel-kicker">GENERATE</p>
              <h2>定义图像</h2>
            </div>
          </div>

          <label className="field">
            <span>主题</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={240}
            />
          </label>

          <fieldset className="field">
            <legend>图像类型</legend>
            <div className="segmented-control">
              {diagramTypes.map((item) => (
                <label key={item.value}>
                  <input
                    type="radio"
                    name="diagram-type"
                    value={item.value}
                    checked={diagramType === item.value}
                    onChange={() => setDiagramType(item.value)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>面向人群</span>
            <input
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              maxLength={120}
            />
          </label>

          <fieldset className="field model-field">
            <legend>图片部署</legend>
            <label className="model-option">
              <input
                type="radio"
                name="image-model"
                checked={imageModel === "gpt-image-2"}
                onChange={() => setImageModel("gpt-image-2")}
              />
              <span className="radio-visual" />
              <span>
                <strong>gpt-image-2</strong>
                <small>{status?.deployments.gptImage || "Azure 部署名"}</small>
              </span>
              <em data-ready={status?.imageModels["gpt-image-2"]}>GPT</em>
            </label>
            <label className="model-option">
              <input
                type="radio"
                name="image-model"
                checked={imageModel === "mai-image-2.5"}
                onChange={() => setImageModel("mai-image-2.5")}
              />
              <span className="radio-visual" />
              <span>
                <strong>MAI-Image-2.5</strong>
                <small>{status?.deployments.maiImage || "Azure 部署名"}</small>
              </span>
              <em data-ready={status?.imageModels["mai-image-2.5"]}>MAI</em>
            </label>
          </fieldset>

          <label className="field parts-field">
            <span>
              部件清单
              <small>每行：[id] 名称 | 说明</small>
            </span>
            <textarea
              value={partLines}
              onChange={(event) => setPartLines(event.target.value)}
              rows={10}
              spellCheck={false}
            />
          </label>

          {error && <div className="error-box">{error}</div>}

          <button
            className="primary-button"
            type="button"
            disabled={!canGenerate || isGenerating}
            onClick={generate}
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                Azure 正在生成与定位…
              </>
            ) : (
              <>
                生成图像与标注
                <span aria-hidden="true">↗</span>
              </>
            )}
          </button>
          {!canGenerate && (
            <p className="configuration-note">
              配置 <code>.env.local</code> 后可启用真实调用；当前样例可完整体验标注交互。
            </p>
          )}
          <button className="text-button" type="button" onClick={restoreDemo}>
            恢复离线样例
          </button>
        </aside>

        <section className="panel workspace-panel" aria-label="图像标注工作区">
          <div className="workspace-heading">
            <div>
              <p className="panel-kicker">SPATIAL CANVAS</p>
              <h2>{result.annotation.title}</h2>
            </div>
            <div className="workspace-actions">
              <button type="button" onClick={copyAnnotations}>
                复制 JSON
              </button>
              <button type="button" onClick={exportAnnotations}>
                导出标注
              </button>
            </div>
          </div>

          <div className="provenance-row">
            <span className="source-chip">{sourceLabel(result)}</span>
            <span>{result.provenance.imageModel}</span>
            <i aria-hidden="true" />
            <span>{result.provenance.visionModel}</span>
            <i aria-hidden="true" />
            <span>
              {result.annotation.parts.length} 个部件 · {approvedCount} 个已复核
            </span>
          </div>

          <AnnotationCanvas
            image={result.image}
            parts={result.annotation.parts}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAnchorChange={moveAnchor}
          />

          <div className="canvas-footer">
            <div className="legend">
              <span><i className="legend-dot draft" />AI 草稿</span>
              <span><i className="legend-dot uncertain" />低置信度</span>
              <span><i className="legend-dot approved" />人工复核</span>
            </div>
            <p>坐标采用 0–1 归一化，与显示尺寸无关。</p>
          </div>
        </section>

        <aside className="panel inspector-panel" aria-label="部件与说明">
          <div className="panel-heading inspector-heading">
            <span className="step-index">02</span>
            <div>
              <p className="panel-kicker">GROUND & REVIEW</p>
              <h2>部件说明</h2>
            </div>
          </div>

          <div className="part-nav" aria-label="部件列表">
            {result.annotation.parts.map((part) => (
              <button
                key={part.id}
                type="button"
                className={selectedId === part.id ? "is-selected" : ""}
                data-visible={part.visible}
                onClick={() => setSelectedId(part.id)}
              >
                <span>{part.index + 1}</span>
                <strong>{part.name}</strong>
                <i data-status={part.reviewStatus} />
              </button>
            ))}
          </div>

          {selectedPart ? (
            <div className="part-detail">
              <div className="detail-title-row">
                <div>
                  <p>PART {String(selectedPart.index + 1).padStart(2, "0")}</p>
                  <h3>{selectedPart.name}</h3>
                </div>
                <span data-status={selectedPart.reviewStatus}>
                  {reviewLabel(selectedPart)}
                </span>
              </div>

              {!selectedPart.visible && (
                <div className="visibility-warning">
                  视觉模型未能可靠定位此部件，请人工确认或重新生成。
                </div>
              )}

              <label className="description-editor">
                <span>文字说明</span>
                <textarea
                  value={selectedPart.description}
                  rows={4}
                  onChange={(event) =>
                    updatePart(selectedPart.id, (part) => ({
                      ...part,
                      description: event.target.value,
                      reviewStatus: "human-edited",
                    }))
                  }
                />
              </label>

              <div className="confidence-block">
                <div>
                  <span>视觉置信度</span>
                  <strong>{percent(selectedPart.confidence)}</strong>
                </div>
                <div className="confidence-track">
                  <i style={{ width: percent(selectedPart.confidence) }} />
                </div>
                <p>{selectedPart.evidence}</p>
              </div>

              <div className="coordinate-editor">
                <span>归一化锚点</span>
                <div>
                  <label>
                    X
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.001"
                      value={coordinate(selectedPart.anchor.x)}
                      disabled={!selectedPart.visible}
                      onChange={(event) =>
                        moveAnchor(selectedPart.id, {
                          x: Math.min(1, Math.max(0, Number(event.target.value))),
                          y: selectedPart.anchor.y,
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
                      value={coordinate(selectedPart.anchor.y)}
                      disabled={!selectedPart.visible}
                      onChange={(event) =>
                        moveAnchor(selectedPart.id, {
                          x: selectedPart.anchor.x,
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
                disabled={!selectedPart.visible || selectedPart.reviewStatus === "approved"}
                onClick={() =>
                  updatePart(selectedPart.id, (part) => ({
                    ...part,
                    reviewStatus: "approved",
                  }))
                }
              >
                <span aria-hidden="true">✓</span>
                {selectedPart.reviewStatus === "approved"
                  ? "此部件已复核"
                  : "确认位置与说明"}
              </button>
            </div>
          ) : (
            <p className="empty-detail">请选择一个可见部件。</p>
          )}

          {result.annotation.warnings.length > 0 && (
            <details className="warnings">
              <summary>质量提示 · {result.annotation.warnings.length}</summary>
              <ul>
                {result.annotation.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
        </aside>
      </main>

      <footer className="site-footer">
        <p>
          <strong>安全边界</strong>
          AI 生成图和空间定位均为草稿；医学、工程和安全关键场景必须专业复核。
        </p>
        <span>图像像素与语义数据分层存储 · 无服务端持久化</span>
      </footer>

      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
