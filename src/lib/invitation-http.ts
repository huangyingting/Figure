import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auth } from "@/auth";
import { AdmissionError, requireAdministrator } from "@/lib/account-admission";
import { BodyTooLargeError } from "@/lib/http";
import { getApplicationConfig } from "@/lib/config";
import { requestTranslator } from "@/lib/i18n-shared";

export async function invitationRequest(request: Request, action: (userId: string) => Promise<unknown>) {
  const t = requestTranslator(request);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  try {
    await requireAdministrator(session.user.id);
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(getApplicationConfig().siteUrl).origin) {
        throw new AdmissionError(403, "Invalid invitation request.");
      }
    }
    return NextResponse.json(await action(session.user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdmissionError) return NextResponse.json({ error: t(error.message) }, { status: error.status });
    if (error instanceof BodyTooLargeError || error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: t("Invalid invitation request.") }, { status: error instanceof BodyTooLargeError ? 413 : 400 });
    }
    console.error("Invitation management failed", error);
    return NextResponse.json({ error: t("Could not update invitations. Please try again.") }, { status: 500 });
  }
}
