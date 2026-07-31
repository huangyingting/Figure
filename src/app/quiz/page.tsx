import { BookOpenCheck, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { ProductShell } from "@/components/product-shell";
import { QuizRunner } from "@/components/quiz-runner";
import { parseStoredAnnotation } from "@/lib/annotations";
import { demoResult } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Quiz lab" };
export const dynamic = "force-dynamic";

export default async function QuizPage({ searchParams }: { searchParams: Promise<{ figure?: string }> }) {
  const session = await auth();
  const { figure: requested } = await searchParams;

  if (!session?.user?.id) {
    return <ProductShell active="/quiz"><main className="fx-page quiz-page"><header className="fx-title-row"><div><p><BookOpenCheck size={14} /> ACTIVE RECALL</p><h1>Quiz lab</h1><span>Test what you noticed. Remember what matters.</span></div></header>
      <p className="configuration-note signin-note" style={{ marginBottom: 20 }}><Link href="/signin?callbackUrl=/quiz">Sign in</Link> to quiz your own figures and track mastery. This is a sample quiz.</p>
      <QuizRunner figureId={demoResult.id} title={demoResult.annotation.title} parts={demoResult.annotation.parts} imageSrc={demoResult.image.src} persist={false} />
    </main></ProductShell>;
  }

  const figures = await prisma.figure.findMany({ where: { OR: [{ ownerId: session.user.id }, { isPublic: true }] }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, annotationJson: true } });
  const selected = figures.find((item) => item.id === requested) ?? figures[0];
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
  return <ProductShell active="/quiz"><main className="fx-page quiz-page"><header className="fx-title-row"><div><p><BookOpenCheck size={14} /> ACTIVE RECALL</p><h1>Quiz lab</h1><span>Test what you noticed. Remember what matters.</span></div>{attempts.length > 0 && <div className="mastery-chip"><Trophy size={18} /><span><strong>{Math.round(attempts.reduce((sum, item) => sum + item.score / item.total, 0) / attempts.length * 100)}%</strong> recent mastery</span></div>}</header>
    {figures.length > 1 && <nav className="quiz-picker" aria-label="Choose a figure to be quizzed on">{figures.map((figure) => <Link key={figure.id} href={`/quiz?figure=${figure.id}`} data-active={figure.id === selected?.id} aria-current={figure.id === selected?.id ? "page" : undefined}>{figure.title}</Link>)}</nav>}
    {selected ? <QuizRunner figureId={selected.id} title={selected.title} parts={parseStoredAnnotation(selected.annotationJson).parts} /> : <div className="empty-state large"><span>?</span><h2>Create a figure before taking a quiz.</h2><p>Every annotated component becomes a visual recall question.</p><Link href="/studio">Create your first figure</Link></div>}
    {mastery.length > 0 && <section className="mastery-board"><header><h2>Your mastery</h2><span>{mastery.length} {mastery.length === 1 ? "figure" : "figures"} practiced</span></header><div className="mastery-list">{mastery.map((item) => <Link key={item.figureId} className="mastery-row" href={`/quiz?figure=${item.figureId}`}><div className="mastery-row-head"><strong>{item.title}</strong><b>{item.averagePct}%</b></div><div className="mastery-track"><i style={{ width: `${item.averagePct}%` }} /></div><small>Best {item.bestScore} · {item.attempts} {item.attempts === 1 ? "attempt" : "attempts"}</small></Link>)}</div></section>}
  </main></ProductShell>;
}
