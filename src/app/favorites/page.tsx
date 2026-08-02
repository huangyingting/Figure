import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FigureCard } from "@/components/figure-card";
import { ProductShell } from "@/components/product-shell";
import { Button, EmptyState, Page, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())("Favorites") };
}
export const dynamic = "force-dynamic";

const figureSelect = { id: true, title: true, subject: true, summary: true, imageModel: true, viewCount: true, createdAt: true, ownerId: true, owner: { select: { name: true, image: true } }, _count: { select: { collections: true, quizAttempts: true } } } as const;

export default async function FavoritesPage() {
  const [session, t] = await Promise.all([auth(), getTranslator()]);
  if (!session?.user?.id) redirect("/signin?callbackUrl=/favorites");
  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 120,
    include: { figure: { select: figureSelect } },
  });
  // A figure may have gone private after being favorited by another user; hide those.
  const visible = favorites.filter(({ figure }) => figure).map(({ figure }) => figure);
  return <ProductShell><Page>
    <PageHeader
      eyebrow={<><Heart size={14} /> {t("SAVED")}</>}
      title={t("Favorites")}
      lead={t("Figures you’ve bookmarked for quick access.")}
      actions={<Button asChild><Link href="/discover">{t("Find more")}</Link></Button>}
    />
    {visible.length
      ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((figure, index) => <FigureCard key={figure.id} figure={figure} tone={["pine", "blue", "coral", "marigold"][index % 4]} />)}</div>
      : <EmptyState large icon="♥" title={t("No favorites yet.")} description={t("Tap the heart on any figure to save it here.")} action={<Button asChild><Link href="/discover">{t("Browse figures")}</Link></Button>} />}
  </Page></ProductShell>;
}
