import type { Metadata } from "next";
import { SpokenView } from "@/components/views/spoken";

export const metadata: Metadata = { title: "Audiobooks" };

export default function AudiobooksPage() {
  return <SpokenView kind="audiobooks" />;
}
