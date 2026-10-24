import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { FigureBrand } from "@/components/figure-brand";
import { hashInvitationToken, invitationStatus } from "@/lib/account-admission";
import { getTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, t] = await Promise.all([params, getTranslator()]);
  const invitation = /^[a-f0-9]{64}$/.test(token)
    ? await prisma.accountInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) } }) : null;
  const valid = invitation && invitationStatus(invitation) === "pending";
  return <main className="min-h-screen bg-shell px-5 py-8">
    <header className="mx-auto mb-12 max-w-md"><FigureBrand /></header>
    <div className="mx-auto max-w-md">
      {valid ? <AuthForm mode="register" social={{ google: false, facebook: false }} inviteOnly invitation={{ token, email: invitation.email }} /> : <section className="rounded-2xl border border-line bg-paper p-8">
        <h1 className="font-display text-3xl">{t("Invitation unavailable")}</h1>
        <p className="my-5 text-muted">{t("This link is expired, revoked, or already used. Ask your administrator for a new invitation.")}</p>
        <Link href="/signin" className="font-bold text-pine-dark">{t("Sign in")}</Link>
      </section>}
    </div>
  </main>;
}
