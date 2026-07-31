import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FigureCard } from "@/components/figure-card";
import { ProductShell } from "@/components/product-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const figureSelect = { id: true, title: true, subject: true, summary: true, imageModel: true, viewCount: true, createdAt: true, owner: { select: { name: true, image: true } }, _count: { select: { collections: true, quizAttempts: true } } } as const;

async function loadAuthor(id: string) {
  const author = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!author) return null;
  const figures = await prisma.figure.findMany({
    where: { ownerId: id, isPublic: true },
    orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
    take: 48,
    select: figureSelect,
  });
  return { author, figures };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const author = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  if (!author) return { title: "Author not found" };
  const name = author.name || "A Figure creator";
  return { title: `${name}'s figures`, description: `Public figures created by ${name}.` };
}

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadAuthor(id);
  if (!data) notFound();
  const { author, figures } = data;
  const displayName = author.name || "A Figure creator";
  const totalViews = figures.reduce((sum, figure) => sum + figure.viewCount, 0);
  return <ProductShell active="/discover"><main className="fx-page">
    <header className="fx-page-hero"><div><p><Sparkles size={14} /> CREATOR</p><h1>{displayName}</h1><span>{figures.length} public {figures.length === 1 ? "figure" : "figures"} · {totalViews} total {totalViews === 1 ? "view" : "views"}</span></div><Link href="/discover">Back to discover</Link></header>
    {figures.length
      ? <div className="figure-grid">{figures.map((figure, index) => <FigureCard key={figure.id} figure={figure} tone={["violet", "coral", "acid", "blue"][index % 4]} />)}</div>
      : <div className="empty-state"><span>✦</span><h2>No public figures yet</h2><p>This creator hasn’t published anything public.</p><Link href="/discover">Explore other figures</Link></div>}
  </main></ProductShell>;
}
