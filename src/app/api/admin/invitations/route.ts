import { accountEmail, invitationStatus, issueInvitation } from "@/lib/account-admission";
import { readJson } from "@/lib/http";
import { invitationRequest } from "@/lib/invitation-http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  return invitationRequest(request, async () => {
    const invitations = await prisma.accountInvitation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, email: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true },
    });
    return { invitations: invitations.map((invitation) => ({ ...invitation, status: invitationStatus(invitation) })) };
  });
}

export async function POST(request: Request) {
  return invitationRequest(request, async (userId) => {
    const body = await readJson(request, 4096);
    const email = accountEmail.parse(body && typeof body === "object" && "email" in body ? body.email : null);
    return issueInvitation(userId, email);
  });
}
