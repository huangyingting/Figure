import { prisma } from "@/lib/prisma";

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
  await prisma.$transaction(async (tx) => {
    const previous = await tx.creditLedger.findFirst({ where: { userId, referenceId, reason: "figure_generation_refund" } });
    if (previous) return;
    const charge = await tx.creditLedger.findFirst({ where: { userId, referenceId, reason: "figure_generation" } });
    if (!charge) throw new Error("Cannot refund a generation without a matching charge.");
    const user = await tx.user.update({ where: { id: userId }, data: { credits: { increment: GENERATION_CREDIT_COST } }, select: { credits: true } });
    await tx.creditLedger.create({
      data: { userId, amount: GENERATION_CREDIT_COST, balance: user.credits, reason: "figure_generation_refund", referenceId },
    });
  });
}
