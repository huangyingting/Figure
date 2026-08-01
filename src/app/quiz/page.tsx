import { BookOpenCheck, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { ProductShell } from "@/components/product-shell";
import { QuizRunner } from "@/components/quiz-runner";
import { Button, EmptyState, Page, PageHeader } from "@/components/ui";
import { parseStoredAnnotation } from "@/lib/annotations";
import { demoResult } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import { computePartAccuracy, weakestParts } from "@/lib/quiz-insights";

export const metadata: Metadata = { title: "Quiz lab" };
export const dynamic = "force-dynamic";

export default async function QuizPage({ searchParams }: { searchParams: Promise<{ figure?: string }> }) {
  const session = await auth();
  const { figure: requested } = await searchParams;

  if (!session?.user?.id) {
    // Guests can quiz themselves on any public figure (or the sample), but
    // nothing persists until they sign in.
    const requestedFigure = requested
      ? await prisma.figure.findFirst({ where: { id: requested, isPublic: true }, select: { id: true, title: true, annotationJson: true } })
      : null;
    const quiz = requestedFigure
      ? { figureId: requestedFigure.id, title: requestedFigure.title, parts: parseStoredAnnotation(requestedFigure.annotationJson).parts, imageSrc: undefined }
      : { figureId: demoResult.id, title: demoResult.annotation.title, parts: demoResult.annotation.parts, imageSrc: demoResult.image.src };
    return <ProductShell><Page>
      <PageHeader
        eyebrow={<><BookOpenCheck size={14} /> ACTIVE RECALL</>}
        title="Quiz lab"
        lead="Try a visual recall quiz. Guest attempts aren’t saved."
        actions={<Button asChild variant="outline"><Link href="/signin?callbackUrl=/quiz">Sign in to track mastery</Link></Button>}
      />
      <QuizRunner figureId={quiz.figureId} title={quiz.title} parts={quiz.parts} imageSrc={quiz.imageSrc} persist={false} />
    </Page></ProductShell>;
  }

  const figures = await prisma.figure.findMany({ where: { OR: [{ ownerId: session.user.id }, { isPublic: true }] }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, annotationJson: true } });
  const selected = figures.find((item) => item.id === requested) ?? figures[0];
  const selectedParts = selected ? parseStoredAnnotation(selected.annotationJson).parts : [];
  // Per-part accuracy comes from the normalized QuizAnswer rows, so "which
  // components do I keep missing" is a single grouped query.
  const answerRows = selected
    ? await prisma.quizAnswer.groupBy({
        by: ["partId", "correct"],
        where: { userId: session.user.id, figureId: selected.id },
        _count: { _all: true },
      })
    : [];
  const weakSpots = weakestParts(
    computePartAccuracy(
      answerRows.map((row) => ({ partId: row.partId, correct: row.correct, count: row._count._all })),
      selectedParts.map((part) => ({ id: part.id, name: part.name })),
    ),
  );
  const attempts = await prisma.quizAttempt.findMany({ where: { userId: session.user.id }, orderBy: { completedAt: "desc" }, take: 5, include: { figure: { select: { title: true } } } });
  const masteryGroups = await prisma.quizAttempt.groupBy({
    by: ["figureId"],
    where: { userId: session.user.id },
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
        title: masteryTitles.get(group.figureId) ?? "Untitled figure",
        attempts: group._count._all,
        bestScore: group._max.score ?? 0,
        averagePct: totalPoints > 0 ? Math.round(((group._sum.score ?? 0) / totalPoints) * 100) : 0,
      };
    })
    .filter((item) => masteryTitles.has(item.figureId))
    .sort((a, b) => b.averagePct - a.averagePct);
  return <ProductShell><Page>
    <PageHeader
      eyebrow={<><BookOpenCheck size={14} /> ACTIVE RECALL</>}
      title="Quiz lab"
      lead="Test what you noticed. Remember what matters."
      actions={attempts.length > 0 && (
        <div className="flex items-center gap-[10px] rounded-[10px] border border-[#eddcae] bg-[#fff3d1] px-[14px] py-[10px]">
          <Trophy size={18} className="text-[#a97b14]" />
          <span className="grid text-micro text-muted"><strong className="font-display text-[17px] text-ink">{Math.round(attempts.reduce((sum, item) => sum + item.score / item.total, 0) / attempts.length * 100)}%</strong> recent mastery</span>
        </div>
      )}
    />
    {figures.length > 1 && <nav className="-mt-2 mb-[18px] flex gap-[7px] overflow-auto px-[1px] pb-[10px] pt-[3px]" aria-label="Choose a figure to be quizzed on">{figures.map((figure) => <Link key={figure.id} href={`/quiz?figure=${figure.id}`} data-active={figure.id === selected?.id} aria-current={figure.id === selected?.id ? "page" : undefined} className="whitespace-nowrap rounded-full border border-line bg-paper px-[13px] py-[9px] text-micro font-bold text-muted no-underline data-[active=true]:border-pine data-[active=true]:bg-pine data-[active=true]:text-white">{figure.title}</Link>)}</nav>}
    {selected ? <QuizRunner figureId={selected.id} title={selected.title} parts={selectedParts} /> : <EmptyState large icon="?" title="Create a figure before taking a quiz." description="Every annotated component becomes a visual recall question." action={<Button asChild><Link href="/studio">Create your first figure</Link></Button>} />}
    {weakSpots.length > 0 && <section className="mt-[34px]">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="m-0 font-display text-[22px] tracking-[-0.015em]">Components to revisit</h2>
        <span className="text-micro text-muted">Your accuracy on this figure, weakest first</span>
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">{weakSpots.map((spot) => (
        <div key={spot.partId} className="grid gap-2 rounded-2xl border border-line bg-paper p-[16px]">
          <div className="flex items-baseline justify-between gap-[10px]">
            <strong className="overflow-hidden overflow-ellipsis whitespace-nowrap text-ui text-ink">{spot.name}</strong>
            <b className="font-display text-[17px] text-amber">{spot.accuracyPct}%</b>
          </div>
          <div className="h-[5px] overflow-hidden rounded-full bg-[#eae4d2]"><i className="block h-full rounded-[inherit] bg-amber" style={{ width: `${spot.accuracyPct}%` }} /></div>
          <small className="text-micro text-muted">{spot.correct} of {spot.attempts} answered correctly</small>
        </div>
      ))}</div>
    </section>}
    {mastery.length > 0 && <section className="mt-[34px]">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="m-0 font-display text-[22px] tracking-[-0.015em]">Your mastery</h2>
        <span className="text-micro text-muted">{mastery.length} {mastery.length === 1 ? "figure" : "figures"} practiced</span>
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">{mastery.map((item) => (
        <Link key={item.figureId} href={`/quiz?figure=${item.figureId}`} className="grid gap-2 rounded-[13px] border border-line-dark bg-paper p-[16px_18px] no-underline transition-[border-color,box-shadow] hover:border-pine hover:shadow-[0_10px_30px_rgb(35_33_27_/_7%)]">
          <div className="flex items-center justify-between gap-[10px]">
            <strong className="overflow-hidden overflow-ellipsis whitespace-nowrap text-meta text-ink">{item.title}</strong>
            <b className="font-display text-[16px] text-pine-dark">{item.averagePct}%</b>
          </div>
          <div className="h-[6px] overflow-hidden rounded-full bg-[#ecebe6]"><i className="block h-full bg-[linear-gradient(90deg,var(--color-pine),var(--color-marigold))]" style={{ width: `${item.averagePct}%` }} /></div>
          <small className="text-[11px] text-muted">Best {item.bestScore} · {item.attempts} {item.attempts === 1 ? "attempt" : "attempts"}</small>
        </Link>
      ))}</div>
    </section>}
  </Page></ProductShell>;
}
