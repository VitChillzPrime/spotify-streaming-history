import type { Metadata } from "next";
import { ClockView } from "@/components/views/clock";

export const metadata: Metadata = { title: "Listening clock" };

export default function ClockPage() {
  return <ClockView />;
}
