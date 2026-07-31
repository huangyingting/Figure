import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FigureCard } from "@/components/figure-card";
import { ProductShell } from "@/components/product-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Favorites" };
export const dynamic = "force-dynamic";

const figureSelect = { id: true, title: true, subject: true, summary: true, imageModel: true, viewCount: true, createdAt: true, ownerId: true, owner: { select: { name: true, image: true } }, _count: { select: { collections: true, quizAttempts: true } } } as const;

export default async function FavoritesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/favorites");
  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 120,
    include: { figure: { select: figureSelect } },
  });
  // A figure may have gone private after being favorited by another user; hide those.
  const visible = favorites.filter(({ figure }) => figure).map(({ figure }) => figure);
  return <ProductShell active="/favorites"><main className="fx-page">
    <header className="fx-title-row"><div><p><Heart size={14} /> SAVED</p><h1>Favorites</h1><span>Figures you’ve bookmarked for quick access.</span></div><Link href="/discover">Find more</Link></header>
    {visible.length
      ? <div className="figure-grid">{visible.map((figure, index) => <FigureCard key={figure.id} figure={figure} tone={["violet", "blue", "coral", "acid"][index % 4]} />)}</div>
      : <div className="empty-state large"><span>♥</span><h2>No favorites yet.</h2><p>Tap the heart on any figure to save it here.</p><Link href="/discover">Browse figures</Link></div>}
  </main></ProductShell>;
}
