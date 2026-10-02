import type { Metadata } from "next";
import { SpokenView } from "@/components/views/spoken";

export const metadata: Metadata = { title: "Podcasts" };

export default function PodcastsPage() {
  return <SpokenView kind="podcasts" />;
}
