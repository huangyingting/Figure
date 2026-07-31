import { ArrowDownRight, ArrowUpRight, Coins, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProductShell } from "@/components/product-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Credits" };
export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const session = await auth(); if (!session?.user?.id) redirect("/signin?callbackUrl=/credits");
  const [account, ledger] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { credits: true, createdAt: true } }), prisma.creditLedger.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 30 })]);
  return <ProductShell active="/credits"><main className="fx-page credits-page"><header className="fx-title-row"><div><p><Coins size={14} /> USAGE & CREDITS</p><h1>Your credits</h1><span>One generation credit creates, grounds, and permanently stores one figure.</span></div></header><section className="credit-hero"><div><p>AVAILABLE BALANCE</p><strong>{account.credits}</strong><span>figure credits</span><small><Sparkles size={14} /> Each new account begins with 12 credits.</small></div><div><h2>Everything is included.</h2><ul><li>AI component planning</li><li>High-resolution image generation</li><li>Pixel-grounded annotations</li><li>Permanent figure storage</li></ul></div></section><section className="ledger"><header><h2>Credit activity</h2><span>{ledger.length} recent transactions</span></header>{ledger.length ? ledger.map((item) => <div key={item.id}><span data-positive={item.amount > 0}>{item.amount > 0 ? <ArrowUpRight /> : <ArrowDownRight />}</span><div><strong>{item.reason === "figure_generation" ? "Figure generated" : "Generation refunded"}</strong><small>{item.createdAt.toLocaleString()}</small></div><b>{item.amount > 0 ? "+" : ""}{item.amount}</b><em>{item.balance} left</em></div>) : <div className="ledger-empty">Your credit activity will appear after your first generation.</div>}</section></main></ProductShell>;
}
