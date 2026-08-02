import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { requestTranslator } from "@/lib/i18n-shared";
import { prisma } from "@/lib/prisma";

async function assertVisible(figureId: string, userId: string) {
  return prisma.figure.findFirst({ where: { id: figureId, OR: [{ isPublic: true }, { ownerId: userId }] }, select: { id: true } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { id } = await context.params;
  const figure = await assertVisible(id, session.user.id);
  if (!figure) return NextResponse.json({ error: t("Figure not found.") }, { status: 404 });
  await prisma.favorite.upsert({
    where: { userId_figureId: { userId: session.user.id, figureId: id } },
    create: { userId: session.user.id, figureId: id },
    update: {},
  });
  return NextResponse.json({ favorited: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { id } = await context.params;
  await prisma.favorite.deleteMany({ where: { userId: session.user.id, figureId: id } });
  return NextResponse.json({ favorited: false });
}
