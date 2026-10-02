import { jsonStore } from "@/lib/local-store";
import { redirectUri, SCOPES } from "@/lib/spotify/config";
import { codeChallenge, randomString } from "@/lib/spotify/pkce";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const PENDING_KEY = "encore-spotify-pending";

export interface SpotifySession {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  clientId: string;
}

function parseSession(value: unknown): SpotifySession | null {
  if (typeof value !== "object" || value === null) return null;
  const s = value as Record<string, unknown>;
  return typeof s.accessToken === "string" &&
    typeof s.refreshToken === "string" &&
    typeof s.expiresAt === "number" &&
    typeof s.clientId === "string"
    ? (s as unknown as SpotifySession)
    : null;
}

/** The signed-in session, kept in this browser only. */
export const sessionStore = jsonStore<SpotifySession | null>("encore-spotify-session", null, parseSession);

interface PendingLogin {
  verifier: string;
  state: string;
  clientId: string;
  redirectUri: string;
  returnTo: string;
}

export class SpotifyAuthError extends Error {
  name = "SpotifyAuthError";
}

/** Sends the browser to Spotify's consent screen. */
export async function beginLogin(clientId: string, returnTo: string): Promise<void> {
  const pending: PendingLogin = {
    verifier: randomString(64),
    state: randomString(24),
    clientId,
    redirectUri: redirectUri(),
    returnTo,
  };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES.join(" "),
    redirect_uri: pending.redirectUri,
    state: pending.state,
    code_challenge_method: "S256",
    code_challenge: await codeChallenge(pending.verifier),
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error_description?: string } | null;
    throw new SpotifyAuthError(detail?.error_description ?? `Spotify returned ${response.status}.`);
  }
  return (await response.json()) as TokenResponse;
}

function toSession(token: TokenResponse, clientId: string, previousRefresh = ""): SpotifySession {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? previousRefresh,
    expiresAt: Date.now() + token.expires_in * 1000,
    clientId,
  };
}

/** Completes the login on the callback page. Returns where to go next. */
export async function finishLogin(params: URLSearchParams): Promise<string> {
  const raw = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  const error = params.get("error");
  if (error) {
    throw new SpotifyAuthError(error === "access_denied" ? "You cancelled the Spotify login." : `Spotify login failed (${error}).`);
  }
  const pending = raw ? (JSON.parse(raw) as PendingLogin) : null;
  const code = params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) {
    throw new SpotifyAuthError("This login link expired or didn't come from this browser. Please connect again.");
  }
  const token = await requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: pending.redirectUri,
    client_id: pending.clientId,
    code_verifier: pending.verifier,
  });
  sessionStore.set(toSession(token, pending.clientId));
  return pending.returnTo;
}

let refreshing: Promise<string | null> | null = null;

/** A valid access token, refreshed when it's about to expire; null when signed out. */
export async function accessToken(forceRefresh = false): Promise<string | null> {
  const session = sessionStore.get();
  if (!session) return null;
  if (!forceRefresh && Date.now() < session.expiresAt - 60_000) return session.accessToken;
  refreshing ??= requestToken({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
    client_id: session.clientId,
  })
    .then((token) => {
      const next = toSession(token, session.clientId, session.refreshToken);
      sessionStore.set(next);
      return next.accessToken;
    })
    .catch(() => {
      // The refresh token was revoked or expired: sign out cleanly.
      sessionStore.set(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export function signOut() {
  sessionStore.set(null);
}
