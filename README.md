# Encore

A private, in-browser dashboard for your Spotify streaming history. Drop in the
data export Spotify emails you and explore every play: top artists, tracks and
albums, when and how you listen, streaks, eras, and a review of every year.

Nothing is uploaded. The export is unzipped and parsed in your browser, and the
results are stored in your browser's IndexedDB. Anyone can use it with their own
data.

## Features

- **Overview**: total listening time, streams, top artists/tracks/albums, highlights
  (biggest day, longest streak, longest session, peak hour, songs on repeat).
- **Year in review**: a recap of every year in your history, compared by daily average.
- **Top artists, tracks, albums, podcasts and audiobooks**: ranked by time or streams,
  with share, trend sparklines and first-listen dates. Click any name for a detail sheet.
- **Listening clock**: listening over time, time of day, day of week, a weekday × hour
  heatmap, a calendar for each year and month-by-month comparisons.
- **Habits**: skip, shuffle and offline rates over time, most/never skipped songs, how plays
  start and end, session lengths, devices and countries.
- **Discovery**: new artists and songs over time, variety, biggest discoveries, your top
  artist of every month, single-day obsessions, forgotten favourites and loyal artists.
- **History**: every play, searchable (accent-insensitive) and paginated.
- Filters for any year, recent period or custom range, and for music / podcasts / audiobooks.
- Light and dark themes that override the system setting (or follow it).
- Settings for time zone (Spotify records plays in UTC) and what counts as a stream (30 s by default).

Sections only appear when your export has the data for them: audiobooks, video, podcasts,
skips, devices and countries all depend on what Spotify included.

## Getting your data

1. Open [Spotify's privacy settings](https://www.spotify.com/account/privacy/) and request
   **Extended streaming history** (your whole history, with skips, devices and more).
   **Account data** also works, but only covers about the last year.
2. Wait for Spotify's email. It can take a few days, sometimes up to 30.
3. Open the app and drop in `my_spotify_data.zip`, the JSON files inside it, or the
   unzipped folder.

Supported files: `Streaming_History_Audio_*.json`, `Streaming_History_Video_*.json`, older
`endsong_*.json`, and the basic export's `StreamingHistory*.json`. When both exports are
imported together, the extended history wins for the dates it covers.

## Privacy

- Files are processed in a Web Worker on your device; there is no backend.
- IP addresses, usernames and user agents in the export are never read or stored.
- Monograms stand in for album art, because fetching artwork would send your history to a third party.
- Delete everything from **Settings → Your data**.

> Personal exports (`*.zip`, extracted export folders) are gitignored. Never commit real listening data.

## Development

Requires Node.js 20.9+.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run lint
npm run build    # static production build
```

Every route is statically prerendered, so the build can be deployed to any static or
Next.js host (for example Vercel).

### How it works

- `lib/ingest/`: reads zips with the browser's native `DecompressionStream` (falling back to
  fflate), detects the export format, and builds a **columnar dataset**: one typed array per
  field, with names stored once in dictionaries. It de-duplicates repeated rows and runs in a
  Web Worker (`import.worker.ts`).
- `lib/storage.ts`: saves the dataset to IndexedDB (a few MB for years of history).
- `lib/prepare.ts`: derives local start time, day and hour for the chosen time zone.
  Streams are sorted by start time, so any date range is a contiguous slice.
- `lib/stats/`: pure functions over a `Scope` (data, range, content filter, stream threshold).
  Results are memoized per scope in `lib/stats/cache.ts`.
- `components/charts/`: hand-built, accessible SVG charts. Each one has keyboard navigation,
  tooltips and a table view, using a colour-blind-safe palette.
- `app/`: the landing page and the `/dashboard/*` pages.

### Tests

`npm test` runs unit tests for parsing (every export shape, including audiobooks, video and
the basic export), time-zone handling and the statistics, using synthetic fixtures in
`lib/test-fixtures.ts`.

## Branches

- `main`: production.
- `preview`: staging. Feature branches (`feat/…`, `fix/…`) branch from `preview` and are merged into it
  by pull request, then `preview` is merged into `main`. Merged feature branches are deleted.

Encore isn't affiliated with Spotify. Spotify is a trademark of Spotify AB.
