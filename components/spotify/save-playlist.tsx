"use client";

import { ExternalLink, ListMusic, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useSpotify } from "@/components/spotify/use-spotify";
import { Button, buttonClass } from "@/components/ui/button";
import { savePlaylist } from "@/lib/spotify/playlists";

type State = { status: "idle" } | { status: "saving" } | { status: "saved"; url: string } | { status: "error"; message: string };

/**
 * Saves a list of songs to a new private playlist in the user's Spotify
 * account. Renders nothing until Spotify is connected.
 */
export function SavePlaylistButton({
  name,
  description,
  uris,
  label = "Save as playlist",
  size = "sm",
  available = true,
}: {
  name: string;
  description: string;
  /** Called on click, so the list is built only when needed. */
  uris: () => string[];
  label?: string;
  size?: "sm" | "md";
  /** False when the export has no Spotify track links (the basic account-data export). */
  available?: boolean;
}) {
  const { connected } = useSpotify();
  const [state, setState] = useState<State>({ status: "idle" });
  if (!connected || !available) return null;

  if (state.status === "saved") {
    return (
      <a href={state.url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", size)}>
        <ExternalLink /> Open playlist
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size={size}
        disabled={state.status === "saving"}
        onClick={async () => {
          setState({ status: "saving" });
          try {
            setState({ status: "saved", url: await savePlaylist(name, description, uris()) });
          } catch (error) {
            setState({ status: "error", message: error instanceof Error ? error.message : "Couldn't save the playlist." });
          }
        }}
      >
        {state.status === "saving" ? <LoaderCircle className="animate-spin" /> : <ListMusic />}
        {state.status === "saving" ? "Saving…" : state.status === "error" ? "Try again" : label}
      </Button>
      {state.status === "error" && (
        <span role="alert" className="max-w-56 text-xs text-bad">
          {state.message}
        </span>
      )}
    </span>
  );
}
