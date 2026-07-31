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

export const runtime = "nodejs";
export const maxDuration = 300;

function zodMessage(error: ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
    .join("；");
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = randomUUID();

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 64 * 1024) {
      return NextResponse.json(
        { error: "请求体超过 64 KB。", code: "REQUEST_TOO_LARGE", requestId },
        { status: 413 },
      );
    }

    const input = GenerateDiagramRequestSchema.parse(await request.json());
    const image = await generateAzureImage(input);
    const rawAnnotation = await locateDiagramParts(input, image.src);
    const annotation = normalizeVisionPayload(rawAnnotation, input);

    const result: DiagramResult = {
      id: requestId,
      image: {
        src: image.src,
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
      },
    });
  } catch (error) {
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
        error: "Azure 生成或视觉定位失败。请查看服务端日志和 requestId。",
        code: "AZURE_PIPELINE_FAILED",
        requestId,
      },
      { status: 502 },
    );
  }
}
