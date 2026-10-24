import { createHash, randomBytes } from "node:crypto";

import { Prisma, type AccountInvitation } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";

import { getApplicationConfig } from "@/lib/config";
import { SIGNUP_CREDIT_ENTRY } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

export const accountEmail = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
export const accountPassword = z.string().min(8).max(128)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must not exceed 72 UTF-8 bytes.");
export const registrationSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: accountEmail,
  password: accountPassword,
  token: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export class AdmissionError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "AdmissionError";
  }
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationStatus(invitation: Pick<AccountInvitation, "acceptedAt" | "revokedAt" | "expiresAt">) {
  if (invitation.acceptedAt) return "accepted";
  if (invitation.revokedAt) return "revoked";
  return invitation.expiresAt <= new Date() ? "expired" : "pending";
}

export async function requireAdministrator(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "admin") throw new AdmissionError(403, "Administrator access required.");
}

async function claimInvitation(tx: Prisma.TransactionClient, email: string, token?: string) {
  const claimed = await tx.accountInvitation.updateMany({
    where: {
      email, ...(token ? { tokenHash: hashInvitationToken(token) } : { tokenHash: { not: null } }),
      acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() },
    },
    data: { acceptedAt: new Date(), tokenHash: null },
  });
  if (claimed.count !== 1) throw new AdmissionError(403, "A valid invitation for this email is required.");
}

export async function registerAccount(input: z.infer<typeof registrationSchema>) {
  const inviteOnly = getApplicationConfig().inviteOnly;
  if (inviteOnly && !input.token) throw new AdmissionError(403, "An invitation is required to create an account.");
  const passwordHash = await hash(input.password, 12);
  return prisma.$transaction(async (tx) => {
    if (input.token) await claimInvitation(tx, input.email, input.token);
    return tx.user.create({
      data: {
        name: input.name, email: input.email, passwordHash,
        ...(input.token ? { emailVerified: new Date() } : {}),
        creditLedger: { create: SIGNUP_CREDIT_ENTRY },
      },
      select: { id: true },
    });
  });
}

export async function createSocialAccount(input: { name?: string | null; email: string; emailVerified?: Date | null; image?: string | null }) {
  const email = accountEmail.parse(input.email);
  return prisma.$transaction(async (tx) => {
    if (getApplicationConfig().inviteOnly) await claimInvitation(tx, email);
    return tx.user.create({
      data: { ...input, email, emailVerified: new Date(), creditLedger: { create: SIGNUP_CREDIT_ENTRY } },
    });
  });
}

export async function authorizeSocialAccount(provider: string, providerAccountId: string, profile: unknown) {
  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } }, select: { id: true },
  });
  if (linked) return true;
  const verified = z.object({ email: accountEmail, email_verified: z.literal(true) }).safeParse(profile);
  if (provider !== "google" || !verified.success) return false;
  const existing = await prisma.user.findUnique({ where: { email: verified.data.email }, select: { id: true } });
  if (existing || !getApplicationConfig().inviteOnly) return true;
  const invitation = await prisma.accountInvitation.findUnique({ where: { email: verified.data.email } });
  return Boolean(invitation?.tokenHash && invitationStatus(invitation) === "pending");
}

export async function issueInvitation(userId: string, email: string, replaceId?: string) {
  await requireAdministrator(userId);
  const normalized = accountEmail.parse(email);
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  const invitation = await prisma.$transaction(async (tx) => {
    const member = await tx.user.findUnique({ where: { email: normalized }, select: { id: true } });
    if (member) throw new AdmissionError(409, "An account already exists for this email.");
    const existing = await tx.accountInvitation.findUnique({ where: { email: normalized } });
    if (replaceId && (!existing || existing.id !== replaceId || existing.acceptedAt)) {
      throw new AdmissionError(409, "This invitation can no longer be replaced.");
    }
    if (!replaceId && existing && invitationStatus(existing) === "pending") {
      throw new AdmissionError(409, "An active invitation already exists for this email.");
    }
    return tx.accountInvitation.upsert({
      where: { email: normalized },
      create: { email: normalized, tokenHash, expiresAt, invitedById: userId },
      update: { tokenHash, expiresAt, invitedById: userId, revokedAt: null, acceptedAt: null, createdAt: new Date() },
      select: { id: true },
    });
  });
  return { id: invitation.id, acceptUrl: new URL(`/invite/${token}`, getApplicationConfig().siteUrl).href };
}

export async function revokeInvitation(userId: string, id: string) {
  await requireAdministrator(userId);
  const changed = await prisma.accountInvitation.updateMany({
    where: { id, acceptedAt: null, revokedAt: null },
    data: { tokenHash: null, revokedAt: new Date() },
  });
  if (changed.count !== 1) throw new AdmissionError(409, "This invitation can no longer be revoked.");
}

export async function bootstrapAdministrator(input: { email: string; name: string; password: string }) {
  const { email, name, password } = registrationSchema.omit({ token: true }).parse(input);
  const passwordHash = await hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "admin", emailVerified: new Date(), creditLedger: { create: SIGNUP_CREDIT_ENTRY } },
    update: { name, passwordHash, role: "admin", emailVerified: new Date() },
    select: { id: true },
  });
}
