import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { requestTranslator } from "@/lib/i18n-shared";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(180).optional(),
  color: z.enum(["violet", "coral", "acid", "blue"]).default("violet"),
});

export async function GET(request: Request) {
  const t = requestTranslator(request);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const collections = await prisma.collection.findMany({
    where: { ownerId: session.user.id }, orderBy: { updatedAt: "desc" },
    include: { figures: { take: 4, orderBy: { addedAt: "desc" }, include: { figure: { select: { id: true, title: true } } } }, _count: { select: { figures: true } } },
  });
  return NextResponse.json({ collections });
}

export async function POST(request: Request) {
  const t = requestTranslator(request);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t("Invalid collection.") }, { status: 400 });
  try {
    const collection = await prisma.collection.create({ data: { ...parsed.data, ownerId: session.user.id } });
    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: t("A collection with this name already exists.") }, { status: 409 });
    }
    console.error("Failed to create collection", error);
    return NextResponse.json({ error: t("Could not create the collection. Please try again.") }, { status: 500 });
  }
}
