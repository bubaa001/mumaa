import { jwtVerify, SignJWT } from "jose";

const sessionSecret = process.env.AUTH_SESSION_SECRET;

function getSessionSecret() {
  if (!sessionSecret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }

  return new TextEncoder().encode(sessionSecret);
}

export type AuthSession = {
  email: string;
  name: string;
  picture?: string;
  googleSubject: string;
};

export async function createAuthSession(session: AuthSession) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

export async function readAuthSession(token: string | undefined) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.googleSubject !== "string"
    ) {
      return null;
    }

    return {
      email: payload.email,
      name: payload.name,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
      googleSubject: payload.googleSubject,
    } satisfies AuthSession;
  } catch {
    return null;
  }
}
