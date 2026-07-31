import { redirect } from "next/navigation";
import Image from "next/image";
import { auth, configuredSocialProviders } from "@/auth";
import { AuthForm } from "@/components/auth-form";
import { FigureBrand } from "@/components/product-shell";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const requested = (await searchParams).callbackUrl;
  const callbackUrl = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/library";
  if (await auth()) redirect(callbackUrl);
  return <main className="auth-page"><header><FigureBrand /></header><div className="auth-layout"><div className="auth-art"><p>LOOK. LEARN. REMEMBER.</p><h2>Build a visual library that grows with your curiosity.</h2><div className="auth-mini-figure"><Image src="/demo-pump.svg" width={1440} height={960} alt="" /><span>7 components</span></div></div><AuthForm mode="signin" social={configuredSocialProviders()} callbackUrl={callbackUrl} /></div></main>;
}
