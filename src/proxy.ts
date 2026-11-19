import { NextResponse, type NextRequest } from "next/server";
import { isAllowedMumaaEmail } from "@/lib/auth/allowed-email";
import { readAuthSession } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const isPrivateRoute = /^\/(home|diary|memories|events|ideas|time-capsules|trading)(\/|$)/.test(
    request.nextUrl.pathname,
  );
  const session = await readAuthSession(request.cookies.get("mumaa_session")?.value);

  if (session && !isAllowedMumaaEmail(session.email)) {
    const response = NextResponse.redirect(new URL("/login?error=not-allowed", request.url));
    response.cookies.delete("mumaa_session");
    return response;
  }

  if (!session && isPrivateRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
