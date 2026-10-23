"use client";

import { CustomSelect } from "@/components/custom-select";
import { useI18n } from "@/components/i18n-provider";
import type { VisualStyle } from "@/lib/contracts";

export const visualStyleLabels: Record<VisualStyle, string> = {
  isometric: "Isometric",
  realistic: "Realistic",
  blueprint: "Blueprint",
};

export function VisualStyleSelect({
  value,
  onChange,
}: {
  value: VisualStyle;
  onChange: (value: VisualStyle) => void;
}) {
  const { t } = useI18n();
  return (
    <CustomSelect
      compact
      label={t("Visual style")}
      value={value}
      onChange={(style) => onChange(style as VisualStyle)}
      options={Object.entries(visualStyleLabels).map(([style, label]) => ({
        value: style,
        label: t(label),
      }))}
    />
  );
}
