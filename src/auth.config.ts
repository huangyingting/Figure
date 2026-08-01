import type { NextAuthConfig } from "next-auth";

/** Edge-safe subset shared by the middleware gate and the full Node.js auth setup. */
export const authConfig = {
  providers: [],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/signin" },
} satisfies NextAuthConfig;

export const protectedRoutes = ["/library", "/collections", "/credits", "/account", "/favorites"];
export const guestOnlyRoutes = ["/signin", "/register"];

export function isMatch(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function safeCallbackUrl(value: string | null | undefined, fallback = "/library") {
  if (!value || !value.startsWith("/")) return fallback;
  // Reject protocol-relative and backslash-escaped forms; URL parsers treat
  // "//host", "/\host" and "/\\host" as off-origin absolute URLs.
  if (/^\/[/\\]/.test(value)) return fallback;
  return value;
}
