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

/** Maps an Auth.js `?error=` code to a user-facing sign-in message. */
export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "OAuthAccountNotLinked":
      return "That email is already registered with a password. Sign in with your password to continue.";
    case "OAuthCallbackError":
    case "OAuthSignInError":
    case "Callback":
      return "We couldn't complete that social sign-in. Please try again.";
    case "AccessDenied":
      return "Access was denied. Please try a different account.";
    case "Configuration":
      return "Social sign-in is temporarily unavailable. Please try again shortly.";
    case "Verification":
      return "That sign-in link is no longer valid. Please try again.";
    default:
      return "Something went wrong during sign-in. Please try again.";
  }
}
