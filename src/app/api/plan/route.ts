import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AzureConfigurationError, planDiagramParts } from "@/lib/azure-openai";
import { PlanDiagramRequestSchema } from "@/lib/contracts";
import { BodyTooLargeError, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

function zodMessage(error: ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
    .join("; ");
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = randomUUID();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to plan a new figure.", code: "UNAUTHORIZED", requestId }, { status: 401 });
    }
    const limit = rateLimit(`plan:${session.user.id}`, { limit: 20, windowMs: 60 * 1000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many planning requests. Please slow down and try again shortly.", code: "RATE_LIMITED", requestId },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "X-Request-Id": requestId } },
      );
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 32 * 1024) {
      return NextResponse.json(
        { error: "The request exceeds 32 KB.", code: "REQUEST_TOO_LARGE", requestId },
        { status: 413 },
      );
    }

    const input = PlanDiagramRequestSchema.parse(await readJson(request, 32 * 1024));
    const plan = await planDiagramParts(input);
    return NextResponse.json(plan, {
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json(
        { error: "The request exceeds 32 KB.", code: "REQUEST_TOO_LARGE", requestId },
        { status: 413 },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: zodMessage(error), code: "INVALID_REQUEST", requestId },
        { status: 400 },
      );
    }
    if (error instanceof AzureConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: "AZURE_NOT_CONFIGURED", requestId },
        { status: 503 },
      );
    }

    console.error(`[diagram-plan:${requestId}] planning failed`, error);
    return NextResponse.json(
      {
        error: "Component planning failed. Check the server log and request ID.",
        code: "AZURE_PLANNING_FAILED",
        requestId,
      },
      { status: 502 },
    );
  }
}
