import "server-only";

import { cookies, headers } from "next/headers";

import {
  createTranslator,
  LOCALE_COOKIE,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n-shared";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE)?.value;
  if (saved) return normalizeLocale(saved);

  const headerStore = await headers();
  return normalizeLocale(headerStore.get("accept-language"));
}

export async function getTranslator() {
  return createTranslator(await getLocale());
}
