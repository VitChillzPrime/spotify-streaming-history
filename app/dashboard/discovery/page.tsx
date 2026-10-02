import type { Metadata } from "next";
import { DiscoveryView } from "@/components/views/discovery";

export const metadata: Metadata = { title: "Discovery" };

export default function DiscoveryPage() {
  return <DiscoveryView />;
}
