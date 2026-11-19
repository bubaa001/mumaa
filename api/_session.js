import { jwtVerify } from "jose";

// Files starting with "_" are not deployed as functions; this is shared by the
// legacy graduation endpoints so they only answer Anna and Joshua.
const allowedEmails = new Set(["joshuajohnr1@gmail.com", "annacelestial001@gmail.com"]);

function readCookie(header, name) {
  for (const part of (header || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export async function isSignedIn(request) {
  const secret = process.env.AUTH_SESSION_SECRET;
  const token = readCookie(request.headers.cookie, "mumaa_session");
  if (!secret || !token) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return typeof payload.email === "string" && allowedEmails.has(payload.email.toLowerCase());
  } catch {
    return false;
  }
}
