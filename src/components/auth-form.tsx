"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FacebookIcon, GoogleIcon } from "@/components/brand-icons";

type SocialProvider = "google" | "facebook";

export function AuthForm({ mode, social, callbackUrl = "/library" }: { mode: "signin" | "register"; social: { google: boolean; facebook: boolean }; callbackUrl?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [socialPending, setSocialPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    <div className="auth-card">
      <div className="auth-card-intro">
        <span>✦</span>
        <p>{mode === "signin" ? "Welcome back" : "Your visual learning space"}</p>
        <h1>{mode === "signin" ? "Sign in to Figure" : "Create your account"}</h1>
        <small>{mode === "signin" ? "Your collections and mastery streak are waiting." : "Start with 12 credits—enough for twelve new visual lessons."}</small>
      </div>
      {hasSocial && (
        <div className="social-buttons">
          {social.google && (
            <button type="button" className="social-button" data-provider="google" onClick={() => continueWith("google")} disabled={busy}>
              {socialPending === "google" ? <LoaderCircle className="spin" size={17} /> : <GoogleIcon size={18} />}
              <span>Continue with Google</span>
            </button>
          )}
          {social.facebook && (
            <button type="button" className="social-button" data-provider="facebook" onClick={() => continueWith("facebook")} disabled={busy}>
              {socialPending === "facebook" ? <LoaderCircle className="spin" size={17} /> : <FacebookIcon size={18} />}
              <span>Continue with Facebook</span>
            </button>
          )}
        </div>
      )}
      {hasSocial && <div className="auth-divider"><span>or use email</span></div>}
      <form action={submit}>
        {mode === "register" && <label><span>Name</span><input name="name" autoComplete="name" minLength={2} required placeholder="Ada Lovelace" disabled={busy} /></label>}
        <label><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" disabled={busy} /></label>
        <label><span>Password</span><input name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required placeholder="At least 8 characters" disabled={busy} /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy}>{pending ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}{mode === "signin" ? "Sign in" : "Create free account"}</button>
      </form>
      <p className="auth-switch">{mode === "signin" ? "New to Figure?" : "Already have an account?"} <Link href={mode === "signin" ? "/register" : "/signin"}>{mode === "signin" ? "Create an account" : "Sign in"}</Link></p>
    </div>
  );
}
