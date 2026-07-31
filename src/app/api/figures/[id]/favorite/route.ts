import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function assertVisible(figureId: string, userId: string) {
  return prisma.figure.findFirst({ where: { id: figureId, OR: [{ isPublic: true }, { ownerId: userId }] }, select: { id: true } });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const figure = await assertVisible(id, session.user.id);
  if (!figure) return NextResponse.json({ error: "Figure not found." }, { status: 404 });
  await prisma.favorite.upsert({
    where: { userId_figureId: { userId: session.user.id, figureId: id } },
    create: { userId: session.user.id, figureId: id },
    update: {},
  });
  return NextResponse.json({ favorited: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  await prisma.favorite.deleteMany({ where: { userId: session.user.id, figureId: id } });
  return NextResponse.json({ favorited: false });
}
