import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Paths that never require authentication
const publicPaths = ["/login", "/api/auth"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return publicPaths.some((p) => pathname.startsWith(p));
}

export default auth((req: NextRequest & { auth?: unknown }) => {
  const { pathname } = req.nextUrl;

  // Dev/testing bypass: skip all auth checks when AUTH_DISABLED=true
  if (process.env.AUTH_DISABLED === "true") {
    return NextResponse.next();
  }

  // Allow public paths through (includes /api/auth/sso/callback)
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Protect /dashboard/* — redirect unauthenticated users
  if (!req.auth) {
    // In production with SSO, redirect to main app login
    const mainAppUrl = process.env.MAIN_APP_URL;
    if (mainAppUrl) {
      const suiteReturnUrl = new URL(pathname, req.url).toString();
      const loginUrl = new URL("/auth/login", mainAppUrl);
      loginUrl.searchParams.set("returnTo", suiteReturnUrl);
      return NextResponse.redirect(loginUrl);
    }

    // Fallback: redirect to local login (dev/standalone mode)
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
