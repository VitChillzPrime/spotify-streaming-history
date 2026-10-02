import {
  Activity,
  BookOpen,
  CalendarRange,
  Clock,
  Compass,
  Disc3,
  History,
  LayoutDashboard,
  Music,
  Podcast,
  Users,
  type LucideIcon,
} from "lucide-react";
import { KIND, type DatasetFeatures, type Kind } from "@/lib/model";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only shown when the data contains this kind of content. */
  requires?: Kind;
  /** Only shown when the export records this field (the basic export has no albums). */
  feature?: keyof DatasetFeatures;
}

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Listening",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/years", label: "Year in review", icon: CalendarRange },
    ],
  },
  {
    label: "Top",
    items: [
      { href: "/dashboard/artists", label: "Artists", icon: Users, requires: KIND.track },
      { href: "/dashboard/tracks", label: "Tracks", icon: Music, requires: KIND.track },
      { href: "/dashboard/albums", label: "Albums", icon: Disc3, requires: KIND.track, feature: "albums" },
      { href: "/dashboard/podcasts", label: "Podcasts", icon: Podcast, requires: KIND.episode },
      { href: "/dashboard/audiobooks", label: "Audiobooks", icon: BookOpen, requires: KIND.audiobook },
    ],
  },
  {
    label: "Patterns",
    items: [
      { href: "/dashboard/clock", label: "Listening clock", icon: Clock },
      { href: "/dashboard/habits", label: "Habits", icon: Activity },
      { href: "/dashboard/discovery", label: "Discovery", icon: Compass, requires: KIND.track },
    ],
  },
  {
    label: "Data",
    items: [{ href: "/dashboard/history", label: "History", icon: History }],
  },
];
