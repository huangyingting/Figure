import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseStoredAnnotation } from "@/lib/annotations";
import { requestLocale, requestTranslator } from "@/lib/i18n-shared";
import { prisma } from "@/lib/prisma";
import { getFigureStorage } from "@/lib/storage";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const t = requestTranslator(request);
  const locale = requestLocale(request);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { id } = await context.params;

  const source = await prisma.figure.findFirst({
    where: { id, OR: [{ isPublic: true }, { ownerId: session.user.id }] },
  });
  if (!source) return NextResponse.json({ error: t("Figure not found.") }, { status: 404 });

  // Re-store the bytes under the new owner so the content-addressed key (and the
  // reference-counted delete) stays correct per owner.
  const bytes = await getFigureStorage().get(source.imageKey);
  if (!bytes) return NextResponse.json({ error: t("The source image is unavailable.") }, { status: 409 });
  const stored = await getFigureStorage().put(bytes, source.imageMimeType, session.user.id);

  const annotation = parseStoredAnnotation(source.annotationJson);
  const annotationJson = JSON.stringify(annotation);
  const copy = await prisma.figure.create({
    data: {
      ownerId: session.user.id,
      title: source.ownerId === session.user.id
        ? locale === "zh-CN" ? `${source.title}（副本）` : `${source.title} (copy)`
        : source.title,
      subject: source.subject,
      summary: source.summary,
      imageKey: stored.storageKey,
      imageMimeType: source.imageMimeType,
      imageWidth: source.imageWidth,
      imageHeight: source.imageHeight,
      imageModel: source.imageModel,
      visionModel: source.visionModel,
      annotationJson,
      diagramType: source.diagramType,
      audience: source.audience,
      isPublic: false,
      revisions: { create: { annotationJson, source: "ai-draft" } },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: copy.id }, { status: 201 });
}
