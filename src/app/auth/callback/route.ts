import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAllowedMumaaEmail } from "@/lib/auth/allowed-email";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=sign-in", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAllowedMumaaEmail(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not-allowed", request.url));
  }

  return NextResponse.redirect(new URL("/home", request.url));
}
