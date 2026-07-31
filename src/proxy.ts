import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig, guestOnlyRoutes, isMatch, protectedRoutes, safeCallbackUrl } from "@/auth.config";

// Gating here keeps redirect() out of the server components, so a signed-out
// navigation never renders (and never aborts) the page it is not allowed to see.
const { auth } = NextAuth(authConfig);

export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.auth?.user);

  if (!signedIn && isMatch(pathname, protectedRoutes)) {
    const url = new URL("/signin", request.nextUrl);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (signedIn && isMatch(pathname, guestOnlyRoutes)) {
    const target = safeCallbackUrl(request.nextUrl.searchParams.get("callbackUrl"));
    return NextResponse.redirect(new URL(target, request.nextUrl));
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: ["/library/:path*", "/collections/:path*", "/quiz/:path*", "/credits/:path*", "/account/:path*", "/favorites/:path*", "/signin", "/register"],
};
