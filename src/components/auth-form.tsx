"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FacebookIcon, GoogleIcon } from "@/components/brand-icons";
import { Button, Divider, Field, FieldError, Input } from "@/components/ui";

type SocialProvider = "google" | "facebook";

const socialButtonClass =
  "relative flex min-h-[48px] items-center justify-center gap-[11px] rounded-[10px] border border-line-dark bg-paper px-11 text-ui font-bold text-ink cursor-pointer transition-[border-color,background,box-shadow,transform] duration-150 hover:not-disabled:bg-[#fbf7ec] hover:not-disabled:shadow-[0_6px_18px_rgb(35_33_27_/_7%)] hover:not-disabled:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55";

export function AuthForm({ mode, social, callbackUrl = "/library", initialError = null }: { mode: "signin" | "register"; social: { google: boolean; facebook: boolean }; callbackUrl?: string; initialError?: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [socialPending, setSocialPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const hasSocial = social.google || social.facebook;
  const busy = pending || socialPending !== null;

  function continueWith(provider: SocialProvider) {
    setError(null);
    setSocialPending(provider);
    void signIn(provider, { redirectTo: callbackUrl });
  }

  async function submit(formData: FormData) {
    setPending(true); setError(null);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    if (mode === "register") {
      const response = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), email, password }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setError(payload.error || "Registration failed."); setPending(false); return;
      }
    }
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) { setError("Email or password is incorrect."); setPending(false); return; }
    router.push(callbackUrl); router.refresh();
  }

  return (
    <div className="rounded-[18px] border border-line-dark bg-paper/90 p-[30px] shadow-[0_30px_80px_rgb(35_33_27_/_11%)] backdrop-blur-[15px] max-[760px]:mx-auto max-[760px]:max-w-[480px] max-[760px]:px-5 max-[760px]:py-[26px]">
      <div className="text-center">
        <span className="mx-auto mb-[10px] grid h-[38px] w-[38px] place-items-center rounded-xl bg-pine-pale text-pine">✦</span>
        <p className="text-micro font-extrabold uppercase tracking-[0.13em] text-pine-dark">{mode === "signin" ? "Welcome back" : "Your visual learning space"}</p>
        <h1 className="mt-[6px] mb-[5px] font-display text-[32px] font-[560] tracking-[-0.015em]">{mode === "signin" ? "Sign in to Figure" : "Create your account"}</h1>
        <small className="block text-ui leading-[1.6] text-muted">{mode === "signin" ? "Your collections and mastery streak are waiting." : "Start with 12 credits—enough for twelve new visual lessons."}</small>
      </div>
      {hasSocial && (
        <div className="mt-[18px] grid gap-[9px]">
          {social.google && (
            <button type="button" className={socialButtonClass} data-provider="google" onClick={() => continueWith("google")} disabled={busy}>
              {socialPending === "google" ? <LoaderCircle className="spin absolute left-4 text-muted" size={17} /> : <span className="absolute left-4 inline-flex"><GoogleIcon size={18} /></span>}
              <span className="whitespace-nowrap">Continue with Google</span>
            </button>
          )}
          {social.facebook && (
            <button type="button" className={socialButtonClass} data-provider="facebook" onClick={() => continueWith("facebook")} disabled={busy}>
              {socialPending === "facebook" ? <LoaderCircle className="spin absolute left-4 text-muted" size={17} /> : <span className="absolute left-4 inline-flex"><FacebookIcon size={18} /></span>}
              <span className="whitespace-nowrap">Continue with Facebook</span>
            </button>
          )}
        </div>
      )}
      {hasSocial && <Divider className="my-[15px]">or use email</Divider>}
      <form action={submit} className="grid gap-3">
        {mode === "register" && <Field label="Name"><Input name="name" autoComplete="name" minLength={2} required placeholder="Ada Lovelace" disabled={busy} /></Field>}
        <Field label="Email"><Input name="email" type="email" autoComplete="email" required placeholder="you@example.com" disabled={busy} /></Field>
        <Field label="Password"><Input name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required placeholder="At least 8 characters" disabled={busy} /></Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" className="w-full" disabled={busy}>{pending ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}{mode === "signin" ? "Sign in" : "Create free account"}</Button>
      </form>
      <p className="mt-4 flex items-center justify-center gap-[6px] border-t border-line pt-[15px] text-ui text-muted">{mode === "signin" ? "New to Figure?" : "Already have an account?"} <Link href={mode === "signin" ? "/register" : "/signin"} className="font-bold text-pine-dark">{mode === "signin" ? "Create an account" : "Sign in"}</Link></p>
    </div>
  );
}
