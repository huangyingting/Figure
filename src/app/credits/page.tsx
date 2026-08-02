import { ArrowDownRight, ArrowUpRight, Coins, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProductShell } from "@/components/product-shell";
import { Page, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getLocale, getTranslator } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())("Credits") };
}
export const dynamic = "force-dynamic";

const reasonLabels: Record<string, string> = {
  figure_generation: "Figure generated",
  figure_generation_refund: "Generation refunded",
  signup_bonus: "Welcome credits",
  promo_grant: "Bonus credits",
};

export default async function CreditsPage() {
  const [session, t, locale] = await Promise.all([auth(), getTranslator(), getLocale()]); if (!session?.user?.id) redirect("/signin?callbackUrl=/credits");
  const [account, ledger] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { credits: true, createdAt: true } }), prisma.creditLedger.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 30 })]);
  return <ProductShell><Page>
    <PageHeader eyebrow={<><Coins size={14} /> {t("USAGE & CREDITS")}</>} title={t("Your credits")} lead={t("One generation credit creates, grounds, and permanently stores one figure.")} />
    <section className="mb-7 grid grid-cols-1 overflow-hidden rounded-[18px] border border-line-dark bg-paper shadow-[0_22px_60px_rgb(35_33_27_/_7%)] md:grid-cols-2">
      <div className="grid min-h-[230px] place-items-start content-center bg-[radial-gradient(circle_at_90%_10%,rgb(255_201_77_/_30%),transparent_16rem),var(--color-pine)] p-[34px] text-white">
        <p className="m-0 text-micro font-extrabold uppercase tracking-[0.13em] text-[#cfe8d8]">{t("AVAILABLE BALANCE")}</p>
        <strong className="mt-1 block font-display text-[88px] leading-[0.9] tracking-[-0.015em]">{account.credits}</strong>
        <span className="text-lead font-bold">{t("figure credits")}</span>
        <small className="mt-6 flex items-center gap-[7px] text-meta text-[#ddeee2]"><Sparkles size={14} /> {t("Each new account begins with 12 credits.")}</small>
      </div>
      <div className="grid content-center p-[34px]">
        <h2 className="mb-[17px] mt-0 font-display text-[25px] tracking-[-0.015em]">{t("Everything is included.")}</h2>
        <ul className="m-0 grid list-none gap-3 p-0 [&_li]:relative [&_li]:pl-[22px] [&_li]:text-ui [&_li]:text-muted [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:font-extrabold [&_li]:before:text-green [&_li]:before:content-['✓']">
          <li>{t("AI component planning")}</li>
          <li>{t("High-resolution image generation")}</li>
          <li>{t("Pixel-grounded annotations")}</li>
          <li>{t("Permanent figure storage")}</li>
        </ul>
      </div>
    </section>
    <section className="overflow-hidden rounded-[14px] border border-line bg-paper">
      <header className="flex items-center justify-between border-b border-line px-[21px] py-[18px]">
        <h2 className="m-0 font-display text-[20px]">{t("Credit activity")}</h2>
        <span className="text-micro text-muted">{ledger.length} {t("recent transactions")}</span>
      </header>
      {ledger.length ? ledger.map((item) => (
        <div key={item.id} className="grid grid-cols-[35px_1fr_auto] items-center gap-3 border-b border-[#efeeeb] px-[21px] py-[13px] sm:grid-cols-[35px_1fr_auto_58px] [&_svg]:w-[15px]">
          <span data-positive={item.amount > 0} className="grid h-8 w-8 place-items-center rounded-[9px] bg-[#fff0eb] text-[#a24d39] data-[positive=true]:bg-[#e7f8f1] data-[positive=true]:text-green">{item.amount > 0 ? <ArrowUpRight /> : <ArrowDownRight />}</span>
          <div className="grid">
            <strong className="text-micro">{t(reasonLabels[item.reason] ?? item.reason)}</strong>
            <small className="text-micro text-muted">{item.createdAt.toLocaleString(locale)}</small>
          </div>
          <b className="font-display text-body">{item.amount > 0 ? "+" : ""}{item.amount}</b>
          <em className="hidden text-right text-micro not-italic text-muted sm:block">{item.balance} {t("left")}</em>
        </div>
      )) : <div className="p-[35px] text-center text-micro text-muted">{t("Your credit activity will appear after your first generation.")}</div>}
    </section>
  </Page></ProductShell>;
}
