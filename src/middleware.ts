import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/api/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static files
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest")
  ) {
    return NextResponse.next();
  }

  // Check for password protection
  const hasPassword = process.env.APP_PASSWORD;
  if (!hasPassword) {
    return NextResponse.next(); // No password set → open access
  }

  const session = req.cookies.get("session")?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Verify JWT (lightweight check — full verification on API routes)
  try {
    const { jwtVerify } = await import("jose");
    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET ?? "mindtrace-default-secret-change-me"
    );
    await jwtVerify(session, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
