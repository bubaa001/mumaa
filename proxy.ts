import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, getSupabasePublicEnv } from "@/lib/supabase/env";
import { isAllowedMumaaEmail } from "@/lib/auth/allowed-email";

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  const response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isPrivateRoute = /^\/(home|diary|memories|events|ideas|time-capsules)(\/|$)/.test(
    request.nextUrl.pathname,
  );

  if (user && !isAllowedMumaaEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not-allowed", request.url));
  }

  if (!user && isPrivateRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
