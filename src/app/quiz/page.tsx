import { BookOpenCheck, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { ProductShell } from "@/components/product-shell";
import { QuizFigureBrowser } from "@/components/quiz-figure-browser";
import { QuizRunner } from "@/components/quiz-runner";
import { Button, EmptyState, Page, PageHeader } from "@/components/ui";
import { parseStoredAnnotation } from "@/lib/annotations";
import { localizedDemoResult, localizeDemoFigure } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import {
  browseQuizFigures,
  getQuizFigure,
  quizFigureHref,
} from "@/lib/quiz-figure-browser";
import { computePartAccuracy, weakestParts } from "@/lib/quiz-insights";
import { getLocale, getTranslator } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())("Quiz lab") };
}
export const dynamic = "force-dynamic";

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{
    figure?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const [session, params, locale, t] = await Promise.all([auth(), searchParams, getLocale(), getTranslator()]);
  const demoResult = localizedDemoResult(locale);
  const requested = Array.isArray(params.figure)
    ? params.figure[0]
    : params.figure;
  const viewerId = session?.user?.id ?? null;
  const browser = await browseQuizFigures(viewerId, params);

  if (!viewerId) {
    // Guests can quiz themselves on any public figure (or the sample), but
    // nothing persists until they sign in.
    const requestedFigure = requested
      ? await getQuizFigure(null, requested)
      : null;
    const quiz = requestedFigure
      ? requestedFigure.id === demoResult.id
        ? { figureId: requestedFigure.id, title: demoResult.annotation.title, parts: demoResult.annotation.parts, imageSrc: undefined }
        : { figureId: requestedFigure.id, title: requestedFigure.title, parts: parseStoredAnnotation(requestedFigure.annotationJson).parts, imageSrc: undefined }
      : { figureId: demoResult.id, title: demoResult.annotation.title, parts: demoResult.annotation.parts, imageSrc: demoResult.image.src };
    const demoMatches = `${demoResult.annotation.title} Inside a centrifugal pump`
      .toLowerCase()
      .includes(browser.query.toLowerCase());
    if (
      browser.page === 1 &&
      demoMatches &&
      !browser.figures.some((figure) => figure.id === demoResult.id)
    ) {
      browser.figures = [
        {
          id: demoResult.id,
          title: demoResult.annotation.title,
          subject: locale === "zh-CN" ? "离心泵内部结构" : "Inside a centrifugal pump",
          createdAt: new Date(demoResult.provenance.generatedAt),
          ownerId: null,
          isPublic: true,
          quizAttempts: 0,
          imageSrc: demoResult.image.src,
        },
        ...browser.figures,
      ].slice(0, 8);
    }
    return <ProductShell><Page>
      <PageHeader
        eyebrow={<><BookOpenCheck size={14} /> {t("ACTIVE RECALL")}</>}
        title={t("Quiz lab")}
        lead={t("Try a visual recall quiz. Guest attempts aren’t saved.")}
        actions={<Button asChild variant="outline"><Link href="/signin?callbackUrl=/quiz">{t("Sign in to track mastery")}</Link></Button>}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <QuizFigureBrowser browser={browser} selectedFigureId={quiz.figureId} viewerId={null} />
        <div className="min-w-0">
          <QuizRunner key={quiz.figureId} figureId={quiz.figureId} title={quiz.title} parts={quiz.parts} imageSrc={quiz.imageSrc} persist={false} />
        </div>
      </div>
    </Page></ProductShell>;
  }

  let selected = await getQuizFigure(viewerId, requested);
  if (!selected && requested) selected = await getQuizFigure(viewerId);
  const selectedDisplay = selected ? localizeDemoFigure(selected, locale) : null;
  const selectedParts = selected
    ? selected.id === demoResult.id
      ? demoResult.annotation.parts
      : parseStoredAnnotation(selected.annotationJson).parts
    : [];
  // Per-part accuracy comes from the normalized QuizAnswer rows, so "which
  // components do I keep missing" is a single grouped query.
  const answerRows = selected
    ? await prisma.quizAnswer.groupBy({
        by: ["partId", "correct"],
        where: { userId: viewerId, figureId: selected.id },
        _count: { _all: true },
      })
    : [];
  const weakSpots = weakestParts(
    computePartAccuracy(
      answerRows.map((row) => ({ partId: row.partId, correct: row.correct, count: row._count._all })),
      selectedParts.map((part) => ({ id: part.id, name: part.name })),
    ),
  );
  const attempts = await prisma.quizAttempt.findMany({ where: { userId: viewerId }, orderBy: { completedAt: "desc" }, take: 5, include: { figure: { select: { title: true } } } });
  const masteryGroups = await prisma.quizAttempt.groupBy({
    by: ["figureId"],
    where: { userId: viewerId },
    _max: { score: true },
    _count: { _all: true },
    _sum: { score: true, total: true },
  });
  const masteryFigures = masteryGroups.length
    ? await prisma.figure.findMany({ where: { id: { in: masteryGroups.map((group) => group.figureId) } }, select: { id: true, title: true } })
    : [];
  const masteryTitles = new Map(masteryFigures.map((figure) => [figure.id, figure.title]));
  const mastery = masteryGroups
    .map((group) => {
      const totalPoints = group._sum.total ?? 0;
      return {
        figureId: group.figureId,
        title: masteryTitles.get(group.figureId) ?? t("Untitled figure"),
        attempts: group._count._all,
        bestScore: group._max.score ?? 0,
        averagePct: totalPoints > 0 ? Math.round(((group._sum.score ?? 0) / totalPoints) * 100) : 0,
      };
    })
    .filter((item) => masteryTitles.has(item.figureId))
    .sort((a, b) => b.averagePct - a.averagePct);
  return <ProductShell><Page>
    <PageHeader
      eyebrow={<><BookOpenCheck size={14} /> {t("ACTIVE RECALL")}</>}
      title={t("Quiz lab")}
      lead={t("Test what you noticed. Remember what matters.")}
      actions={attempts.length > 0 && (
        <div className="flex items-center gap-[10px] rounded-[10px] border border-[#eddcae] bg-[#fff3d1] px-[14px] py-[10px]">
          <Trophy size={18} className="text-[#a97b14]" />
          <span className="grid text-micro text-muted"><strong className="font-display text-[17px] text-ink">{Math.round(attempts.reduce((sum, item) => sum + item.score / item.total, 0) / attempts.length * 100)}%</strong> {t("recent mastery")}</span>
        </div>
      )}
    />
    <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <QuizFigureBrowser browser={browser} selectedFigureId={selected?.id ?? null} viewerId={viewerId} />
      <div className="min-w-0">
        {selectedDisplay ? <QuizRunner key={selectedDisplay.id} figureId={selectedDisplay.id} title={selectedDisplay.title} parts={selectedParts} /> : <EmptyState large icon="?" title={t("Create a figure before taking a quiz.")} description={t("Every annotated component becomes a visual recall question.")} action={<Button asChild><Link href="/studio">{t("Create your first figure")}</Link></Button>} />}
      </div>
    </div>
    {weakSpots.length > 0 && <section className="mt-[34px]">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="m-0 font-display text-[22px] tracking-[-0.015em]">{t("Components to revisit")}</h2>
        <span className="text-micro text-muted">{t("Your accuracy on this figure, weakest first")}</span>
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">{weakSpots.map((spot) => (
        <div key={spot.partId} className="grid gap-2 rounded-2xl border border-line bg-paper p-[16px]">
          <div className="flex items-baseline justify-between gap-[10px]">
            <strong className="overflow-hidden overflow-ellipsis whitespace-nowrap text-ui text-ink">{spot.name}</strong>
            <b className="font-display text-[17px] text-amber">{spot.accuracyPct}%</b>
          </div>
          <div className="h-[5px] overflow-hidden rounded-full bg-[#eae4d2]"><i className="block h-full rounded-[inherit] bg-amber" style={{ width: `${spot.accuracyPct}%` }} /></div>
          <small className="text-micro text-muted">{locale === "zh-CN" ? `${spot.attempts} 次作答中答对 ${spot.correct} 次` : `${spot.correct} of ${spot.attempts} answered correctly`}</small>
        </div>
      ))}</div>
    </section>}
    {mastery.length > 0 && <section className="mt-[34px]">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="m-0 font-display text-[22px] tracking-[-0.015em]">{t("Your mastery")}</h2>
        <span className="text-micro text-muted">{mastery.length} {t("figures practiced")}</span>
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">{mastery.map((item) => (
        <Link key={item.figureId} href={quizFigureHref({ figureId: item.figureId, query: browser.query, page: browser.page })} className="grid gap-2 rounded-[13px] border border-line-dark bg-paper p-[16px_18px] no-underline transition-[border-color,box-shadow] hover:border-pine hover:shadow-[0_10px_30px_rgb(35_33_27_/_7%)]">
          <div className="flex items-center justify-between gap-[10px]">
            <strong className="overflow-hidden overflow-ellipsis whitespace-nowrap text-meta text-ink">{item.title}</strong>
            <b className="font-display text-[16px] text-pine-dark">{item.averagePct}%</b>
          </div>
          <div className="h-[6px] overflow-hidden rounded-full bg-[#ecebe6]"><i className="block h-full bg-[linear-gradient(90deg,var(--color-pine),var(--color-marigold))]" style={{ width: `${item.averagePct}%` }} /></div>
          <small className="text-[11px] text-muted">{t("Best")} {item.bestScore} · {item.attempts} {t(item.attempts === 1 ? "attempt" : "attempts")}</small>
        </Link>
      ))}</div>
    </section>}
  </Page></ProductShell>;
}
