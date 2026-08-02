"use client";

import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";

export function FigureBrand({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link className="grid gap-[2px] text-ink no-underline" href="/">
      <span className="wordmark text-[27px]">figure</span>
      {!compact && <small className="text-micro font-semibold tracking-[0.02em] text-muted">{t("Learn what you can see.")}</small>}
    </Link>
  );
}
