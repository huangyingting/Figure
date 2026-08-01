import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { normalizeVisionPayload } from "@/lib/annotations";
import {
  AzureConfigurationError,
  generateAzureImage,
  locateDiagramParts,
} from "@/lib/azure-openai";
import {
  GenerateDiagramRequestSchema,
  type DiagramResult,
} from "@/lib/contracts";
import { auth } from "@/auth";
import { consumeGenerationCredit, refundGenerationCredit } from "@/lib/credits";
import { BodyTooLargeError, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { dataUrlToBuffer, getFigureStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

function zodMessage(error: ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
    .join("; ");
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = randomUUID();
  let chargedUserId: string | null = null;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to generate and save a figure.", code: "UNAUTHORIZED", requestId }, { status: 401 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 64 * 1024) {
      return NextResponse.json(
        { error: "The request exceeds 64 KB.", code: "REQUEST_TOO_LARGE", requestId },
        { status: 413 },
      );
    }

    const input = GenerateDiagramRequestSchema.parse(await readJson(request, 64 * 1024));
    const remainingCredits = await consumeGenerationCredit(session.user.id, requestId);
    if (remainingCredits === null) {
      return NextResponse.json({ error: "You need at least one credit to generate a figure.", code: "INSUFFICIENT_CREDITS", requestId }, { status: 402 });
    }
    chargedUserId = session.user.id;
    const image = await generateAzureImage(input);
    const rawAnnotation = await locateDiagramParts(input, image.src);
    const annotation = normalizeVisionPayload(rawAnnotation, input);

    const stored = await getFigureStorage().put(dataUrlToBuffer(image.src), image.mimeType, session.user.id);
    const annotationJson = JSON.stringify(annotation);
    const figure = await prisma.figure.create({
      data: {
        id: requestId,
        ownerId: session.user.id,
        title: annotation.title,
        subject: input.subject,
        summary: annotation.summary,
        imageKey: stored.storageKey,
        imageMimeType: image.mimeType,
        imageWidth: image.width,
        imageHeight: image.height,
        imageModel: input.imageModel,
        visionModel: process.env.AZURE_VISION_DEPLOYMENT || "gpt-5.6-terra",
        annotationJson,
        diagramType: input.diagramType,
        audience: input.audience,
        revisions: { create: { annotationJson, source: "ai-draft" } },
      },
    });

    const result: DiagramResult = {
      id: requestId,
      image: {
        src: `/api/figures/${figure.id}/image`,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        revisedPrompt: image.revisedPrompt,
      },
      annotation,
      provenance: {
        source: "azure-generated",
        imageModel: input.imageModel,
        visionModel: process.env.AZURE_VISION_DEPLOYMENT || "gpt-5.6-terra",
        generatedAt: new Date().toISOString(),
        reviewRequired: true,
      },
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        "X-Credits-Remaining": String(remainingCredits),
      },
    });
  } catch (error) {
    if (chargedUserId) await refundGenerationCredit(chargedUserId, requestId).catch(console.error);
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json(
        { error: "The request exceeds 64 KB.", code: "REQUEST_TOO_LARGE", requestId },
        { status: 413 },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: zodMessage(error),
          code: "INVALID_REQUEST",
          requestId,
        },
        { status: 400 },
      );
    }
    if (error instanceof AzureConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: "AZURE_NOT_CONFIGURED", requestId },
        { status: 503 },
      );
    }

    console.error(`[diagram:${requestId}] generation failed`, error);
    return NextResponse.json(
      {
        error: "Image generation or spatial grounding failed. Check the server log and request ID.",
        code: "AZURE_PIPELINE_FAILED",
        requestId,
      },
      { status: 502 },
    );
  }
}
