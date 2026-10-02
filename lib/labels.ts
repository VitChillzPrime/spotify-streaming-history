import { UNKNOWN } from "@/lib/model";

export type PlatformGroup =
  | "android"
  | "ios"
  | "windows"
  | "macos"
  | "linux"
  | "web"
  | "cast"
  | "speaker"
  | "tv"
  | "console"
  | "car"
  | "wearable"
  | "other"
  | "unknown";

export const PLATFORM_LABELS: Record<PlatformGroup, string> = {
  android: "Android",
  ios: "iPhone & iPad",
  windows: "Windows",
  macos: "Mac",
  linux: "Linux",
  web: "Web player",
  cast: "Chromecast",
  speaker: "Speakers",
  tv: "TV",
  console: "Game console",
  car: "Car",
  wearable: "Watch",
  other: "Other",
  unknown: "Unknown",
};

// Checked in order: "web_player windows 10;chrome" is the web player, not Windows,
// and "Android OS 9 (Sony, BRAVIA 4K)" is a TV, not a phone.
const PLATFORM_RULES: [RegExp, PlatformGroup][] = [
  [/web[_ ]?player|webplayer/i, "web"],
  [/chromecast|cast_|google[_ ]?cast/i, "cast"],
  [/android[_ ]?tv|smart[_ ]?tv|\btv\b|_tv\b|tizen|webos|roku|bravia|apple ?tv|tvos|fire ?tv|aftm|vizio|hisense/i, "tv"],
  [/playstation|\bps[345]\b|xbox/i, "console"],
  [/carplay|android[_ ]?auto|automotive|\bcar\b|tesla/i, "car"],
  [/watch|wear ?os|garmin|fitbit/i, "wearable"],
  [/sonos|echo|alexa|amazon|google[_ ]?home|nest|homepod|bose|denon|yamaha|harman|jbl|marantz|onkyo|speaker|partner/i, "speaker"],
  [/android/i, "android"],
  [/\bios\b|iphone|ipad|ipod/i, "ios"],
  [/windows|win32|win64/i, "windows"],
  [/os ?x|macos|mac ?os|macintosh|darwin/i, "macos"],
  [/linux|ubuntu|debian|fedora/i, "linux"],
];

export function platformGroup(raw: string): PlatformGroup {
  if (raw === UNKNOWN.platform) return "unknown";
  for (const [pattern, group] of PLATFORM_RULES) if (pattern.test(raw)) return group;
  return "other";
}

const START_REASONS: Record<string, string> = {
  trackdone: "Previous track finished",
  fwdbtn: "Skipped forward to it",
  backbtn: "Went back to it",
  clickrow: "Picked it from a list",
  playbtn: "Pressed play",
  appload: "App opened",
  remote: "Started from another device",
  trackerror: "Previous track failed",
  reconnect: "Reconnected",
  popup: "Opened from a popup",
  uriopen: "Opened from a link",
  persisted: "Resumed",
  clickside: "Picked from the sidebar",
  "switched-to-audio": "Switched to audio",
  "switched-to-video": "Switched to video",
  splitdelivery: "Continued playback",
  endplay: "After another track stopped",
  unknown: "Unknown",
};

const END_REASONS: Record<string, string> = {
  trackdone: "Played to the end",
  endplay: "Stopped or switched",
  fwdbtn: "Skipped forward",
  backbtn: "Went back",
  logout: "Logged out or closed",
  "unexpected-exit": "App quit unexpectedly",
  "unexpected-exit-while-paused": "App quit while paused",
  remote: "Ended from another device",
  trackerror: "Playback error",
  "switched-to-audio": "Switched to audio",
  "switched-to-video": "Switched to video",
  unknown: "Unknown",
};

function humanize(raw: string): string {
  const words = raw.replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Unknown";
}

export function startReasonLabel(raw: string): string {
  return START_REASONS[raw] ?? humanize(raw);
}

export function endReasonLabel(raw: string): string {
  return END_REASONS[raw] ?? humanize(raw);
}

export const KIND_LABELS = ["Music", "Podcasts", "Audiobooks", "Other"] as const;
