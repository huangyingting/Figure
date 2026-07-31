"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

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
    <div className="account-grid">
      <section className="account-card">
        <h2>Profile</h2>
        <p>Your name appears on the figures you publish.</p>
        <form action={saveProfile}>
          <label><span>Name</span><input name="name" required minLength={2} maxLength={60} defaultValue={name} /></label>
          <label><span>Email</span><input value={email} disabled aria-label="Email (read-only)" /></label>
          {profileState.message && <p className={profileState.error ? "auth-error" : "account-success"} role="status">{profileState.message}</p>}
          <button className="auth-submit" disabled={profileState.pending}>{profileState.pending ? "Saving…" : "Save profile"}</button>
        </form>
      </section>

      <section className="account-card">
        <h2>{hasPassword ? "Change password" : "Set a password"}</h2>
        <p>{hasPassword ? "Use at least 8 characters." : "Add a password so you can sign in with email as well."}</p>
        <form action={savePassword} id="password-form">
          {hasPassword && <label><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required minLength={1} /></label>}
          <label><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} placeholder="At least 8 characters" /></label>
          {passwordState.message && <p className={passwordState.error ? "auth-error" : "account-success"} role="status">{passwordState.message}</p>}
          <button className="auth-submit" disabled={passwordState.pending}>{passwordState.pending ? "Saving…" : hasPassword ? "Update password" : "Set password"}</button>
        </form>
      </section>
    </div>
  );
}
