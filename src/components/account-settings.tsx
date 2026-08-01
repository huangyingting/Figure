"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

import { Button, Card, Field, FieldError, FieldSuccess, Input } from "@/components/ui";

export function AccountSettings({ name, email, hasPassword }: { name: string; email: string; hasPassword: boolean }) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [profileState, setProfileState] = useState<{ pending: boolean; message: string | null; error: boolean }>({ pending: false, message: null, error: false });
  const [passwordState, setPasswordState] = useState<{ pending: boolean; message: string | null; error: boolean }>({ pending: false, message: null, error: false });

  async function saveProfile(formData: FormData) {
    setProfileState({ pending: true, message: null, error: false });
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formData.get("name") }),
    });
    if (response.ok) {
      await updateSession();
      router.refresh();
      setProfileState({ pending: false, message: "Profile updated.", error: false });
    } else {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setProfileState({ pending: false, message: body.error || "Could not update profile.", error: true });
    }
  }

  async function savePassword(formData: FormData) {
    setPasswordState({ pending: true, message: null, error: false });
    const response = await fetch("/api/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: formData.get("currentPassword") || undefined,
        newPassword: formData.get("newPassword"),
      }),
    });
    if (response.ok) {
      setPasswordState({ pending: false, message: "Password updated.", error: false });
      (document.getElementById("password-form") as HTMLFormElement | null)?.reset();
    } else {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setPasswordState({ pending: false, message: body.error || "Could not update password.", error: true });
    }
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
      <Card className="rounded-2xl border-line-dark p-[26px] shadow-none">
        <h2 className="m-0 font-display text-[20px] tracking-[-0.03em]">Profile</h2>
        <p className="mt-[6px] mb-5 text-[11px] leading-[1.5] text-muted">Your name appears on the figures you publish.</p>
        <form action={saveProfile} className="grid gap-[13px]">
          <Field label="Name"><Input name="name" required minLength={2} maxLength={60} defaultValue={name} /></Field>
          <Field label="Email"><Input value={email} disabled aria-label="Email (read-only)" /></Field>
          {profileState.message && (profileState.error
            ? <FieldError>{profileState.message}</FieldError>
            : <FieldSuccess>{profileState.message}</FieldSuccess>)}
          <Button disabled={profileState.pending}>{profileState.pending ? "Saving…" : "Save profile"}</Button>
        </form>
      </Card>

      <Card className="rounded-2xl border-line-dark p-[26px] shadow-none">
        <h2 className="m-0 font-display text-[20px] tracking-[-0.03em]">{hasPassword ? "Change password" : "Set a password"}</h2>
        <p className="mt-[6px] mb-5 text-[11px] leading-[1.5] text-muted">{hasPassword ? "Use at least 8 characters." : "Add a password so you can sign in with email as well."}</p>
        <form action={savePassword} id="password-form" className="grid gap-[13px]">
          {hasPassword && <Field label="Current password"><Input name="currentPassword" type="password" autoComplete="current-password" required minLength={1} /></Field>}
          <Field label="New password"><Input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} placeholder="At least 8 characters" /></Field>
          {passwordState.message && (passwordState.error
            ? <FieldError>{passwordState.message}</FieldError>
            : <FieldSuccess>{passwordState.message}</FieldSuccess>)}
          <Button disabled={passwordState.pending}>{passwordState.pending ? "Saving…" : hasPassword ? "Update password" : "Set password"}</Button>
        </form>
      </Card>
    </div>
  );
}
