import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { parseStoredAnnotation } from "@/lib/annotations";
import { prisma } from "@/lib/prisma";

const attemptSchema = z.object({
  figureId: z.string().min(1),
  answers: z.array(z.object({ partId: z.string().min(1), answer: z.string().min(1) })).min(1).max(30),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = attemptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid quiz attempt." }, { status: 400 });
  const figure = await prisma.figure.findFirst({ where: { id: parsed.data.figureId, OR: [{ isPublic: true }, { ownerId: session.user.id }] }, select: { id: true, annotationJson: true } });
  if (!figure) return NextResponse.json({ error: "Figure not found." }, { status: 404 });
  const validParts = new Set(parseStoredAnnotation(figure.annotationJson).parts.map((part) => part.id));
  const answers = parsed.data.answers.map((answer) => ({ ...answer, correct: validParts.has(answer.partId) && answer.answer === answer.partId }));
  const score = answers.filter((answer) => answer.correct).length;
  const attempt = await prisma.quizAttempt.create({ data: { userId: session.user.id, figureId: figure.id, score, total: answers.length, answersJson: JSON.stringify(answers) } });
  return NextResponse.json({ attempt }, { status: 201 });
}
