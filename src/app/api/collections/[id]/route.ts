import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { count } = await prisma.collection.deleteMany({ where: { id, ownerId: session.user.id } });
  if (count === 0) return NextResponse.json({ error: "Collection not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
