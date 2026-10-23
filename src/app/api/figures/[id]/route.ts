import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { AnnotationUpdateSchema, VisualStyleSchema, type DiagramResult } from "@/lib/contracts";
import { storedFigureAnnotation } from "@/lib/demo-data";
import { BodyTooLargeError, readJson } from "@/lib/http";
import { requestLocale, requestTranslator } from "@/lib/i18n-shared";
import { prisma } from "@/lib/prisma";
import { pruneRevisions } from "@/lib/revisions";
import { getFigureStorage } from "@/lib/storage";

const figureUpdateSchema = z.object({
  isPublic: z.boolean().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  annotation: AnnotationUpdateSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const { id } = await context.params;
  const session = await auth();
  const figure = await prisma.figure.findUnique({ where: { id } });
  if (!figure || (!figure.isPublic && figure.ownerId !== session?.user?.id)) return NextResponse.json({ error: t("Figure not found.") }, { status: 404 });
  const result: DiagramResult = {
    id: figure.id,
    image: { src: `/api/figures/${id}/image`, mimeType: figure.imageMimeType, width: figure.imageWidth, height: figure.imageHeight, revisedPrompt: null },
    annotation: storedFigureAnnotation(figure.id, figure.annotationJson, requestLocale(request)),
    provenance: { source: "azure-generated", imageModel: figure.imageModel, visionModel: figure.visionModel, generatedAt: figure.createdAt.toISOString(), reviewRequired: true, visualStyle: VisualStyleSchema.parse(figure.visualStyle) },
  };
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const existing = await prisma.figure.findUnique({ where: { id }, select: { ownerId: true, annotationJson: true } });
  if (!existing || existing.ownerId !== session.user.id) return NextResponse.json({ error: t("Figure not found.") }, { status: 404 });
  let raw: unknown;
  try {
    raw = await readJson(request, 64 * 1024);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return NextResponse.json({ error: t("The request exceeds 64 KB.") }, { status: 413 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: t("Invalid annotation payload.") }, { status: 400 });
    throw error;
  }
  const parsed = figureUpdateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: t("Invalid annotation payload.") }, { status: 400 });
  const body = parsed.data;

  let annotationUpdate: { annotationJson: string; title: string; summary: string } | undefined;
  let annotation = body.annotation;
  if (!annotation && body.title !== undefined) {
    annotation = storedFigureAnnotation(id, existing.annotationJson, "en");
    if (!AnnotationUpdateSchema.safeParse(annotation).success) {
      return NextResponse.json({ error: t("Invalid annotation payload.") }, { status: 409 });
    }
  }
  if (annotation) {
    annotation = { ...annotation, ...(body.title === undefined ? {} : { title: body.title }) };
    annotationUpdate = {
      annotationJson: JSON.stringify(annotation),
      title: annotation.title,
      summary: annotation.summary,
    };
  }

  const figure = await prisma.$transaction(async (tx) => {
    const updated = await tx.figure.update({
      where: { id },
      data: {
        ...(body.isPublic === undefined ? {} : { isPublic: body.isPublic }),
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

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const existing = await prisma.figure.findUnique({ where: { id }, select: { ownerId: true, imageKey: true } });
  if (!existing || existing.ownerId !== session.user.id) return NextResponse.json({ error: t("Figure not found.") }, { status: 404 });
  await prisma.figure.delete({ where: { id } });
  const stillReferenced = await prisma.figure.count({ where: { imageKey: existing.imageKey } });
  if (stillReferenced === 0) {
    await getFigureStorage().delete(existing.imageKey).catch((error) => console.error("Failed to delete figure image", error));
  }
  return NextResponse.json({ ok: true });
}
