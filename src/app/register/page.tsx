import type { Metadata } from "next";
import { configuredSocialProviders } from "@/auth";
import { AuthForm } from "@/components/auth-form";
import { FigureBrand } from "@/components/product-shell";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_52%,rgb(101_87_232_/_13%),transparent_27rem),#f7f6f2] px-[max(40px,calc((100vw-1240px)/2))] max-[1100px]:px-[max(24px,calc((100vw-1240px)/2))] max-[760px]:px-[18px]">
      <header className="flex min-h-[80px] items-center border-b border-line"><FigureBrand /></header>
      <div className="grid min-h-[calc(100vh-80px)] items-center gap-16 p-[40px_30px] grid-cols-[1fr_460px] max-[1100px]:grid-cols-[1fr_430px] max-[1100px]:gap-10 max-[760px]:block max-[760px]:p-[38px_0]">
        <div className="max-[760px]:hidden">
          <p className="text-micro font-extrabold tracking-[0.16em] text-violet-dark">12 CREDITS, ON US</p>
          <h2 className="mt-4 mb-[30px] max-w-[620px] font-display text-[clamp(42px,5vw,67px)] font-medium leading-[1.03] tracking-[-0.065em]">Turn twelve questions into twelve things you truly understand.</h2>
          <div className="grid w-[210px] place-items-center rounded-[22px] border border-[#dcd7ff] bg-[linear-gradient(145deg,#fff,var(--color-violet-pale))] p-7 shadow-[0_20px_55px_rgb(52_40_125_/_12%)] rotate-[-3deg]">
            <i className="text-[25px] not-italic text-violet">✦</i>
            <strong className="font-display text-[75px] leading-none tracking-[-0.08em]">12</strong>
            <span className="text-meta font-bold text-muted">free figure credits</span>
          </div>
        </div>
        <AuthForm mode="register" social={configuredSocialProviders()} />
      </div>
    </main>
  );
}
