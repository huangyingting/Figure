import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { AdmissionError, registerAccount, registrationSchema } from "@/lib/account-admission";
import { BodyTooLargeError, readJson } from "@/lib/http";
import { requestTranslator } from "@/lib/i18n-shared";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const t = requestTranslator(request);
  const limit = rateLimit(`register:${clientIp(request)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: t("Too many registration attempts. Please try again later.") },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const parsed = registrationSchema.safeParse(await readJson(request, 8192));
    if (!parsed.success) return NextResponse.json({ error: t("Invalid registration.") }, { status: 400 });
    await registerAccount(parsed.data);
  } catch (error) {
    if (error instanceof AdmissionError) {
      return NextResponse.json({ error: t(error.message) }, { status: error.status });
    }
    if (error instanceof BodyTooLargeError || error instanceof SyntaxError) {
      return NextResponse.json({ error: t("Invalid registration.") }, { status: error instanceof BodyTooLargeError ? 413 : 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: t("An account already exists for this email.") }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
