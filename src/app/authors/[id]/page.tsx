import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FigureCard } from "@/components/figure-card";
import { ProductShell } from "@/components/product-shell";
import { Button, EmptyState, Page, PageHeader } from "@/components/ui";
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
  return <ProductShell active="/discover"><Page>
    <PageHeader
      eyebrow={<><Sparkles size={14} /> CREATOR</>}
      title={displayName}
      lead={<>{figures.length} public {figures.length === 1 ? "figure" : "figures"} · {totalViews} total {totalViews === 1 ? "view" : "views"}</>}
      actions={<Button asChild><Link href="/discover">Back to discover</Link></Button>}
    />
    {figures.length
      ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{figures.map((figure, index) => <FigureCard key={figure.id} figure={figure} tone={["violet", "coral", "acid", "blue"][index % 4]} />)}</div>
      : <EmptyState icon="✦" title="No public figures yet" description="This creator hasn’t published anything public." action={<Button asChild><Link href="/discover">Explore other figures</Link></Button>} />}
  </Page></ProductShell>;
}
