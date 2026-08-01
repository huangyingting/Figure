"use client";

import { createContext, useContext, useMemo } from "react";

import {
  createTranslator,
  type Locale,
} from "@/lib/i18n-shared";

interface I18nValue {
  locale: Locale;
  t: (message: string) => string;
}

const defaultValue: I18nValue = {
  locale: "en",
  t: createTranslator("en"),
};

const I18nContext = createContext<I18nValue>(defaultValue);

export function I18nProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
