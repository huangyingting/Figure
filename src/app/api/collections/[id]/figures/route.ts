import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { requestTranslator } from "@/lib/i18n-shared";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ figureId: z.string().min(1) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t("Invalid figure.") }, { status: 400 });
  const [collection, figure] = await Promise.all([
    prisma.collection.findFirst({ where: { id, ownerId: session.user.id }, select: { id: true } }),
    prisma.figure.findFirst({ where: { id: parsed.data.figureId, OR: [{ isPublic: true }, { ownerId: session.user.id }] }, select: { id: true } }),
  ]);
  if (!collection || !figure) return NextResponse.json({ error: t("Collection or figure not found.") }, { status: 404 });
  await prisma.collectionFigure.upsert({
    where: { collectionId_figureId: { collectionId: id, figureId: figure.id } },
    create: { collectionId: id, figureId: figure.id }, update: { addedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t("Invalid figure.") }, { status: 400 });
  const collection = await prisma.collection.findFirst({ where: { id, ownerId: session.user.id }, select: { id: true } });
  if (!collection) return NextResponse.json({ error: t("Collection not found.") }, { status: 404 });
  await prisma.collectionFigure.deleteMany({ where: { collectionId: id, figureId: parsed.data.figureId } });
  return NextResponse.json({ ok: true });
}
