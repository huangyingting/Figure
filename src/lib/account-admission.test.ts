import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: { inviteOnly: true, siteUrl: "https://figure.genisisiq.com" },
  user: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  account: { findUnique: vi.fn() },
  accountInvitation: { findUnique: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
}));
vi.mock("@/lib/config", () => ({ getApplicationConfig: () => mocks.config }));
vi.mock("@/lib/prisma", () => ({
  prisma: { ...mocks, $transaction: (callback: (tx: typeof mocks) => unknown) => callback(mocks) },
}));

import {
  accountPassword, authorizeSocialAccount, bootstrapAdministrator, createSocialAccount,
  hashInvitationToken, invitationStatus, issueInvitation, registerAccount, registrationSchema, revokeInvitation,
} from "@/lib/account-admission";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.inviteOnly = true;
  mocks.user.create.mockResolvedValue({ id: "new-member" });
  mocks.accountInvitation.updateMany.mockResolvedValue({ count: 1 });
});

const input = { name: "Invited learner", email: "invited@example.com", password: "a-valid-password", token: "a".repeat(64) };

describe("invitation admission", () => {
  it("rejects direct public registration by default", async () => {
    await expect(registerAccount({ ...input, token: undefined })).rejects.toThrow("invitation is required");
    expect(mocks.user.create).not.toHaveBeenCalled();
  });

  it("allows explicitly configured open registration without an invitation", async () => {
    mocks.config.inviteOnly = false;
    await registerAccount({ ...input, token: undefined });
    expect(mocks.accountInvitation.updateMany).not.toHaveBeenCalled();
    expect(mocks.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: input.email, creditLedger: { create: expect.objectContaining({ amount: 12 }) } }),
    }));
  });

  it("claims the email-bound, unexpired, unrevoked token and creates one welcome grant", async () => {
    await registerAccount(input);
    expect(mocks.accountInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        email: input.email, tokenHash: hashInvitationToken(input.token), acceptedAt: null, revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { acceptedAt: expect.any(Date), tokenHash: null },
    });
    const data = mocks.user.create.mock.calls[0][0].data;
    expect(data.passwordHash).not.toBe(input.password);
    expect(data.creditLedger.create.referenceId).toBe("signup");
    expect(data.role).toBeUndefined();
  });

  it("refuses invalid, expired, revoked, mismatched and already claimed invitations", async () => {
    mocks.accountInvitation.updateMany.mockResolvedValue({ count: 0 });
    await expect(registerAccount(input)).rejects.toThrow("valid invitation");
    expect(mocks.user.create).not.toHaveBeenCalled();
  });

  it("normalizes email and refuses bcrypt-truncated multibyte passwords", () => {
    expect(registrationSchema.parse({ ...input, email: " INVITED@example.com " }).email).toBe(input.email);
    expect(accountPassword.safeParse("a".repeat(72)).success).toBe(true);
    expect(accountPassword.safeParse("a".repeat(73)).success).toBe(false);
    expect(accountPassword.safeParse("中".repeat(25)).success).toBe(false);
  });
});

describe("social admission", () => {
  it("continues an existing provider account without opening public registration", async () => {
    mocks.account.findUnique.mockResolvedValue({ id: "existing" });
    expect(await authorizeSocialAccount("facebook", "provider-id", {})).toBe(true);
  });

  it("does not trust unverified or unsupported provider emails for account linking", async () => {
    expect(await authorizeSocialAccount("google", "provider-id", { email: input.email, email_verified: false })).toBe(false);
    expect(await authorizeSocialAccount("facebook", "provider-id", { email: input.email, email_verified: true })).toBe(false);
    expect(mocks.user.create).not.toHaveBeenCalled();
  });

  it("requires a pending invitation for a new verified Google email", async () => {
    const profile = { email: input.email, email_verified: true };
    expect(await authorizeSocialAccount("google", "provider-id", profile)).toBe(false);
    mocks.accountInvitation.findUnique.mockResolvedValue({
      tokenHash: "hash", acceptedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 86400000),
    });
    expect(await authorizeSocialAccount("google", "provider-id", profile)).toBe(true);
    mocks.accountInvitation.findUnique.mockResolvedValue({
      tokenHash: "hash", acceptedAt: null, revokedAt: new Date(), expiresAt: new Date(Date.now() + 86400000),
    });
    expect(await authorizeSocialAccount("google", "provider-id", profile)).toBe(false);
  });

  it("rechecks and claims an invitation inside adapter account creation", async () => {
    mocks.accountInvitation.updateMany.mockResolvedValue({ count: 0 });
    await expect(createSocialAccount({ email: input.email })).rejects.toThrow("valid invitation");
    expect(mocks.user.create).not.toHaveBeenCalled();
  });

  it("permits existing members to link a verified Google identity", async () => {
    mocks.user.findUnique.mockResolvedValue({ id: "member" });
    expect(await authorizeSocialAccount("google", "provider-id", { email: input.email, email_verified: true })).toBe(true);
  });
});

describe("administrator invitation operations", () => {
  it("rejects non-administrators before issuing or revoking links", async () => {
    mocks.user.findUnique.mockResolvedValue({ role: "member" });
    await expect(issueInvitation("member", input.email)).rejects.toThrow("Administrator");
    await expect(revokeInvitation("member", "invite")).rejects.toThrow("Administrator");
    expect(mocks.accountInvitation.upsert).not.toHaveBeenCalled();
  });

  it("returns a fresh private link but persists only its digest", async () => {
    mocks.user.findUnique.mockResolvedValueOnce({ role: "admin" }).mockResolvedValueOnce(null);
    mocks.accountInvitation.upsert.mockResolvedValue({ id: "invite" });
    const result = await issueInvitation("admin", input.email);
    const token = result.acceptUrl.split("/").at(-1)!;
    expect(result.acceptUrl).toMatch(/^https:\/\/figure\.genisisiq\.com\/invite\/[a-f0-9]{64}$/);
    const data = mocks.accountInvitation.upsert.mock.calls[0][0].create;
    expect(data.tokenHash).toBe(hashInvitationToken(token));
    expect(data).not.toHaveProperty("token");
  });

  it("does not invite an existing member", async () => {
    mocks.user.findUnique.mockResolvedValueOnce({ role: "admin" }).mockResolvedValueOnce({ id: "member" });
    await expect(issueInvitation("admin", input.email)).rejects.toThrow("already exists");
  });

  it("requires an explicit replacement of an active invitation", async () => {
    mocks.user.findUnique.mockResolvedValueOnce({ role: "admin" }).mockResolvedValueOnce(null);
    mocks.accountInvitation.findUnique.mockResolvedValue({
      id: "invite", acceptedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 86400000),
    });
    await expect(issueInvitation("admin", input.email)).rejects.toThrow("active invitation");
  });

  it("clears the old token and preserves the accepted state when a revoke loses the race", async () => {
    mocks.user.findUnique.mockResolvedValue({ role: "admin" });
    mocks.accountInvitation.updateMany.mockResolvedValue({ count: 0 });
    await expect(revokeInvitation("admin", "invite")).rejects.toThrow("no longer be revoked");
    expect(mocks.accountInvitation.updateMany).toHaveBeenCalledWith({
      where: { id: "invite", acceptedAt: null, revokedAt: null },
      data: { tokenHash: null, revokedAt: expect.any(Date) },
    });
  });

  it("derives inactive status without treating expired grants as pending", () => {
    expect(invitationStatus({ acceptedAt: null, revokedAt: null, expiresAt: new Date(0) })).toBe("expired");
    expect(invitationStatus({ acceptedAt: new Date(), revokedAt: null, expiresAt: new Date(0) })).toBe("accepted");
  });

  it("bootstraps only through a validated account upsert without resetting existing credits", async () => {
    await bootstrapAdministrator({ email: " ADMIN@example.com ", name: "Administrator", password: input.password });
    expect(mocks.user.upsert).toHaveBeenCalledWith({
      where: { email: "admin@example.com" },
      create: expect.objectContaining({ role: "admin", creditLedger: { create: expect.objectContaining({ amount: 12 }) } }),
      update: { name: "Administrator", passwordHash: expect.any(String), role: "admin", emailVerified: expect.any(Date) },
      select: { id: true },
    });
  });
});
