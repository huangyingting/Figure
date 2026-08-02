import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { requestTranslator } from "@/lib/i18n-shared";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(180).nullish(),
  color: z.enum(["violet", "coral", "acid", "blue"]).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t("Invalid collection.") }, { status: 400 });

  const existing = await prisma.collection.findFirst({ where: { id, ownerId: session.user.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: t("Collection not found.") }, { status: 404 });

  const data = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? null } : {}),
    ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
  };
  try {
    const collection = await prisma.collection.update({ where: { id }, data });
    return NextResponse.json({ collection });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: t("A collection with this name already exists.") }, { status: 409 });
    }
    console.error("Failed to update collection", error);
    return NextResponse.json({ error: t("Could not update the collection. Please try again.") }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { id } = await context.params;
  const { count } = await prisma.collection.deleteMany({ where: { id, ownerId: session.user.id } });
  if (count === 0) return NextResponse.json({ error: t("Collection not found.") }, { status: 404 });
  return NextResponse.json({ ok: true });
}
