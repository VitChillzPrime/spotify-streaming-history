"use client";

import { Check, Copy, ExternalLink, LogOut, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useSpotify, useSpotifyProfile } from "@/components/spotify/use-spotify";
import { Button, buttonClass } from "@/components/ui/button";
import { beginLogin, signOut } from "@/lib/spotify/auth";
import { loginBlocker, redirectUri } from "@/lib/spotify/config";

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2">{value}</code>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          await navigator.clipboard?.writeText(value).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/** Settings section for connecting Spotify (artist photos, genres, playlists). */
export function SpotifyPanel() {
  const { clientId, customClientId, setCustomClientId, connected } = useSpotify();
  const profile = useSpotifyProfile();
  const [draft, setDraft] = useState(customClientId);
  const [editing, setEditing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const blocker = loginBlocker();

  if (connected) {
    const avatar = profile?.images?.[0]?.url;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
          {avatar ? (
            <Image src={avatar} alt="" width={36} height={36} unoptimized className="size-9 rounded-full object-cover" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-accent-wash text-sm font-semibold text-accent-ink">
              {(profile?.display_name ?? "S").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">
              Connected{profile?.display_name ? ` as ${profile.display_name}` : ""}
            </p>
            <p className="text-xs text-ink-3">Artist photos, top genres and playlist saving are on.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={signOut}>
            <LogOut /> Disconnect
          </Button>
        </div>
        <p className="text-xs leading-5 text-ink-3">
          Encore can only create private playlists in your account. Remove its access anytime from your Spotify account&rsquo;s
          Apps page.
        </p>
      </div>
    );
  }

  const setUp = clientId !== null && !editing;

  return (
    <div className="space-y-4">
      {setUp ? (
        <>
          {blocker && (
            <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs leading-5 text-ink-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
              {blocker}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={Boolean(blocker) || connecting}
              onClick={async () => {
                setConnecting(true);
                await beginLogin(clientId, window.location.pathname);
              }}
            >
              {connecting ? "Opening Spotify…" : "Connect Spotify"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(customClientId);
                setEditing(true);
              }}
            >
              {customClientId ? "Change Client ID" : "Use my own Client ID"}
            </Button>
          </div>
        </>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setCustomClientId(draft.trim());
            setEditing(false);
          }}
        >
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-5 text-ink-2">
            <li>
              Open the{" "}
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-ink hover:underline"
              >
                Spotify Developer Dashboard
              </a>{" "}
              and create an app (it needs a Premium account).
            </li>
            <li>Add this Redirect URI and tick &ldquo;Web API&rdquo;:</li>
          </ol>
          <CopyField value={redirectUri()} />
          <ol start={3} className="list-decimal space-y-1.5 pl-5 text-[13px] leading-5 text-ink-2">
            <li>Paste the app&rsquo;s Client ID here.</li>
          </ol>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Spotify Client ID</span>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Client ID"
                spellCheck={false}
                autoComplete="off"
                className="h-9 w-full rounded-xl border border-line bg-surface-2 px-3 font-mono text-xs text-ink"
              />
            </label>
            <Button type="submit" disabled={!/^[0-9a-f]{32}$/i.test(draft.trim()) && draft.trim() !== ""}>
              Save
            </Button>
            {editing && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
          <p className="text-xs leading-5 text-ink-3">
            Spotify limits Development Mode apps to 5 accounts, which you allowlist in the app&rsquo;s User
            Management. The Client ID isn&rsquo;t secret and stays in this browser.
          </p>
        </form>
      )}
      <a
        href="https://developer.spotify.com/documentation/web-api/concepts/quota-modes"
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("ghost", "sm", "-ml-3 text-ink-3")}
      >
        <ExternalLink /> About Spotify&rsquo;s app limits
      </a>
    </div>
  );
}
