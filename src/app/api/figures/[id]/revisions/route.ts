import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { AnnotationUpdateSchema } from "@/lib/contracts";
import { requestTranslator } from "@/lib/i18n-shared";
import { prisma } from "@/lib/prisma";
import { pruneRevisions, REVISION_HISTORY_LIMIT } from "@/lib/revisions";

async function ownedFigure(id: string, userId: string) {
  const figure = await prisma.figure.findUnique({ where: { id }, select: { ownerId: true } });
  return figure && figure.ownerId === userId ? figure : null;
}

/** Owner-only: list this figure's annotation history, newest first. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  if (!(await ownedFigure(id, session.user.id))) return NextResponse.json({ error: t("Figure not found.") }, { status: 404 });
  const revisions = await prisma.annotationRevision.findMany({
    where: { figureId: id },
    orderBy: { createdAt: "desc" },
    take: REVISION_HISTORY_LIMIT,
    select: { id: true, source: true, createdAt: true },
  });
  return NextResponse.json({ revisions });
}

const restoreSchema = z.object({ revisionId: z.string().min(1) });

/** Owner-only: restore a past revision. The restore itself becomes a new revision. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  if (!(await ownedFigure(id, session.user.id))) return NextResponse.json({ error: t("Figure not found.") }, { status: 404 });
  const parsed = restoreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t("Invalid restore request.") }, { status: 400 });

  const revision = await prisma.annotationRevision.findFirst({
    where: { id: parsed.data.revisionId, figureId: id },
    select: { annotationJson: true },
  });
  if (!revision) return NextResponse.json({ error: t("Revision not found.") }, { status: 404 });
  const annotation = AnnotationUpdateSchema.safeParse(JSON.parse(revision.annotationJson));
  if (!annotation.success) return NextResponse.json({ error: t("This revision can no longer be restored.") }, { status: 409 });

  const annotationJson = JSON.stringify(annotation.data);
  const figure = await prisma.$transaction(async (tx) => {
    const updated = await tx.figure.update({
      where: { id },
      data: {
        annotationJson,
        title: annotation.data.title.slice(0, 160),
        summary: annotation.data.summary.slice(0, 1000),
      },
    });
    await tx.annotationRevision.create({ data: { figureId: id, annotationJson, source: "restore" } });
    await pruneRevisions(tx, id);
    return updated;
  });
  return NextResponse.json({ figure });
}
