import type { Metadata } from "next";
import { TopView } from "@/components/views/top";

export const metadata: Metadata = { title: "Top albums" };

export default function AlbumsPage() {
  return <TopView type="album" title="Albums" noun="album" />;
}
