"use client";

import { createContext, use } from "react";
import type { EntityRef } from "@/lib/stats/top";

export const SheetContext = createContext<((ref: EntityRef) => void) | null>(null);

/** Opens the detail sheet for an artist, song, album, show, episode or audiobook. */
export function useEntitySheet(): (ref: EntityRef) => void {
  const open = use(SheetContext);
  if (!open) throw new Error("useEntitySheet must be used inside <EntitySheetProvider>");
  return open;
}
