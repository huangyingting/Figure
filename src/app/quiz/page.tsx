import { BookOpenCheck, Trophy } from "lucide-react";
import type { DiagramAnnotation } from "@/lib/contracts";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProductShell } from "@/components/product-shell";
import { QuizRunner } from "@/components/quiz-runner";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function QuizPage({ searchParams }: { searchParams: Promise<{ figure?: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/signin?callbackUrl=/quiz"); const { figure: requested } = await searchParams;
  const figures = await prisma.figure.findMany({ where: { OR: [{ ownerId: session.user.id }, { isPublic: true }] }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, annotationJson: true } });
  const selected = figures.find((item) => item.id === requested) ?? figures[0];
  const attempts = await prisma.quizAttempt.findMany({ where: { userId: session.user.id }, orderBy: { completedAt: "desc" }, take: 5, include: { figure: { select: { title: true } } } });
  return <ProductShell active="/quiz"><main className="fx-page quiz-page"><header className="fx-title-row"><div><p><BookOpenCheck size={14} /> ACTIVE RECALL</p><h1>Quiz lab</h1><span>Test what you noticed. Remember what matters.</span></div>{attempts.length > 0 && <div className="mastery-chip"><Trophy size={18} /><span><strong>{Math.round(attempts.reduce((sum, item) => sum + item.score / item.total, 0) / attempts.length * 100)}%</strong> recent mastery</span></div>}</header>
    {figures.length > 1 && <nav className="quiz-picker">{figures.map((figure) => <a key={figure.id} href={`/quiz?figure=${figure.id}`} data-active={figure.id === selected?.id}>{figure.title}</a>)}</nav>}
    {selected ? <QuizRunner figureId={selected.id} title={selected.title} parts={(JSON.parse(selected.annotationJson) as DiagramAnnotation).parts} /> : <div className="empty-state large"><span>?</span><h2>Create a figure before taking a quiz.</h2><p>Every annotated component becomes a visual recall question.</p><a href="/studio">Create your first figure</a></div>}
  </main></ProductShell>;
}
