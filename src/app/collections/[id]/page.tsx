import { ArrowLeft, FolderHeart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { CollectionFigureCard } from "@/components/collection-figure-card";
import { DeleteCollectionButton } from "@/components/delete-collection-button";
import { ProductShell } from "@/components/product-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const figureSelect = { id: true, title: true, subject: true, summary: true, imageModel: true, viewCount: true, createdAt: true, owner: { select: { name: true, image: true } }, _count: { select: { collections: true, quizAttempts: true } } } as const;

async function loadCollection(id: string, ownerId: string) {
  return prisma.collection.findFirst({
    where: { id, ownerId },
    include: { figures: { orderBy: { addedAt: "desc" }, include: { figure: { select: figureSelect } } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.id) return { title: "Collection" };
  const { id } = await params;
  const collection = await prisma.collection.findFirst({ where: { id, ownerId: session.user.id }, select: { name: true } });
  return { title: collection?.name ?? "Collection not found" };
}

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/collections/${id}`);
  const collection = await loadCollection(id, session.user.id);
  if (!collection) notFound();
  return <ProductShell active="/collections"><main className="fx-page">
    <Link className="fx-back-link" href="/collections"><ArrowLeft size={15} />All collections</Link>
    <header className="fx-title-row"><div><p><FolderHeart size={14} /> COLLECTION</p><h1>{collection.name}</h1><span>{collection.description || "A space for connected visual ideas."}</span></div><div className="fx-collection-actions"><Link href="/discover">Add more figures</Link><DeleteCollectionButton collectionId={collection.id} collectionName={collection.name} /></div></header>
    {collection.figures.length
      ? <div className="figure-grid">{collection.figures.map(({ figure }, index) => <CollectionFigureCard key={figure.id} figure={figure} collectionId={collection.id} tone={["violet", "blue", "coral", "acid"][index % 4]} />)}</div>
      : <div className="empty-state large"><span>✦</span><h2>This collection is empty.</h2><p>Open any figure and use “Add to collection” to gather it here.</p><Link href="/discover">Browse figures</Link></div>}
  </main></ProductShell>;
}
