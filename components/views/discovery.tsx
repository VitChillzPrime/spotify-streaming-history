"use client";

import { Compass } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { ColumnChart } from "@/components/charts/column-chart";
import { Meter } from "@/components/charts/parts";
import { bucketLabel, timeTicks } from "@/components/charts/time-axis";
import { TimeChart } from "@/components/charts/time-chart";
import { useWidth } from "@/components/charts/use-width";
import { PageHeader, SectionTitle } from "@/components/dashboard/page-header";
import { useEntitySheet } from "@/components/dashboard/sheet-context";
import { useScope } from "@/components/dashboard/use-scope";
import { SavePlaylistButton } from "@/components/spotify/save-playlist";
import { EntityArt } from "@/components/ui/entity-art";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Stat } from "@/components/ui/stat";
import { formatDay, formatDuration, formatMonth, formatMonthLong, formatNumber, formatPercent } from "@/lib/format";
import { discoveries, discoveryTimeline, eras, forgottenFavorites, loyalty } from "@/lib/stats/discovery";
import { repeats } from "@/lib/stats/records";
import { cached } from "@/lib/stats/cache";
import { KINDS, withKinds } from "@/lib/stats/scope";
import { cn } from "@/lib/ui";

export function DiscoveryView() {
  const base = useScope();
  const scope = useMemo(() => withKinds(base, KINDS.music), [base]);
  const { ds } = scope.p;
  const open = useEntitySheet();
  const [chartRef, chartWidth] = useWidth<HTMLDivElement>();
  const [newKind, setNewKind] = useState<"artists" | "songs">("artists");
  const [allEras, setAllEras] = useState(false);

  const data = useMemo(() => cached(scope, "discovery", () => {
    const timeline = discoveryTimeline(scope);
    return {
      timeline,
      newArtists: timeline.newArtists.reduce((a, b) => a + b, 0),
      newSongs: timeline.newSongs.reduce((a, b) => a + b, 0),
      avgArtists: timeline.artists.length ? timeline.artists.reduce((a, b) => a + b, 0) / timeline.artists.length : 0,
      artists: discoveries(scope, "artist", 12),
      songs: discoveries(scope, "song", 12),
      eras: eras(scope),
      repeats: repeats(scope, 8),
      forgotten: forgottenFavorites(scope),
      loyalty: loyalty(scope, 8),
    };
  }), [scope]);

  const { timeline } = data;
  const labels = useMemo(() => timeline.buckets.map((b) => bucketLabel(b, timeline.granularity)), [timeline]);
  const ticks = useMemo(
    () => timeTicks(timeline.buckets, timeline.granularity, Math.max(2, Math.floor((chartWidth - 60) / 72))),
    [timeline, chartWidth],
  );

  if (timeline.buckets.length === 0 || data.eras.length === 0) {
    return (
      <>
        <PageHeader title="Discovery" />
        <Card>
          <EmptyState icon={<Compass />} title="No music in this range" />
        </Card>
      </>
    );
  }

  const unit = timeline.granularity === "week" ? "week" : "month";
  const newValues = newKind === "artists" ? timeline.newArtists : timeline.newSongs;

  return (
    <>
      <PageHeader title="Discovery" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="New artists" value={formatNumber(data.newArtists)} detail="heard for the first time ever" />
        <Stat label="New songs" value={formatNumber(data.newSongs)} detail="first streamed in this range" />
        <Stat label={`Artists per ${unit}`} value={formatNumber(data.avgArtists)} detail="on average" />
        <Stat
          label="Most loyal"
          value={data.loyalty.artists[0] ? ds.artists[data.loyalty.artists[0].artist] : "n/a"}
          detail={
            data.loyalty.artists[0]
              ? `in ${data.loyalty.artists[0].periods} of ${data.loyalty.periods} months`
              : undefined
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`New ${newKind} per ${unit}`}
          description="First-ever streams across your whole history"
          action={
            <Segmented
              size="sm"
              label="Show"
              value={newKind}
              options={[
                { value: "artists", label: "Artists" },
                { value: "songs", label: "Songs" },
              ]}
              onChange={setNewKind}
            />
          }
          table={() => ({
            columns: [{ label: "Period" }, { label: "New artists", numeric: true }, { label: "New songs", numeric: true }],
            rows: labels.map((label, i) => [label, formatNumber(timeline.newArtists[i]), formatNumber(timeline.newSongs[i])]),
          })}
        >
          <div ref={chartRef}>
            <ColumnChart values={newValues} labels={labels} ticks={ticks} name={`New ${newKind}`} kind="count" height={240} />
          </div>
        </ChartCard>
        <ChartCard
          title="Variety"
          description={`Different artists you streamed each ${unit}`}
          table={() => ({
            columns: [{ label: "Period" }, { label: "Artists", numeric: true }, { label: "Songs", numeric: true }],
            rows: labels.map((label, i) => [label, formatNumber(timeline.artists[i]), formatNumber(timeline.songs[i])]),
          })}
        >
          <TimeChart
            values={timeline.artists}
            buckets={timeline.buckets}
            granularity={timeline.granularity}
            name="Artists"
            kind="count"
            height={240}
            note={(i) => `${formatNumber(timeline.songs[i])} different songs`}
          />
        </ChartCard>
      </div>

      {(data.artists.length > 0 || data.songs.length > 0) && (
        <>
          <SectionTitle description="First heard in this range, ranked by how much you've played them since">
            Biggest discoveries
          </SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Artists" />
              <CardBody className="pt-3">
                <ol className="-mx-2">
                  {data.artists.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => open({ type: "artist", id: d.id })}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2"
                      >
                        <EntityArt ds={ds} entity={{ type: "artist", id: d.id }} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">{ds.artists[d.id]}</span>
                          <span className="block truncate text-xs text-ink-3">
                            {formatDay(scope.p.day[d.first])} via “{ds.songs.name[ds.item[d.first]]}”
                          </span>
                        </span>
                        <span className="shrink-0 text-[13px] font-semibold text-ink tabular">{formatDuration(d.ms)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Songs" />
              <CardBody className="pt-3">
                <ol className="-mx-2">
                  {data.songs.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => open({ type: "song", id: d.id })}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2"
                      >
                        <EntityArt ds={ds} entity={{ type: "song", id: d.id }} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">{ds.songs.name[d.id]}</span>
                          <span className="block truncate text-xs text-ink-3">
                            {ds.artists[ds.songs.artist[d.id]]} · since {formatDay(scope.p.day[d.first])}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[13px] font-semibold text-ink tabular">{formatDuration(d.ms)}</span>
                          <span className="block text-xs text-ink-3 tabular">{formatNumber(d.plays)} streams</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <SectionTitle description="Your most played artist and song of every month">Eras</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...data.eras].reverse().slice(0, allEras ? undefined : 12).map((era) => (
          <button
            key={era.start}
            type="button"
            onClick={() => open({ type: "artist", id: era.artist })}
            className="group flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-surface-2"
          >
            <EntityArt ds={ds} entity={{ type: "artist", id: era.artist }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{formatMonth(era.start)}</span>
              <span className="block truncate text-sm font-semibold text-ink">{ds.artists[era.artist]}</span>
              <span className="block truncate text-xs text-ink-3">
                {formatPercent(era.artistMs / era.totalMs)} of the month · “{ds.songs.name[era.song]}”
              </span>
            </span>
          </button>
        ))}
      </div>

      {data.eras.length > 12 && (
        <div className="mt-4 flex justify-center">
          <Button onClick={() => setAllEras((value) => !value)}>
            {allEras ? "Show the last 12 months" : `Show all ${formatNumber(data.eras.length)} months`}
          </Button>
        </div>
      )}

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        <ListCard title="On repeat" description="The most streams of one song in a single day">
          {data.repeats.length === 0 ? (
            <Empty>No song was played 3+ times in one day.</Empty>
          ) : (
            data.repeats.map((r) => (
              <SongRow
                key={`${r.song}-${r.day}`}
                song={r.song}
                detail={formatDay(r.day)}
                value={`× ${formatNumber(r.plays)}`}
              />
            ))
          )}
        </ListCard>
        <ListCard
          title="Forgotten favourites"
          description="Played 10+ times, but not in the last 6 months of the range"
          action={
            data.forgotten.length > 0 && (
              <SavePlaylistButton
                available={ds.songs.uri.some((uri) => uri.startsWith("spotify:track:"))}
                label="Save"
                name="Encore · Forgotten favourites"
                description="Songs you loved but haven't played in a while. Made with Encore."
                uris={() => forgottenFavorites(scope, 180, 50).map((f) => ds.songs.uri[f.song])}
              />
            )
          }
        >
          {data.forgotten.length === 0 ? (
            <Empty>Nothing forgotten. You keep coming back.</Empty>
          ) : (
            data.forgotten.slice(0, 8).map((f) => (
              <SongRow key={f.song} song={f.song} detail={`Last played ${formatMonthLong(f.lastDay)}`} value={formatNumber(f.plays)} />
            ))
          )}
        </ListCard>
        <ListCard title="Loyal artists" description={`Streamed in the most of the ${formatNumber(data.loyalty.periods)} months`}>
          {data.loyalty.artists.map((l) => (
            <li key={l.artist}>
              <button
                type="button"
                onClick={() => open({ type: "artist", id: l.artist })}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2"
              >
                <EntityArt ds={ds} entity={{ type: "artist", id: l.artist }} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{ds.artists[l.artist]}</span>
                    <span className="shrink-0 text-xs text-ink-3 tabular">
                      {l.periods}/{data.loyalty.periods}
                    </span>
                  </span>
                  <Meter value={l.periods / Math.max(1, data.loyalty.periods)} className="mt-1.5 h-1" />
                </span>
              </button>
            </li>
          ))}
        </ListCard>
      </div>
    </>
  );
}

function ListCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      <CardBody className="pt-3">
        <ol className="-mx-2">{children}</ol>
      </CardBody>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <li className="px-2 py-6 text-center text-[13px] text-ink-3">{children}</li>;
}

function SongRow({ song, detail, value }: { song: number; detail: string; value: string }) {
  const scope = useScope();
  const open = useEntitySheet();
  const { ds } = scope.p;
  const artist = ds.artists[ds.songs.artist[song]];
  return (
    <li>
      <button
        type="button"
        onClick={() => open({ type: "song", id: song })}
        className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2")}
      >
        <EntityArt ds={ds} entity={{ type: "song", id: song }} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{ds.songs.name[song]}</span>
          <span className="block truncate text-xs text-ink-3">
            {artist} · {detail}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-ink tabular">{value}</span>
      </button>
    </li>
  );
}
