import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  user: {
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  creditLedger: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
  },
}));

import { consumeGenerationCredit, grantSignupBonus, refundGenerationCredit } from "@/lib/credits";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("consumeGenerationCredit", () => {
  it("decrements atomically and records a negative ledger entry", async () => {
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findUniqueOrThrow.mockResolvedValue({ credits: 11 });
    tx.creditLedger.create.mockResolvedValue({});

    const remaining = await consumeGenerationCredit("user-1", "req-1");

    expect(remaining).toBe(11);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
    expect(tx.creditLedger.create).toHaveBeenCalledWith({
      data: { userId: "user-1", amount: -1, balance: 11, reason: "figure_generation", referenceId: "req-1" },
    });
  });

  it("returns null and writes no ledger entry when credits are insufficient", async () => {
    tx.user.updateMany.mockResolvedValue({ count: 0 });

    const remaining = await consumeGenerationCredit("user-1", "req-1");

    expect(remaining).toBeNull();
    expect(tx.user.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.creditLedger.create).not.toHaveBeenCalled();
  });
});

describe("refundGenerationCredit", () => {
  it("increments and records a refund when none exists yet", async () => {
    tx.creditLedger.findFirst.mockResolvedValue(null);
    tx.user.update.mockResolvedValue({ credits: 12 });
    tx.creditLedger.create.mockResolvedValue({});

    await refundGenerationCredit("user-1", "req-1");

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { credits: { increment: 1 } },
      select: { credits: true },
    });
    expect(tx.creditLedger.create).toHaveBeenCalledWith({
      data: { userId: "user-1", amount: 1, balance: 12, reason: "figure_generation_refund", referenceId: "req-1" },
    });
  });

  it("is idempotent: a second refund for the same reference is a no-op", async () => {
    tx.creditLedger.findFirst.mockResolvedValue({ id: "ledger-1" });

    await refundGenerationCredit("user-1", "req-1");

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.creditLedger.create).not.toHaveBeenCalled();
  });
});

describe("grantSignupBonus", () => {
  it("records the welcome credits that explain a new account's balance", async () => {
    tx.creditLedger.findFirst.mockResolvedValue(null);
    tx.user.findUniqueOrThrow.mockResolvedValue({ credits: 12 });
    tx.creditLedger.create.mockResolvedValue({});

    await grantSignupBonus("user-1");

    expect(tx.creditLedger.create).toHaveBeenCalledWith({
      data: { userId: "user-1", amount: 12, balance: 12, reason: "signup_bonus" },
    });
  });

  it("is idempotent: an already-recorded bonus is not granted twice", async () => {
    tx.creditLedger.findFirst.mockResolvedValue({ id: "ledger-1" });

    await grantSignupBonus("user-1");

    expect(tx.user.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.creditLedger.create).not.toHaveBeenCalled();
  });
});
