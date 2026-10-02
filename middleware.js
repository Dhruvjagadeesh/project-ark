import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Page-level role access
const access = {
  "/users": ["ADMIN"],
  "/rescues": ["ADMIN", "FOREST_OFFICER", "VET_OFFICER"],
  "/animals": ["ADMIN", "VET_OFFICER", "FOREST_OFFICER"],
};

export default withAuth(function middleware(req) {
  const role = req.nextauth.token?.role;
  const rule = Object.entries(access).find(([p]) => req.nextUrl.pathname.startsWith(p));
  if (rule && !rule[1].includes(role)) return NextResponse.redirect(new URL("/dashboard?denied=1", req.url));
});

export const config = { matcher: ["/dashboard/:path*", "/species/:path*", "/sightings/:path*", "/rescues/:path*", "/animals/:path*", "/research/:path*", "/users/:path*"] };
