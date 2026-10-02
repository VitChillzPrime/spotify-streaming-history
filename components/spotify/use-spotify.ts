"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createResourceCache } from "@/lib/resource-cache";
import { getProfile, type Profile } from "@/lib/spotify/api";
import { sessionStore } from "@/lib/spotify/auth";
import { customClientIdStore, resolveClientId } from "@/lib/spotify/config";

/** Connection state: whether a Client ID is set up and whether the user is signed in. */
export function useSpotify() {
  const [session] = sessionStore.useValue();
  const [customClientId, setCustomClientId] = customClientIdStore.useValue();
  return {
    clientId: resolveClientId(customClientId),
    customClientId,
    setCustomClientId,
    connected: session !== null,
    session,
  };
}

const profiles = createResourceCache<Profile | null>(() => getProfile(), null);

/** The signed-in user's Spotify profile (display name and picture). */
export function useSpotifyProfile(): Profile | null {
  const { session } = useSpotify();
  // Keyed per session so reconnecting as someone else refetches.
  const key = session ? `${session.clientId}:${session.refreshToken.slice(0, 16)}` : null;
  const profile = useSyncExternalStore(
    profiles.subscribe,
    () => (key ? profiles.peek(key) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (key) void profiles.load(key);
  }, [key]);
  return profile ?? null;
}
