import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseStoredAnnotation } from "@/lib/annotations";
import { AnnotationUpdateSchema, type DiagramResult } from "@/lib/contracts";
import { prisma } from "@/lib/prisma";
import { pruneRevisions } from "@/lib/revisions";
import { getFigureStorage } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const figure = await prisma.figure.findUnique({ where: { id } });
  if (!figure || (!figure.isPublic && figure.ownerId !== session?.user?.id)) return NextResponse.json({ error: "Figure not found." }, { status: 404 });
  const result: DiagramResult = {
    id: figure.id,
    image: { src: `/api/figures/${id}/image`, mimeType: figure.imageMimeType, width: figure.imageWidth, height: figure.imageHeight, revisedPrompt: null },
    annotation: parseStoredAnnotation(figure.annotationJson),
    provenance: { source: "azure-generated", imageModel: figure.imageModel, visionModel: figure.visionModel, generatedAt: figure.createdAt.toISOString(), reviewRequired: true },
  };
  return NextResponse.json(result);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { isPublic?: unknown; title?: unknown; annotation?: unknown } | null;
  const existing = await prisma.figure.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== session.user.id) return NextResponse.json({ error: "Figure not found." }, { status: 404 });

  let annotationUpdate: { annotationJson: string; title: string; summary: string } | undefined;
  if (body?.annotation !== undefined) {
    const parsed = AnnotationUpdateSchema.safeParse(body.annotation);
    if (!parsed.success) return NextResponse.json({ error: "Invalid annotation payload." }, { status: 400 });
    annotationUpdate = {
      annotationJson: JSON.stringify(parsed.data),
      title: parsed.data.title.slice(0, 160),
      summary: parsed.data.summary.slice(0, 1000),
    };
  }

  const figure = await prisma.$transaction(async (tx) => {
    const updated = await tx.figure.update({
      where: { id },
      data: {
        ...(typeof body?.isPublic === "boolean" ? { isPublic: body.isPublic } : {}),
        ...(typeof body?.title === "string" && body.title.trim() ? { title: body.title.trim().slice(0, 160) } : {}),
        ...(annotationUpdate ?? {}),
      },
    });
    if (annotationUpdate) {
      await tx.annotationRevision.create({
        data: { figureId: id, annotationJson: annotationUpdate.annotationJson, source: "human-edit" },
      });
      await pruneRevisions(tx, id);
    }
    return updated;
  });
  return NextResponse.json({ figure });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.figure.findUnique({ where: { id }, select: { ownerId: true, imageKey: true } });
  if (!existing || existing.ownerId !== session.user.id) return NextResponse.json({ error: "Figure not found." }, { status: 404 });
  await prisma.figure.delete({ where: { id } });
  const stillReferenced = await prisma.figure.count({ where: { imageKey: existing.imageKey } });
  if (stillReferenced === 0) {
    await getFigureStorage().delete(existing.imageKey).catch((error) => console.error("Failed to delete figure image", error));
  }
  return NextResponse.json({ ok: true });
}
