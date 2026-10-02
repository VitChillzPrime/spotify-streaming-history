// Synthetic export rows for tests. Never put real listening history in fixtures.

export interface ExtendedRowInput {
  ts: string;
  ms?: number;
  track?: string | null;
  artist?: string | null;
  album?: string | null;
  uri?: string | null;
  episode?: string | null;
  show?: string | null;
  episodeUri?: string | null;
  book?: string | null;
  bookUri?: string | null;
  chapter?: string | null;
  chapterUri?: string | null;
  platform?: string;
  country?: string;
  reasonStart?: string;
  reasonEnd?: string;
  shuffle?: boolean | null;
  skipped?: boolean | null;
  offline?: boolean | null;
  incognito?: boolean | null;
}

/** A row shaped like `Streaming_History_Audio_*.json`. */
export function extendedRow(input: ExtendedRowInput): Record<string, unknown> {
  const isTrack = input.track !== undefined || input.uri !== undefined;
  return {
    ts: input.ts,
    platform: input.platform ?? "android",
    ms_played: input.ms ?? 180_000,
    conn_country: input.country ?? "GB",
    ip_addr: "203.0.113.7",
    master_metadata_track_name: isTrack ? (input.track ?? null) : null,
    master_metadata_album_artist_name: isTrack ? (input.artist ?? null) : null,
    master_metadata_album_album_name: isTrack ? (input.album ?? null) : null,
    spotify_track_uri: isTrack ? (input.uri ?? null) : null,
    episode_name: input.episode ?? null,
    episode_show_name: input.show ?? null,
    spotify_episode_uri: input.episodeUri ?? null,
    audiobook_title: input.book ?? null,
    audiobook_uri: input.bookUri ?? null,
    audiobook_chapter_uri: input.chapterUri ?? null,
    audiobook_chapter_title: input.chapter ?? null,
    reason_start: input.reasonStart ?? "trackdone",
    reason_end: input.reasonEnd ?? "trackdone",
    shuffle: input.shuffle === undefined ? false : input.shuffle,
    skipped: input.skipped === undefined ? false : input.skipped,
    offline: input.offline === undefined ? false : input.offline,
    offline_timestamp: 0,
    incognito_mode: input.incognito === undefined ? false : input.incognito,
  };
}

/** A row shaped like the basic export's `StreamingHistory_music_*.json`. */
export function basicMusicRow(endTime: string, artistName: string, trackName: string, msPlayed = 180_000) {
  return { endTime, artistName, trackName, msPlayed };
}

/** A row shaped like the basic export's `StreamingHistory_podcast_*.json`. */
export function basicPodcastRow(endTime: string, podcastName: string, episodeName: string, msPlayed = 1_800_000) {
  return { endTime, podcastName, episodeName, msPlayed };
}
