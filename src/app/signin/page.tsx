import type { Metadata } from "next";
import Image from "next/image";
import { configuredSocialProviders } from "@/auth";
import { authErrorMessage, safeCallbackUrl } from "@/auth.config";
import { AuthForm } from "@/components/auth-form";
import { FigureBrand } from "@/components/product-shell";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const initialError = authErrorMessage(params.error);
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_52%,rgb(28_107_82_/_13%),transparent_27rem),#f6f1e4] px-[max(40px,calc((100vw-1240px)/2))] max-[1100px]:px-[max(24px,calc((100vw-1240px)/2))] max-[760px]:px-[18px]">
      <header className="flex min-h-[80px] items-center border-b border-line"><FigureBrand /></header>
      <div className="grid min-h-[calc(100vh-80px)] items-center gap-16 p-[40px_30px] grid-cols-[1fr_460px] max-[1100px]:grid-cols-[1fr_430px] max-[1100px]:gap-10 max-[760px]:block max-[760px]:p-[38px_0]">
        <div className="max-[760px]:hidden">
          <p className="text-micro font-extrabold tracking-[0.16em] text-pine-dark">LOOK. LEARN. REMEMBER.</p>
          <h2 className="mt-4 mb-[30px] max-w-[620px] font-display text-[clamp(42px,5vw,67px)] font-medium leading-[1.03] tracking-[-0.015em]">Build a visual library that grows with your curiosity.</h2>
          <div className="relative w-[min(540px,90%)] overflow-hidden rounded-2xl border border-line bg-paper p-3 shadow-[0_25px_60px_rgb(60_52_30_/_12%)] rotate-[-2deg]">
            <Image src="/demo-pump.png" width={1536} height={1024} alt="" className="block w-full rounded-[9px]" />
            <span className="absolute right-5 bottom-5 rounded-md bg-pine px-[9px] py-[7px] text-[11px] font-extrabold text-white">7 components</span>
          </div>
        </div>
        <AuthForm mode="signin" social={configuredSocialProviders()} callbackUrl={callbackUrl} initialError={initialError} />
      </div>
    </main>
  );
}
