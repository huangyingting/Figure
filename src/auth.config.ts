import type { NextAuthConfig } from "next-auth";

/** Edge-safe subset shared by the middleware gate and the full Node.js auth setup. */
export const authConfig = {
  providers: [],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/signin" },
} satisfies NextAuthConfig;

export const protectedRoutes = ["/library", "/collections", "/quiz", "/credits", "/account"];
export const guestOnlyRoutes = ["/signin", "/register"];

export function isMatch(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function safeCallbackUrl(value: string | null | undefined, fallback = "/library") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
