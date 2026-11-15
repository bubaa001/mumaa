import { NextResponse } from "next/server";
import { getGoogleConfig } from "@/lib/auth/google";

export async function GET(request: Request) {
  try {
    const { clientId, redirectUri } = getGoogleConfig();
    const state = crypto.randomUUID();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("prompt", "select_account");

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("mumaa_google_state", state, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=configuration", request.url));
  }
}
