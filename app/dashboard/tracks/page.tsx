import type { Metadata } from "next";
import { TopView } from "@/components/views/top";

export const metadata: Metadata = { title: "Top tracks" };

export default function TracksPage() {
  return <TopView type="song" title="Tracks" noun="track" />;
}
