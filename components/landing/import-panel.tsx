"use client";

import { ArrowRight, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "@/components/data-provider";
import { Dropzone } from "@/components/import/dropzone";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatInstant, formatMonth, formatNumber } from "@/lib/format";

/** The landing page's call to action: the dropzone, or a way back in for returning visitors. */
export function ImportPanel() {
  const { status, dataset, prepared, timeZone } = useData();
  const router = useRouter();
  const [replacing, setReplacing] = useState(false);

  if (status === "loading") {
    return <div className="h-[296px] animate-pulse rounded-3xl border border-line bg-surface" aria-hidden />;
  }

  if (status === "ready" && dataset && prepared && !replacing) {
    return (
      <div className="animate-rise rounded-3xl border border-line bg-surface p-6 text-left shadow-card sm:p-8">
        <div className="flex items-center gap-2.5 text-[13px] font-medium text-good">
          <CircleCheck className="size-4" aria-hidden />
          Your stats are ready
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-ink">
          {formatNumber(dataset.size)} plays, {formatMonth(prepared.firstDay)} to {formatMonth(prepared.lastDay)}
        </p>
        <p className="mt-1 text-[13px] text-ink-3">
          Imported {formatInstant(dataset.meta.importedAt, timeZone, { dateStyle: "medium" })} · stored only in this
          browser
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/dashboard" variant="primary" size="lg">
            Open your dashboard <ArrowRight />
          </ButtonLink>
          <Button size="lg" variant="ghost" onClick={() => setReplacing(true)}>
            Import a different export
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-left">
      <Dropzone onImported={() => router.push("/dashboard")} />
      {replacing && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setReplacing(false)}>
            Keep my current data
          </Button>
        </div>
      )}
    </div>
  );
}

export function HeaderAction() {
  const { status } = useData();
  if (status !== "ready") return null;
  return (
    <ButtonLink href="/dashboard" variant="primary" size="sm">
      Dashboard <ArrowRight />
    </ButtonLink>
  );
}
