import type { Metadata } from "next";
import { TopView } from "@/components/views/top";

export const metadata: Metadata = { title: "Top artists" };

export default function ArtistsPage() {
  return <TopView type="artist" title="Artists" noun="artist" />;
}
