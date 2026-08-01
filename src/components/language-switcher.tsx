"use client";

import { Languages } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n-shared";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const next: Locale = locale === "en" ? "zh-CN" : "en";

  function changeLanguage() {
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <button
      type="button"
      className="inline-flex min-h-[38px] cursor-pointer items-center gap-[7px] rounded-full border border-line-dark bg-paper px-3 text-meta font-bold text-ink transition-colors hover:border-pine hover:text-pine-dark"
      aria-label={t("Switch language")}
      title={t("Switch language")}
      onClick={changeLanguage}
    >
      <Languages size={15} aria-hidden />
      {!compact && <span>{locale === "en" ? "简体中文" : "English"}</span>}
      {compact && <span>{locale === "en" ? "中文" : "EN"}</span>}
    </button>
  );
}
