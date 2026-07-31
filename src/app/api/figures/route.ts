import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  scope: z.enum(["mine", "public"]).default("public"),
  query: z.string().trim().max(100).default(""),
  take: z.coerce.number().int().min(1).max(48).default(24),
});

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid figure query." }, { status: 400 });
  if (parsed.data.scope === "mine" && !session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const figures = await prisma.figure.findMany({
    where: {
      ...(parsed.data.scope === "mine" ? { ownerId: session!.user.id } : { isPublic: true }),
      ...(parsed.data.query ? { OR: [{ title: { contains: parsed.data.query } }, { subject: { contains: parsed.data.query } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: parsed.data.take,
    select: {
      id: true, title: true, subject: true, summary: true, imageWidth: true, imageHeight: true,
      imageModel: true, isPublic: true, viewCount: true, createdAt: true,
      owner: { select: { name: true, image: true } },
      _count: { select: { collections: true, quizAttempts: true } },
    },
  });
  return NextResponse.json({ figures });
}
