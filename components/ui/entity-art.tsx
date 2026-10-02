"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Monogram, TILE_SIZES } from "@/components/ui/monogram";
import { useLazyResource } from "@/components/ui/use-lazy-resource";
import { artworkUri, entityVisual } from "@/lib/artwork";
import { coverCache } from "@/lib/artwork-client";
import type { Dataset } from "@/lib/model";
import { settingsStore } from "@/lib/settings";
import type { EntityRef } from "@/lib/stats/top";
import { cn } from "@/lib/ui";

const PIXELS = { sm: 32, md: 40, lg: 56, xl: 80 } as const;

/**
 * Cover art for an artist, song, album, show, episode or audiobook. Shows a
 * tinted monogram until the image loads (or when there's none). Artists show
 * the cover of their most played song.
 */
export function EntityArt({
  ds,
  entity,
  size = "md",
  className,
}: {
  ds: Dataset;
  entity: EntityRef;
  size?: keyof typeof TILE_SIZES;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [settings] = settingsStore.useValue();
  const { type, id } = entity;
  const visual = useMemo(() => entityVisual(ds, { type, id }), [ds, type, id]);
  const uri = useMemo(() => (settings.artwork ? artworkUri(ds, { type, id }) : null), [ds, type, id, settings.artwork]);

  const src = useLazyResource(coverCache, uri, ref) ?? null;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <span
      ref={ref}
      className={cn("relative inline-flex shrink-0 overflow-hidden rounded-[22%]", TILE_SIZES[size], className)}
    >
      <Monogram name={visual.title} seed={visual.seed} size={size} fill />
      {src && failed !== src && (
        <Image
          src={src}
          alt=""
          fill
          unoptimized
          sizes={`${PIXELS[size]}px`}
          draggable={false}
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
          className={cn(
            "object-cover transition-opacity duration-300",
            loaded === src ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}
