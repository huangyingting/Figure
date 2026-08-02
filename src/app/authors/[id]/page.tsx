import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FigureCard } from "@/components/figure-card";
import { ProductShell } from "@/components/product-shell";
import { Button, EmptyState, Page, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getLocale, getTranslator } from "@/lib/i18n";

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
  const [{ id }, t, locale] = await Promise.all([params, getTranslator(), getLocale()]);
  const author = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  if (!author) return { title: t("Author not found") };
  const name = author.name || t("A Figure creator");
  return locale === "zh-CN"
    ? { title: `${name}的图解`, description: `${name}创建的公开图解。` }
    : { title: `${name}'s figures`, description: `Public figures created by ${name}.` };
}

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, locale] = await Promise.all([params, getTranslator(), getLocale()]);
  const data = await loadAuthor(id);
  if (!data) notFound();
  const { author, figures } = data;
  const displayName = author.name || t("A Figure creator");
  const totalViews = figures.reduce((sum, figure) => sum + figure.viewCount, 0);
  return <ProductShell><Page>
    <PageHeader
      eyebrow={<><Sparkles size={14} /> {t("CREATOR")}</>}
      title={displayName}
      lead={locale === "zh-CN" ? <>{figures.length} 张公开图解 · 共 {totalViews} 次浏览</> : <>{figures.length} public {figures.length === 1 ? "figure" : "figures"} · {totalViews} total {totalViews === 1 ? "view" : "views"}</>}
      actions={<Button asChild><Link href="/discover">{t("Back to discover")}</Link></Button>}
    />
    {figures.length
      ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{figures.map((figure, index) => <FigureCard key={figure.id} figure={figure} tone={["pine", "coral", "marigold", "blue"][index % 4]} />)}</div>
      : <EmptyState icon="✦" title={t("No public figures yet")} description={t("This creator hasn’t published anything public.")} action={<Button asChild><Link href="/discover">{t("Explore other figures")}</Link></Button>} />}
  </Page></ProductShell>;
}
