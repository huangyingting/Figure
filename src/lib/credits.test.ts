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
  figure: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
  },
}));

import { consumeGenerationCredit, recoverGenerationCredit, refundGenerationCredit } from "@/lib/credits";

beforeEach(() => {
  vi.resetAllMocks();
  tx.creditLedger.findFirst.mockResolvedValue(null);
  tx.figure.findUnique.mockResolvedValue(null);
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

  it("does not charge the same generation twice", async () => {
    tx.creditLedger.findFirst.mockResolvedValueOnce({ id: "debit" }).mockResolvedValueOnce(null);
    tx.user.findUniqueOrThrow.mockResolvedValue({ credits: 9 });
    expect(await consumeGenerationCredit("user-1", "req-1")).toBe(9);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.creditLedger.create).not.toHaveBeenCalled();
  });

  it("rejects reuse of a refunded generation reference", async () => {
    tx.creditLedger.findFirst.mockResolvedValueOnce({ id: "debit" }).mockResolvedValueOnce({ id: "refund" });
    await expect(consumeGenerationCredit("user-1", "req-1")).rejects.toThrow("cannot be reused");
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("refundGenerationCredit", () => {
  it("increments and records a refund when none exists yet", async () => {
    tx.creditLedger.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "debit", amount: -1 });
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

  it("rejects refunds without a matching charge", async () => {
    await expect(refundGenerationCredit("user-1", "unknown")).rejects.toThrow("matching charge");
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.creditLedger.create).not.toHaveBeenCalled();
  });
});

describe("recoverGenerationCredit", () => {
  const before = new Date("2020-01-02T00:00:00Z");

  beforeEach(() => {
    tx.creditLedger.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "debit", amount: -1, createdAt: new Date("2020-01-01T00:00:00Z"),
    });
  });

  it("previews an old unmatched charge without changing the balance", async () => {
    expect(await recoverGenerationCredit("user-1", "req-1", { before, dryRun: true })).toBe("eligible-for-review");
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.creditLedger.create).not.toHaveBeenCalled();
  });

  it("applies a confirmed recovery through the existing refund transaction", async () => {
    tx.user.update.mockResolvedValue({ credits: 12 });
    expect(await recoverGenerationCredit("user-1", "req-1", { before, dryRun: false })).toBe("refunded");
    expect(tx.creditLedger.create).toHaveBeenCalledOnce();
  });

  it("does not refund saved figures", async () => {
    tx.figure.findUnique.mockResolvedValue({ id: "req-1" });
    await expect(recoverGenerationCredit("user-1", "req-1", { before, dryRun: false })).rejects.toThrow("saved figure");
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("rejects recent charges", async () => {
    await expect(recoverGenerationCredit("user-1", "req-1", {
      before: new Date("2019-12-31T00:00:00Z"), dryRun: false,
    })).rejects.toThrow("too recent");
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("rejects a recent or invalid cutoff", async () => {
    for (const cutoff of [new Date(), new Date("invalid")]) {
      await expect(recoverGenerationCredit("user-1", "req-1", { before: cutoff, dryRun: false })).rejects.toThrow("24 hours");
    }
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("surfaces database failures instead of claiming recovery", async () => {
    tx.user.update.mockRejectedValue(new Error("database unavailable"));
    await expect(recoverGenerationCredit("user-1", "req-1", { before, dryRun: false })).rejects.toThrow("database unavailable");
    expect(tx.creditLedger.create).not.toHaveBeenCalled();
  });
});
