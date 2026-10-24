import { AdmissionError, issueInvitation, revokeInvitation } from "@/lib/account-admission";
import { prisma } from "@/lib/prisma";
import { invitationRequest } from "@/lib/invitation-http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return invitationRequest(request, async (userId) => {
    const { id } = await context.params;
    const invitation = await prisma.accountInvitation.findUnique({ where: { id }, select: { email: true } });
    if (!invitation) throw new AdmissionError(404, "Invitation not found.");
    return issueInvitation(userId, invitation.email, id);
  });
}

export async function DELETE(request: Request, context: Context) {
  return invitationRequest(request, async (userId) => {
    await revokeInvitation(userId, (await context.params).id);
    return { ok: true };
  });
}
