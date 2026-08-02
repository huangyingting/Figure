import type { Locale } from "@/lib/i18n-shared";

export function formatGeneratedDate(value: string | Date, locale: Locale = "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "zh-CN" ? "无效日期" : "Invalid Date";

  return locale === "zh-CN"
    ? `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
    : `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}
