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
  return <main className="auth-page"><header><FigureBrand /></header><div className="auth-layout"><div className="auth-art"><p>LOOK. LEARN. REMEMBER.</p><h2>Build a visual library that grows with your curiosity.</h2><div className="auth-mini-figure"><Image src="/demo-pump.svg" width={1440} height={960} alt="" /><span>7 components</span></div></div><AuthForm mode="signin" social={configuredSocialProviders()} callbackUrl={callbackUrl} initialError={initialError} /></div></main>;
}
