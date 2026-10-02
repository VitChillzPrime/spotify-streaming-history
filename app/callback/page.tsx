import type { Metadata } from "next";
import { SpotifyCallback } from "@/components/spotify/callback";

export const metadata: Metadata = { title: "Connecting Spotify", robots: { index: false } };

export default function CallbackPage() {
  return <SpotifyCallback />;
}
