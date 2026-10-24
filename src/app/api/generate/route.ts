import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { normalizeVisionPayload } from "@/lib/annotations";
import { getAzureImageConfig, getAzureModelDeployments, UnknownImageModelError } from "@/lib/azure-config";
import {
  AzureConfigurationError,
  generateAzureImage,
  locateDiagramParts,
} from "@/lib/azure-openai";
import {
  GenerateDiagramRequestSchema,
  AnnotationUpdateSchema,
  type DiagramResult,
} from "@/lib/contracts";
import { auth } from "@/auth";
import { consumeGenerationCredit, refundGenerationCredit } from "@/lib/credits";
import { BodyTooLargeError, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { dataUrlToBuffer, getFigureStorage } from "@/lib/storage";
import { createTranslator, requestLocale } from "@/lib/i18n-shared";

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
  const t = createTranslator(requestLocale(request));
  let chargedUserId: string | null = null;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: t("Sign in to generate and save a figure."), code: "UNAUTHORIZED", requestId }, { status: 401 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 64 * 1024) {
      return NextResponse.json(
        { error: t("The request exceeds 64 KB."), code: "REQUEST_TOO_LARGE", requestId },
        { status: 413 },
      );
    }

    const input = GenerateDiagramRequestSchema.parse(await readJson(request, 64 * 1024));
    getAzureImageConfig(input.imageModel);
    const remainingCredits = await consumeGenerationCredit(session.user.id, requestId);
    if (remainingCredits === null) {
      return NextResponse.json({ error: t("You need at least one credit to generate a figure."), code: "INSUFFICIENT_CREDITS", requestId }, { status: 402 });
    }
    chargedUserId = session.user.id;
    const image = await generateAzureImage(input);
    const rawAnnotation = await locateDiagramParts(input, image.src);
    const normalized = AnnotationUpdateSchema.safeParse(normalizeVisionPayload(rawAnnotation, input));
    if (!normalized.success) throw new Error("Generated annotations failed validation.", { cause: normalized.error });
    const annotation = normalized.data;

    const stored = await getFigureStorage().put(dataUrlToBuffer(image.src), image.mimeType, session.user.id);
    const models = getAzureModelDeployments(input.imageModel);
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
        ...models,
        annotationJson,
        diagramType: input.diagramType,
        audience: input.audience,
        visualStyle: input.visualStyle,
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
        ...models,
        generatedAt: new Date().toISOString(),
        reviewRequired: true,
        visualStyle: input.visualStyle,
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
    if (chargedUserId) {
      try {
        await refundGenerationCredit(chargedUserId, requestId);
      } catch (refundError) {
        console.error(`[diagram:${requestId}] credit refund failed`, { error, refundError });
        return NextResponse.json({
          error: t("Generation failed and your credit could not be restored. Contact the administrator with this request ID."),
          code: "CREDIT_REFUND_FAILED",
          requestId,
        }, { status: 503 });
      }
    }
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json(
        { error: t("The request exceeds 64 KB."), code: "REQUEST_TOO_LARGE", requestId },
        { status: 413 },
      );
    }
    if (error instanceof SyntaxError || error instanceof ZodError || error instanceof UnknownImageModelError) {
      return NextResponse.json(
        {
          error: error instanceof ZodError ? zodMessage(error) : error instanceof UnknownImageModelError ? error.message : t("Invalid request."),
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
        error: t("Image generation or spatial grounding failed. Check the server log and request ID."),
        code: "AZURE_PIPELINE_FAILED",
        requestId,
      },
      { status: 502 },
    );
  }
}
