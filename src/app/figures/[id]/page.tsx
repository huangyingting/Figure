import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { FigureDetail } from "@/components/figure-detail";
import { ProductShell } from "@/components/product-shell";
import type { DiagramAnnotation, DiagramResult } from "@/lib/contracts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const session = await auth(); const figure = await prisma.figure.findUnique({ where: { id } });
  if (!figure || (!figure.isPublic && figure.ownerId !== session?.user?.id)) notFound();
  const collections = session?.user?.id ? await prisma.collection.findMany({ where: { ownerId: session.user.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const result: DiagramResult = { id: figure.id, image: { src: `/api/figures/${figure.id}/image`, mimeType: figure.imageMimeType, width: figure.imageWidth, height: figure.imageHeight, revisedPrompt: null }, annotation: JSON.parse(figure.annotationJson) as DiagramAnnotation, provenance: { source: figure.id.startsWith("offline-demo") ? "offline-demo" : "azure-generated", imageModel: figure.imageModel, visionModel: figure.visionModel, generatedAt: figure.createdAt.toISOString(), reviewRequired: true } };
  return <ProductShell><main className="fx-page figure-detail-page"><FigureDetail result={result} owner={figure.ownerId === session?.user?.id} isPublic={figure.isPublic} collections={collections} /></main></ProductShell>;
}
