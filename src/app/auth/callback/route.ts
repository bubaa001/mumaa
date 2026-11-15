import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAllowedMumaaEmail } from "@/lib/auth/allowed-email";
import { createGoogleClient, getGoogleConfig } from "@/lib/auth/google";
import { createAuthSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get("mumaa_google_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/login?error=sign-in", request.url));
  }

  try {
    const { clientId } = getGoogleConfig();
    const googleClient = createGoogleClient();
    const { tokens } = await googleClient.getToken(code);

    if (!tokens.id_token) {
      return NextResponse.redirect(new URL("/login?error=sign-in", request.url));
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified || !isAllowedMumaaEmail(payload.email)) {
      return NextResponse.redirect(new URL("/login?error=not-allowed", request.url));
    }

    const sessionToken = await createAuthSession({
      email: payload.email,
      name: payload.name ?? payload.email,
      picture: payload.picture,
      googleSubject: payload.sub,
    });
    const response = NextResponse.redirect(new URL("/home", request.url));
    response.cookies.set("mumaa_session", sessionToken, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    response.cookies.delete("mumaa_google_state");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=not-allowed", request.url));
  }
}
