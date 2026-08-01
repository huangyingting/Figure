import { ArrowLeft, FolderHeart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { CollectionFigureCard } from "@/components/collection-figure-card";
import { DeleteCollectionButton } from "@/components/delete-collection-button";
import { EditCollectionButton } from "@/components/edit-collection-button";
import { ProductShell } from "@/components/product-shell";
import { Button, EmptyState, Page, PageHeader } from "@/components/ui";
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
  return <ProductShell active="/collections"><Page>
    <Link className="mb-[14px] inline-flex items-center gap-[7px] text-meta font-bold text-muted no-underline hover:text-pine-dark" href="/collections"><ArrowLeft size={15} />All collections</Link>
    <PageHeader
      eyebrow={<><FolderHeart size={14} /> COLLECTION</>}
      title={collection.name}
      lead={collection.description || "A space for connected visual ideas."}
      actions={<>
        <Button asChild><Link href="/discover">Add more figures</Link></Button>
        <EditCollectionButton collectionId={collection.id} name={collection.name} description={collection.description} color={collection.color} />
        <DeleteCollectionButton collectionId={collection.id} collectionName={collection.name} />
      </>}
    />
    {collection.figures.length
      ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{collection.figures.map(({ figure }, index) => <CollectionFigureCard key={figure.id} figure={figure} collectionId={collection.id} tone={["pine", "blue", "coral", "marigold"][index % 4]} />)}</div>
      : <EmptyState large icon="✦" title="This collection is empty." description="Open any figure and use “Add to collection” to gather it here." action={<Button asChild size="lg"><Link href="/discover">Browse figures</Link></Button>} />}
  </Page></ProductShell>;
}
