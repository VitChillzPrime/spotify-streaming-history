"use client";

import { Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarList } from "@/components/charts/bar-list";
import { Meter } from "@/components/charts/parts";
import { useOpenSettings } from "@/components/dashboard/settings-context";
import { useSpotify } from "@/components/spotify/use-spotify";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { artworkUri } from "@/lib/artwork";
import { formatDuration, formatNumber, plural } from "@/lib/format";
import { aggregateGenres, artistCache, artistKey } from "@/lib/spotify/artists";
import type { Scope } from "@/lib/stats/scope";
import { rank } from "@/lib/stats/top";

const ARTISTS = 40;

interface GenresState {
  key: string;
  done: number;
  result: ReturnType<typeof aggregateGenres> | null;
  failed: boolean;
}

/** Your top genres, from Spotify's genre tags for your most played artists in the range. */
export function GenresCard({ scope }: { scope: Scope }) {
  const { connected, clientId } = useSpotify();
  const openSettings = useOpenSettings();
  const { ds } = scope.p;

  const artists = useMemo(
    () =>
      rank(scope, "artist", "time")
        .slice(0, ARTISTS)
        .map((entry) => ({
          name: ds.artists[entry.id],
          ms: entry.ms,
          uri: artworkUri(ds, { type: "artist", id: entry.id }),
        })),
    [scope, ds],
  );
  const key = useMemo(() => artists.map((a) => `${a.name}:${Math.round(a.ms)}`).join("|"), [artists]);
  const [state, setState] = useState<GenresState | null>(null);

  useEffect(() => {
    if (!connected || artists.length === 0) return;
    let cancelled = false;
    let done = 0;
    Promise.all(
      artists.map(async (artist) => {
        const info = artist.uri ? await artistCache.load(artistKey(artist.name, artist.uri)) : null;
        done++;
        if (!cancelled) setState((s) => ({ key, done, result: s?.key === key ? s.result : null, failed: false }));
        return info ? { name: artist.name, ms: artist.ms, genres: info.genres } : null;
      }),
    ).then((infos) => {
      if (cancelled) return;
      const found = infos.filter((info) => info !== null);
      setState({ key, done: artists.length, result: aggregateGenres(found), failed: found.length === 0 });
    });
    return () => {
      cancelled = true;
    };
  }, [connected, artists, key]);

  // The feature needs a Spotify app; hide it entirely when none is set up.
  if (!connected && !clientId) return null;

  if (!connected) {
    return (
      <Card className="mt-4">
        <CardBody className="flex flex-wrap items-center gap-4 pt-5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink">
            <Tags className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">See your top genres</p>
            <p className="text-[13px] text-ink-3">Connect Spotify to tag your top artists with genres and show their photos.</p>
          </div>
          <Button onClick={() => openSettings("spotify")}>Connect Spotify</Button>
        </CardBody>
      </Card>
    );
  }

  const current = state?.key === key ? state : null;
  const loading = !current?.result && !current?.failed;

  return (
    <Card className="mt-4">
      <CardHeader title="Top genres" description={`From Spotify's tags for your top ${formatNumber(artists.length)} artists in this range`} />
      <CardBody>
        {loading ? (
          <div className="max-w-sm py-2" role="status">
            <p className="text-[13px] text-ink-3">
              Looking up artists on Spotify: {formatNumber(current?.done ?? 0)} of {formatNumber(artists.length)}
            </p>
            <Meter value={(current?.done ?? 0) / Math.max(1, artists.length)} className="mt-2" />
          </div>
        ) : current?.failed || !current?.result?.genres.length ? (
          <p className="py-2 text-[13px] text-ink-3">
            {current?.failed
              ? "Couldn't reach Spotify for these artists. Try again later."
              : "Spotify has no genres for these artists. It has stopped tagging many artists."}
          </p>
        ) : (
          <>
            <BarList
              columns={2}
              items={current.result.genres.map((genre) => ({
                key: genre.genre,
                label: <span className="capitalize">{genre.genre}</span>,
                value: genre.ms,
                display: formatDuration(genre.ms),
                hint: plural(genre.artists.length, "artist"),
              }))}
            />
            {current.result.unclassified > 0 && (
              <p className="mt-4 text-xs text-ink-3">
                Spotify has no genres for {plural(current.result.unclassified, "of these artists", "of these artists")}.
                An artist&rsquo;s time counts toward each of its genres.
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
