import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isAppRoute = req.nextUrl.pathname.startsWith("/dashboard") || req.nextUrl.pathname.startsWith("/logbook");
  const isAuthRoute = req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/register";

  if (isAppRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/logbook/:path*", "/login", "/register"],
};
