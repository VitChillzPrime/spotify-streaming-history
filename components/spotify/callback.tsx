"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { checkAccess } from "@/lib/spotify/api";
import { finishLogin } from "@/lib/spotify/auth";

// Codes are single-use, and React runs effects twice in development, so both
// runs share one exchange.
let completion: Promise<string> | null = null;

export function SpotifyCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    completion ??= finishLogin(new URLSearchParams(window.location.search)).then(async (returnTo) => {
      await checkAccess();
      return returnTo;
    });
    completion.then(
      (returnTo) => {
        if (active) router.replace(returnTo.startsWith("/") ? returnTo : "/dashboard");
      },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Couldn't connect to Spotify.");
      },
    );
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Brand />
      {error ? (
        <div className="max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card">
          <TriangleAlert className="mx-auto size-6 text-bad" aria-hidden />
          <p className="mt-3 text-[15px] font-semibold text-ink">Spotify isn&rsquo;t connected</p>
          <p className="mt-1 text-[13px] leading-5 text-ink-3">{error}</p>
          <ButtonLink href="/dashboard" className="mt-5">
            Back to your stats
          </ButtonLink>
        </div>
      ) : (
        <p role="status" className="flex items-center gap-2 text-[15px] text-ink-2">
          <LoaderCircle className="size-5 animate-spin text-accent" aria-hidden />
          Connecting to Spotify…
        </p>
      )}
    </div>
  );
}
