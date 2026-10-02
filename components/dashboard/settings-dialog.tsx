"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useData } from "@/components/data-provider";
import { Dropzone } from "@/components/import/dropzone";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { formatDay, formatInstant, formatNumber, plural } from "@/lib/format";
import { settingsStore } from "@/lib/settings";
import { storageUsage } from "@/lib/storage";
import { systemTimeZone } from "@/lib/time";

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line px-6 py-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-0.5 text-[13px] leading-5 text-ink-3">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const THRESHOLDS = [
  { value: "0", label: "Any play" },
  { value: "30000", label: "30 sec+" },
  { value: "60000", label: "1 min+" },
] as const;

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} label="Settings" size="md">
      <div className="max-h-[inherit] overflow-y-auto">
        <DialogHeader title="Settings" description="Preferences are saved in this browser." onClose={onClose} />
        <SettingsBody onClose={onClose} />
      </div>
    </Dialog>
  );
}

function SettingsBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { dataset, prepared, clearData, timeZone } = useData();
  const [settings, setSettings] = settingsStore.useValue();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [systemTimeZone()];
    }
  }, []);

  useEffect(() => {
    let active = true;
    void storageUsage().then((bytes) => active && setUsage(bytes));
    return () => {
      active = false;
    };
  }, []);

  const meta = dataset?.meta;
  const threshold = THRESHOLDS.find((option) => Number(option.value) === settings.minMs)?.value ?? "30000";

  return (
    <>
      <Section title="Appearance">
        <ThemeToggle showLabels />
      </Section>

      <Section
        title="Time zone"
        description="Spotify records plays in UTC. Hours, days and streaks are shown in this time zone."
      >
        <select
          value={settings.timeZone}
          onChange={(event) => setSettings({ ...settings, timeZone: event.target.value })}
          className="h-9 w-full rounded-xl border border-line bg-surface-2 px-3 text-[13px] text-ink"
        >
          <option value="auto">Automatic ({systemTimeZone()})</option>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        {settings.timeZone !== "auto" && <p className="mt-2 text-xs text-ink-3">Using {timeZone}.</p>}
      </Section>

      <Section
        title="What counts as a stream"
        description="Spotify counts a stream after 30 seconds. Listening time always includes every play."
      >
        <Segmented
          label="Stream threshold"
          value={threshold}
          options={THRESHOLDS}
          onChange={(value) => setSettings({ ...settings, minMs: Number(value) })}
        />
      </Section>

      {meta && prepared && (
        <Section title="Your data" description="Stored only in this browser (IndexedDB). It never leaves your device.">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-ink-3">Plays</dt>
            <dd className="text-right text-ink tabular">{formatNumber(dataset.size)}</dd>
            <dt className="text-ink-3">Covers</dt>
            <dd className="text-right text-ink">
              {formatDay(prepared.firstDay)} – {formatDay(prepared.lastDay)}
            </dd>
            <dt className="text-ink-3">Files read</dt>
            <dd className="text-right text-ink">
              {plural(meta.files.length, "file")} ·{" "}
              {meta.files.some((f) => f.format === "extended") ? "Extended history" : "Account data"}
            </dd>
            {meta.duplicates > 0 && (
              <>
                <dt className="text-ink-3">Duplicates removed</dt>
                <dd className="text-right text-ink tabular">{formatNumber(meta.duplicates)}</dd>
              </>
            )}
            <dt className="text-ink-3">Imported</dt>
            <dd className="text-right text-ink">{formatInstant(meta.importedAt, timeZone)}</dd>
            {usage !== null && (
              <>
                <dt className="text-ink-3">Storage used</dt>
                <dd className="text-right text-ink tabular">{(usage / 1e6).toFixed(1)} MB</dd>
              </>
            )}
          </dl>

          <div className="mt-4">
            {replacing ? (
              <Dropzone
                compact
                onImported={() => {
                  setReplacing(false);
                  onClose();
                }}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setReplacing(true)}>Import a newer export</Button>
                {confirmDelete ? (
                  <>
                    <Button
                      variant="danger"
                      onClick={async () => {
                        await clearData();
                        onClose();
                        router.push("/");
                      }}
                    >
                      <Trash2 /> Yes, delete everything
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete data
                  </Button>
                )}
              </div>
            )}
          </div>
        </Section>
      )}
    </>
  );
}
