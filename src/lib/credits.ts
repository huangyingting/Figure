import { prisma } from "@/lib/prisma";

export const GENERATION_CREDIT_COST = 1;
export const SIGNUP_CREDITS = 12;

/**
 * Records the ledger entry that explains a new account's starting balance.
 * The credits themselves come from the column default on User; without this
 * row the ledger could never reconcile against the balance. Idempotent, so
 * both registration paths (credentials route, OAuth adapter event) may call it.
 */
export async function grantSignupBonus(userId: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.creditLedger.findFirst({ where: { userId, reason: "signup_bonus" } });
    if (existing) return;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { credits: true } });
    await tx.creditLedger.create({
      data: { userId, amount: SIGNUP_CREDITS, balance: user.credits, reason: "signup_bonus" },
    });
  });
}

export async function consumeGenerationCredit(userId: string, referenceId: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, credits: { gte: GENERATION_CREDIT_COST } },
      data: { credits: { decrement: GENERATION_CREDIT_COST } },
    });
    if (updated.count !== 1) return null;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { credits: true } });
    await tx.creditLedger.create({
      data: { userId, amount: -GENERATION_CREDIT_COST, balance: user.credits, reason: "figure_generation", referenceId },
    });
    return user.credits;
  });
}

export async function refundGenerationCredit(userId: string, referenceId: string) {
  await prisma.$transaction(async (tx) => {
    const previous = await tx.creditLedger.findFirst({ where: { userId, referenceId, reason: "figure_generation_refund" } });
    if (previous) return;
    const user = await tx.user.update({ where: { id: userId }, data: { credits: { increment: GENERATION_CREDIT_COST } }, select: { credits: true } });
    await tx.creditLedger.create({
      data: { userId, amount: GENERATION_CREDIT_COST, balance: user.credits, reason: "figure_generation_refund", referenceId },
    });
  });
}
