"use client";

import { BookOpenCheck, Clock3, Search, X } from "lucide-react";
import Link from "next/link";

import { Button, EmptyState } from "@/components/ui";
import { formatGeneratedDate } from "@/lib/dates";
import {
  quizFigureHref,
  type QuizFigureBrowserResult,
} from "@/lib/quiz-figure-browser";
import { useI18n } from "@/components/i18n-provider";
import { localizeDemoFigure } from "@/lib/demo-data";

export function QuizFigureBrowser({
  browser,
  selectedFigureId,
  viewerId,
}: {
  browser: QuizFigureBrowserResult;
  selectedFigureId: string | null;
  viewerId: string | null;
}) {
  const { locale, t } = useI18n();
  const heading = browser.query
    ? (locale === "zh-CN" ? `“${browser.query}”的搜索结果` : `Results for “${browser.query}”`)
    : t("Recently added figures");

  return (
    <aside className="rounded-2xl border border-line-dark bg-paper p-4 shadow-card lg:sticky lg:top-4" aria-label={t("Choose a figure")}>
      <div className="mb-4">
        <p className="eyebrow m-0">{t("CHOOSE A FIGURE")}</p>
        <h2 className="mt-1 mb-1 font-display text-[23px] font-[560] tracking-[-0.015em]">{heading}</h2>
        <p className="m-0 text-meta leading-[1.5] text-muted">
          {browser.query
            ? t("Select a result to start a new visual recall quiz.")
            : t("Your newest accessible figures, ready for recall.")}
        </p>
      </div>

      <form action="/quiz" className="mb-4 grid grid-cols-[1fr_auto] gap-2" role="search">
        {selectedFigureId ? <input type="hidden" name="figure" value={selectedFigureId} /> : null}
        <label className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-[10px] border border-line bg-[#fbf7ec] px-3 focus-within:border-pine focus-within:shadow-[0_0_0_3px_rgb(28_107_82/8%)]">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            name="q"
            defaultValue={browser.query}
            maxLength={120}
            aria-label={t("Search quiz figures")}
            placeholder={t("Search title or topic")}
            className="min-w-0 flex-1 border-0 bg-transparent text-ui outline-none placeholder:text-muted-2"
          />
        </label>
        <button type="submit" className="min-h-[44px] cursor-pointer rounded-[10px] border-0 bg-ink px-3 text-meta font-bold text-white hover:bg-pine" aria-label={t("Search figures")}>
          {t("Search")}
        </button>
      </form>

      {browser.query ? (
        <Link
          href={quizFigureHref({ figureId: selectedFigureId })}
          className="mb-3 inline-flex items-center gap-1.5 text-meta font-bold text-pine-dark no-underline hover:underline"
        >
          <X size={14} /> {t("Clear search")}
        </Link>
      ) : null}

      {browser.figures.length ? (
        <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label={heading}>
          {browser.figures.map((figure) => {
            const displayFigure = localizeDemoFigure(figure, locale);
            const selected = figure.id === selectedFigureId;
            const accessLabel = viewerId && figure.ownerId === viewerId
              ? t("Your figure")
              : t("Public");
            return (
              <Link
                key={figure.id}
                href={quizFigureHref({
                  figureId: figure.id,
                  query: browser.query,
                  page: browser.page,
                })}
                aria-current={selected ? "page" : undefined}
                className={`group grid min-w-0 grid-cols-[76px_1fr] gap-3 rounded-xl border p-2 no-underline transition-[border-color,background,box-shadow] ${
                  selected
                    ? "border-pine bg-pine-pale shadow-[0_0_0_2px_rgb(28_107_82/8%)]"
                    : "border-line bg-[#fbf7ec] hover:border-pine hover:bg-paper"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={figure.imageSrc ?? `/api/figures/${figure.id}/image`}
                  alt=""
                  loading="lazy"
                  className="h-[64px] w-[76px] rounded-lg bg-canvas object-contain"
                />
                <span className="grid min-w-0 content-center gap-0.5">
                  <strong className="truncate text-ui text-ink group-hover:text-pine-dark">{displayFigure.title}</strong>
                  <span className="truncate text-micro text-muted">{displayFigure.subject}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-2">
                    <span className="inline-flex items-center gap-1"><Clock3 size={11} />{formatGeneratedDate(figure.createdAt, locale)}</span>
                    <span className="inline-flex items-center gap-1"><BookOpenCheck size={11} />{figure.quizAttempts}</span>
                    <span>{accessLabel}</span>
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      ) : (
        <EmptyState
          className="min-h-[220px] p-5"
          icon={browser.query ? "⌁" : "✦"}
          title={browser.query ? t("No matching figures") : t("No figures yet")}
          description={browser.query ? t("Try a broader title or topic.") : t("Create a figure and it will appear here.")}
          action={browser.query
            ? <Button asChild size="sm" variant="outline"><Link href={quizFigureHref({ figureId: selectedFigureId })}>{t("Show recent")}</Link></Button>
            : <Button asChild size="sm"><Link href="/studio">{t("Create a figure")}</Link></Button>}
        />
      )}

      {browser.query && (browser.hasPrevious || browser.hasNext) ? (
        <nav className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3" aria-label={t("Search result pages")}>
          {browser.hasPrevious ? (
            <Link className="text-meta font-bold text-pine-dark no-underline hover:underline" href={quizFigureHref({ figureId: selectedFigureId, query: browser.query, page: browser.page - 1 })}>← {t("Previous")}</Link>
          ) : <span />}
          <span className="text-micro font-bold text-muted">{t("Page")} {browser.page}</span>
          {browser.hasNext ? (
            <Link className="text-meta font-bold text-pine-dark no-underline hover:underline" href={quizFigureHref({ figureId: selectedFigureId, query: browser.query, page: browser.page + 1 })}>{t("Next")} →</Link>
          ) : <span />}
        </nav>
      ) : null}
    </aside>
  );
}
