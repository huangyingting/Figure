"use client";

import { ArrowRight, Facebook, LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode, social, callbackUrl = "/library" }: { mode: "signin" | "register"; social: { google: boolean; facebook: boolean }; callbackUrl?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      {(social.google || social.facebook) && <div className="social-buttons">
        {social.google && <button type="button" onClick={() => signIn("google", { redirectTo: callbackUrl })}><b>G</b>Continue with Google</button>}
        {social.facebook && <button type="button" onClick={() => signIn("facebook", { redirectTo: callbackUrl })}><Facebook size={17} />Continue with Facebook</button>}
      </div>}
      {(social.google || social.facebook) && <div className="auth-divider"><span>or use email</span></div>}
      <form action={submit}>
        {mode === "register" && <label><span>Name</span><input name="name" autoComplete="name" minLength={2} required placeholder="Ada Lovelace" /></label>}
        <label><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
        <label><span>Password</span><input name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required placeholder="At least 8 characters" /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={pending}>{pending ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}{mode === "signin" ? "Sign in" : "Create free account"}</button>
      </form>
      <p className="auth-switch">{mode === "signin" ? "New to Figure?" : "Already have an account?"} <Link href={mode === "signin" ? "/register" : "/signin"}>{mode === "signin" ? "Create an account" : "Sign in"}</Link></p>
    </div>
  );
}
