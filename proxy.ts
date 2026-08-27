import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.edge";

// /org-invite/accept must stay public: it needs to run its own logic for a
// logged-out visitor (log in vs. "you have no platform account yet" - see
// app/org-invite/accept/page.tsx) rather than being redirected to /login
// unconditionally, which would be a dead end for someone with no account.
const PUBLIC_PATHS = new Set(["/login", "/signup", "/verify-email", "/org-invite/accept"]);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isPublicPage = PUBLIC_PATHS.has(req.nextUrl.pathname);
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!isLoggedIn && !isPublicPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    const settingsUrl = new URL("/settings", req.nextUrl.origin);
    return NextResponse.redirect(settingsUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/mcp|api/sse|api/message|api/oauth|\\.well-known|_next/static|_next/image|favicon.ico).*)",
  ],
};
