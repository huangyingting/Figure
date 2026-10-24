import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      credits: number;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    credits?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}
