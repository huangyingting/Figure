import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { clientIp, peekRateLimit, rateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

const providers = [
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw, request) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      // Throttle brute force by source IP before touching the database.
      const ip = clientIp(request);
      if (!rateLimit(`login:ip:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 }).allowed) return null;
      // Block once too many FAILED attempts target one email; successful logins
      // do not consume the budget (checked without incrementing on success).
      const emailKey = `login:email:${parsed.data.email}`;
      if (peekRateLimit(emailKey, 5) === false) return null;
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) {
        rateLimit(emailKey, { limit: 5, windowMs: 15 * 60 * 1000 });
        return null;
      }
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET, allowDangerousEmailAccountLinking: true })]
    : []),
  ...(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET
    ? [Facebook({ clientId: process.env.AUTH_FACEBOOK_ID, clientSecret: process.env.AUTH_FACEBOOK_SECRET, allowDangerousEmailAccountLinking: true })]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      if (!token.userId && token.email) {
        token.userId = (await prisma.user.findUnique({ where: { email: token.email }, select: { id: true } }))?.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") {
        const account = await prisma.user.findUnique({
          where: { id: token.userId },
          select: { id: true, credits: true },
        });
        if (account) {
          session.user.id = account.id;
          session.user.credits = account.credits;
        }
      }
      return session;
    },
  },
});

export function configuredSocialProviders() {
  return {
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    facebook: Boolean(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET),
  };
}
