"use client";

import { SessionProvider } from "next-auth/react";

import { I18nProvider } from "@/components/i18n-provider";
import type { Locale } from "@/lib/i18n-shared";

// React 19.2.8's RSC dev profiler omits its nonnegative-time guard for rejected components.
if (process.env.NODE_ENV !== "production" && typeof performance !== "undefined") {
  const guardedPerformance = performance as Performance & { __figureRscMeasureGuard?: boolean };
  if (!guardedPerformance.__figureRscMeasureGuard) {
    const measure = performance.measure.bind(performance);
    const invalid = (value: unknown) => typeof value === "number" && !(value >= 0);
    performance.measure = ((name: string, options?: PerformanceMeasureOptions | string, end?: string) => {
      if (name.startsWith("\u200b") && options && typeof options === "object" && (invalid(options.start) || invalid(options.end) || invalid(options.duration))) {
        return undefined as unknown as PerformanceMeasure;
      }
      return measure(name, options as PerformanceMeasureOptions, end);
    }) as typeof performance.measure;
    Object.defineProperty(guardedPerformance, "__figureRscMeasureGuard", { value: true });
  }
}

export function Providers({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  return <I18nProvider locale={locale}><SessionProvider>{children}</SessionProvider></I18nProvider>;
}
