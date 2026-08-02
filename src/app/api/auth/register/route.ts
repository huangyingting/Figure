import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { grantSignupBonus } from "@/lib/credits";
import { requestTranslator } from "@/lib/i18n-shared";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const t = requestTranslator(request);
  const limit = rateLimit(`register:${clientIp(request)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: t("Too many registration attempts. Please try again later.") },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: t("Invalid registration.") }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: t("An account already exists for this email.") }, { status: 409 });

  const passwordHash = await hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash },
    select: { id: true },
  });
  await grantSignupBonus(user.id);
  return NextResponse.json({ ok: true }, { status: 201 });
}
