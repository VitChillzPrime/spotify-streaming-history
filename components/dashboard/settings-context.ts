"use client";

import { createContext, use } from "react";

export type SettingsSection = "spotify";

export const SettingsContext = createContext<((section?: SettingsSection) => void) | null>(null);

/** Opens the Settings dialog, optionally scrolled to a section. */
export function useOpenSettings(): (section?: SettingsSection) => void {
  const open = use(SettingsContext);
  if (!open) throw new Error("useOpenSettings must be used inside the dashboard");
  return open;
}
