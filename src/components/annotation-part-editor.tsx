"use client";

import { useI18n } from "@/components/i18n-provider";
import { AnchorCoordinateInput } from "@/components/anchor-coordinate-input";
import { Field, Input, Textarea } from "@/components/ui";
import type { AnnotatedPart } from "@/lib/contracts";

export function AnnotationPartEditor({
  part,
  onChange,
  disabled = false,
}: {
  part: AnnotatedPart;
  onChange: (part: AnnotatedPart) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  function update(patch: Partial<AnnotatedPart>) {
    onChange({ ...part, ...patch, reviewStatus: "human-edited" });
  }
  function updateCoordinate(axis: "x" | "y", value: number) {
    if (!Number.isFinite(value)) return;
    update({ anchor: { ...part.anchor, [axis]: Math.min(1, Math.max(0, value)) } });
  }

  return (
    <fieldset disabled={disabled} className="m-0 grid min-w-0 gap-3 border-0 p-0">
      <legend className="mb-3 text-micro font-extrabold uppercase tracking-[0.12em] text-pine-dark">{t("SELECTED COMPONENT")}</legend>
      <Field label={t("Name")}><Input value={part.name} maxLength={80} required onChange={(event) => update({ name: event.target.value })} /></Field>
      <Field label={t("Description")}><Textarea value={part.description} maxLength={500} rows={4} required onChange={(event) => update({ description: event.target.value })} /></Field>
      <label className="flex min-h-[40px] items-center gap-2 text-meta font-bold">
        <input type="checkbox" checked={part.visible} onChange={(event) => update({ visible: event.target.checked })} />
        {t("Show component on figure")}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {(["x", "y"] as const).map((axis) => (
          <Field key={axis} label={`${t("Normalized anchor")} ${axis.toUpperCase()}`}>
            <AnchorCoordinateInput
              className="h-[42px] min-w-0 rounded-lg border border-line bg-paper px-2 text-ui"
              value={part.anchor[axis]}
              onChange={(value) => updateCoordinate(axis, value)}
            />
          </Field>
        ))}
      </div>
    </fieldset>
  );
}
