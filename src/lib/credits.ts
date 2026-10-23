import { prisma } from "@/lib/prisma";

type RecoveryOptions = { before: Date; dryRun: boolean };

export const GENERATION_CREDIT_COST = 1;
export const SIGNUP_CREDITS = 12;
export const SIGNUP_CREDIT_ENTRY = {
  amount: SIGNUP_CREDITS,
  balance: SIGNUP_CREDITS,
  reason: "signup_bonus",
  referenceId: "signup",
};

export async function consumeGenerationCredit(userId: string, referenceId: string) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.creditLedger.findFirst({ where: { userId, referenceId, reason: "figure_generation" } });
    if (previous) {
      const refund = await tx.creditLedger.findFirst({ where: { userId, referenceId, reason: "figure_generation_refund" } });
      if (refund) throw new Error("A refunded generation reference cannot be reused.");
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { credits: true } });
      return user.credits;
    }
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
  return refundCredit(userId, referenceId);
}

export async function recoverGenerationCredit(userId: string, referenceId: string, options: RecoveryOptions) {
  if (!Number.isFinite(options.before.getTime()) || options.before.getTime() > Date.now() - 24 * 60 * 60 * 1000) {
    throw new Error("Recovery requires a cutoff at least 24 hours in the past.");
  }
  return refundCredit(userId, referenceId, options);
}

async function refundCredit(userId: string, referenceId: string, recovery?: RecoveryOptions) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.creditLedger.findFirst({ where: { userId, referenceId, reason: "figure_generation_refund" } });
    if (previous) return "already-refunded" as const;
    const charge = await tx.creditLedger.findFirst({ where: { userId, referenceId, reason: "figure_generation" } });
    if (!charge) throw new Error("Cannot refund a generation without a matching charge.");
    if (charge.amount !== -GENERATION_CREDIT_COST) throw new Error("Unexpected generation charge amount; manual reconciliation required.");
    if (recovery && charge.createdAt >= recovery.before) throw new Error("This generation charge is too recent for recovery.");
    const figure = await tx.figure.findUnique({ where: { id: referenceId }, select: { id: true } });
    if (figure) throw new Error("Cannot refund a generation with a saved figure.");
    if (recovery?.dryRun) return "eligible-for-review" as const;
    const user = await tx.user.update({ where: { id: userId }, data: { credits: { increment: GENERATION_CREDIT_COST } }, select: { credits: true } });
    await tx.creditLedger.create({
      data: { userId, amount: GENERATION_CREDIT_COST, balance: user.credits, reason: "figure_generation_refund", referenceId },
    });
    return "refunded" as const;
  });
}
