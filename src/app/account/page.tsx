import { UserCog } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AccountSettings } from "@/components/account-settings";
import { ProductShell } from "@/components/product-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Account settings" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/account");
  const account = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { name: true, email: true, passwordHash: true } });
  return <ProductShell active="/account"><main className="fx-page account-page">
    <header className="fx-title-row"><div><p><UserCog size={14} /> ACCOUNT</p><h1>Settings</h1><span>Manage your profile and sign-in details.</span></div></header>
    <AccountSettings name={account.name ?? ""} email={account.email ?? ""} hasPassword={Boolean(account.passwordHash)} />
  </main></ProductShell>;
}
