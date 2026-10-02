import type { Metadata } from "next";
import { YearsView } from "@/components/views/years";

export const metadata: Metadata = { title: "Year in review" };

export default function YearsPage() {
  return <YearsView />;
}
