import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTrack } from "@/lib/spotify/api";
import { aggregateGenres } from "@/lib/spotify/artists";
import { finishLogin, sessionStore } from "@/lib/spotify/auth";
import { loginBlocker } from "@/lib/spotify/config";
import { base64Url, codeChallenge, randomString } from "@/lib/spotify/pkce";
import { playlistBatches } from "@/lib/spotify/playlists";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

describe("PKCE", () => {
  it("matches the RFC 7636 test vector", async () => {
    expect(await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
    expect(base64Url(new Uint8Array([251, 255]))).toBe("-_8");
  });

  it("makes verifiers from unreserved URL characters", () => {
    const verifier = randomString(64);
    expect(verifier).toHaveLength(64);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(randomString(64)).not.toBe(verifier);
  });
});

describe("loginBlocker", () => {
  it("explains Spotify's redirect URI rules", () => {
    expect(loginBlocker({ hostname: "localhost", protocol: "http:", port: "3000" })).toMatch(/127\.0\.0\.1:3000/);
    expect(loginBlocker({ hostname: "127.0.0.1", protocol: "http:", port: "3000" })).toBeNull();
    expect(loginBlocker({ hostname: "encore.example", protocol: "https:", port: "" })).toBeNull();
    expect(loginBlocker({ hostname: "encore.example", protocol: "http:", port: "" })).toMatch(/HTTPS/);
  });
});

describe("playlistBatches", () => {
  it("keeps playable items once, in order, 100 per request", () => {
    const uris = Array.from({ length: 230 }, (_, i) => `spotify:track:t${i}`);
    const batches = playlistBatches([...uris, "spotify:track:t0", "spotify:local:x:y:z:1", "", "nope"]);
    expect(batches.map((b) => b.length)).toEqual([100, 100, 30]);
    expect(batches[0][0]).toBe("spotify:track:t0");
    expect(batches.flat()).toHaveLength(230);
  });
});

describe("aggregateGenres", () => {
  it("ranks genres by their artists' listening time", () => {
    const { genres, unclassified } = aggregateGenres([
      { name: "A", ms: 100, genres: ["Rap", "hip hop"] },
      { name: "B", ms: 50, genres: ["hip hop"] },
      { name: "C", ms: 500, genres: [] },
      { name: "D", ms: 10, genres: ["pop"] },
    ]);
    expect(genres.map((g) => [g.genre, g.ms, g.artists.length])).toEqual([
      ["hip hop", 150, 2],
      ["rap", 100, 1],
      ["pop", 10, 1],
    ]);
    expect(unclassified).toBe(1);
  });
});

describe("Spotify session and API", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("localStorage", memoryStorage());
    sessionStore.set(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects callbacks that don't match the login this browser started", async () => {
    storage.setItem(
      "encore-spotify-pending",
      JSON.stringify({ verifier: "v", state: "expected", clientId: "c", redirectUri: "http://127.0.0.1:3000/callback", returnTo: "/" }),
    );
    await expect(finishLogin(new URLSearchParams("code=abc&state=forged"))).rejects.toThrow(/expired/);
    await expect(finishLogin(new URLSearchParams("error=access_denied"))).rejects.toThrow(/cancelled/);
  });

  it("exchanges the code with the PKCE verifier and stores the session", async () => {
    storage.setItem(
      "encore-spotify-pending",
      JSON.stringify({ verifier: "the-verifier", state: "s1", clientId: "client", redirectUri: "http://127.0.0.1:3000/callback", returnTo: "/dashboard/artists" }),
    );
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = new URLSearchParams(init?.body as string);
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code_verifier")).toBe("the-verifier");
      expect(body.get("client_id")).toBe("client");
      return json({ access_token: "token-1", refresh_token: "refresh-1", expires_in: 3600 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(finishLogin(new URLSearchParams("code=abc&state=s1"))).resolves.toBe("/dashboard/artists");
    expect(sessionStore.get()).toMatchObject({ accessToken: "token-1", refreshToken: "refresh-1", clientId: "client" });
    expect(storage.getItem("encore-spotify-pending")).toBeNull();
  });

  it("refreshes on 401 and waits out 429s", async () => {
    sessionStore.set({ accessToken: "old", refreshToken: "r", expiresAt: Date.now() + 3_600_000, clientId: "client" });
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const auth = new Headers(init?.headers).get("Authorization");
        calls.push(`${url.includes("/api/token") ? "token" : "api"}:${auth ?? ""}`);
        if (url.includes("/api/token")) return json({ access_token: "new", expires_in: 3600 });
        if (auth === "Bearer old") return json({ error: { message: "expired" } }, 401);
        if (calls.filter((c) => c === "api:Bearer new").length === 1) return json({}, 429, { "Retry-After": "0" });
        return json({ id: "t1", artists: [], album: { artists: [], images: [] } });
      }),
    );
    await expect(getTrack("t1")).resolves.toMatchObject({ id: "t1" });
    expect(calls).toEqual(["api:Bearer old", "token:", "api:Bearer new", "api:Bearer new"]);
    expect(sessionStore.get()?.refreshToken).toBe("r");
  });
});
