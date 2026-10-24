import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { InvitationManager } from "@/components/invitation-manager";
import { ProductShell } from "@/components/product-shell";
import { Page, PageHeader } from "@/components/ui";
import { getTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const [session, t] = await Promise.all([auth(), getTranslator()]);
  if (!session?.user?.id) redirect("/signin?callbackUrl=/admin/invitations");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "admin") notFound();
  return <ProductShell><Page>
    <PageHeader title={t("Account invitations")} lead={t("Invite someone to Figure. Links are private, single-use, and bound to their email.")} />
    <InvitationManager />
  </Page></ProductShell>;
}
