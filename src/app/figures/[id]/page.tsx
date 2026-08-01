import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { FigureDetail } from "@/components/figure-detail";
import { ProductShell } from "@/components/product-shell";
import { Page } from "@/components/ui";
import { parseStoredAnnotation } from "@/lib/annotations";
import type { DiagramResult } from "@/lib/contracts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  const figure = await prisma.figure.findUnique({ where: { id }, select: { title: true, summary: true, isPublic: true, ownerId: true, imageWidth: true, imageHeight: true } });
  // Metadata must honour the same visibility rule as the page, or private titles leak through the 404.
  if (!figure || (!figure.isPublic && figure.ownerId !== session?.user?.id)) return { title: "Figure not found" };
  // Only public figures get a crawlable preview image; the image route rejects unauthenticated private reads.
  const images = figure.isPublic
    ? [{ url: `/api/figures/${id}/image`, width: figure.imageWidth, height: figure.imageHeight, alt: figure.title }]
    : undefined;
  return {
    title: figure.title,
    description: figure.summary,
    openGraph: { title: figure.title, description: figure.summary, type: "article", images },
    twitter: { card: "summary_large_image", title: figure.title, description: figure.summary, images },
  };
}

export default async function FigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const session = await auth(); const figure = await prisma.figure.findUnique({ where: { id } });
  if (!figure || (!figure.isPublic && figure.ownerId !== session?.user?.id)) notFound();
  if (figure.isPublic && figure.ownerId !== session?.user?.id) {
    await prisma.figure.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  }
  const collections = session?.user?.id ? await prisma.collection.findMany({ where: { ownerId: session.user.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const favorited = session?.user?.id ? Boolean(await prisma.favorite.findUnique({ where: { userId_figureId: { userId: session.user.id, figureId: id } }, select: { figureId: true } })) : false;
  const result: DiagramResult = { id: figure.id, image: { src: `/api/figures/${figure.id}/image`, mimeType: figure.imageMimeType, width: figure.imageWidth, height: figure.imageHeight, revisedPrompt: null }, annotation: parseStoredAnnotation(figure.annotationJson), provenance: { source: figure.id.startsWith("offline-demo") ? "offline-demo" : "azure-generated", imageModel: figure.imageModel, visionModel: figure.visionModel, generatedAt: figure.createdAt.toISOString(), reviewRequired: true } };
  const owner = figure.ownerId === session?.user?.id;
  return <ProductShell active={owner ? "/library" : "/discover"}><Page><FigureDetail result={result} owner={owner} isPublic={figure.isPublic} collections={collections} favorited={favorited} signedIn={Boolean(session?.user?.id)} /></Page></ProductShell>;
}
