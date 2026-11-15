import { OAuth2Client } from "google-auth-library";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;

export function getGoogleConfig() {
  if (!googleClientId || !googleClientSecret || !googleRedirectUri) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.",
    );
  }

  return { clientId: googleClientId, clientSecret: googleClientSecret, redirectUri: googleRedirectUri };
}

export function createGoogleClient() {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}
