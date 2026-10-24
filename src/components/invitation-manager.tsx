"use client";

import { useEffect, useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";

type Invitation = { id: string; email: string; status: string; expiresAt: string };

export function InvitationManager() {
  const { t } = useI18n();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/admin/invitations", { cache: "no-store" });
    if (!response.ok) throw new Error(t("Could not load invitations."));
    const data = await response.json() as { invitations: Invitation[] };
    setInvitations(data.invitations);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/invitations", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(t("Could not load invitations."));
      const data = await response.json() as { invitations: Invitation[] };
      if (active) setInvitations(data.invitations);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : t("Could not load invitations."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);

  async function mutate(url: string, method: string, email?: string) {
    setPending(true); setError(""); setNotice(""); setLink("");
    try {
      const response = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, ...(email ? { body: JSON.stringify({ email }) } : {}),
      });
      const data = await response.json() as { error?: string; acceptUrl?: string };
      if (!response.ok) throw new Error(t(data.error || "Could not update invitations. Please try again."));
      setLink(data.acceptUrl || "");
      setNotice(data.acceptUrl ? t("Share this link privately. No email was sent. The link expires in seven days.") : t("Invitation revoked."));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not update invitations. Please try again."));
    } finally {
      setPending(false);
    }
  }

  return <div className="grid gap-6">
    <section className="rounded-2xl border border-line bg-paper p-6">
      <form action={async (data) => { await mutate("/api/admin/invitations", "POST", String(data.get("email"))); }} className="flex flex-wrap items-end gap-4">
        <Field label={t("Recipient email")} className="min-w-0 flex-1">
          <Input type="email" name="email" required maxLength={254} disabled={pending} autoComplete="off" />
        </Field>
        <Button type="submit" disabled={pending}>{t("Create invitation")}</Button>
      </form>
      {notice && <p role="status" className="mt-4 text-meta text-pine-dark">{notice}</p>}
      {link && <div className="mt-4 grid gap-3">
        <Field label={t("One-time invitation link")}><Input value={link} readOnly onFocus={(event) => event.target.select()} /></Field>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={async () => {
            try { await navigator.clipboard.writeText(link); setNotice(t("Invitation link copied.")); }
            catch { setError(t("Clipboard access failed. Select and copy the link manually.")); }
          }}>{t("Copy link")}</Button>
          <Button type="button" variant="ghost" onClick={() => setLink("")}>{t("Hide link")}</Button>
        </div>
      </div>}
      {error && <p role="alert" className="mt-4 text-meta text-coral">{error}</p>}
    </section>
    <section className="rounded-2xl border border-line bg-paper p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">{t("Invitation history")}</h2>
        <Button variant="ghost" disabled={pending} onClick={async () => {
          setPending(true); setError("");
          try { await load(); } catch { setError(t("Could not load invitations.")); }
          finally { setLoading(false); setPending(false); }
        }}>{t("Refresh")}</Button>
      </div>
      {loading ? <p role="status">{t("Loading…")}</p> : !invitations.length ? <p className="text-muted">{t("No invitations yet.")}</p> : <ul className="grid gap-3">
        {invitations.map((invitation) => <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
          <div className="min-w-0"><strong className="block break-all text-ui">{invitation.email}</strong>
            <span className="text-meta text-muted">{t(invitation.status)} · {t("Expires")} {new Date(invitation.expiresAt).toLocaleDateString()}</span></div>
          {invitation.status !== "accepted" && <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={pending} onClick={() => void mutate(`/api/admin/invitations/${invitation.id}`, "POST")}>{t("Replace link")}</Button>
            {invitation.status !== "revoked" && <Button variant="ghost" size="sm" disabled={pending} onClick={() => void mutate(`/api/admin/invitations/${invitation.id}`, "DELETE")}>{t("Revoke")}</Button>}
          </div>}
        </li>)}
      </ul>}
    </section>
  </div>;
}
