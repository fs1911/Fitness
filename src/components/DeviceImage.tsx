"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { ImageOff } from "lucide-react";
import * as React from "react";
import { repos } from "@/data";
import type { Device } from "@/domain/types";
import { cn } from "@/lib/utils";
import { DeviceIllustration } from "./DeviceIllustration";

// Objekt-URLs pro Bild-ID cachen: Bild-IDs sind unveränderlich (neuer Upload = neue ID).
const urlCache = new Map<string, string>();

function useBlobUrl(blobId: string | undefined): string | null {
  const blob = useLiveQuery(() => (blobId ? repos.devices.getImage(blobId) : undefined), [blobId]);
  if (!blob) return null;
  let url = urlCache.get(blob.id);
  if (!url) {
    url = URL.createObjectURL(new Blob([blob.data], { type: blob.mimeType }));
    urlCache.set(blob.id, url);
  }
  return url;
}

/**
 * Gerätebild mit sauberem Platzhalter bei fehlenden Bildern oder Ladefehlern.
 * Illustrationen sind sichtbar als solche gekennzeichnet.
 */
export function DeviceImage({
  device,
  size = "card",
  className,
  illustrationKey,
}: {
  device: Pick<Device, "name" | "image" | "illustrationKey"> | undefined;
  /** Übungsspezifische Illustration (z. B. Bewegungsrichtung an Kombimaschinen). */
  illustrationKey?: string;
  size?: "thumb" | "card" | "hero";
  className?: string;
}) {
  const blobId = device?.image.kind === "upload" ? device.image.blobId : undefined;
  const blobUrl = useBlobUrl(blobId);
  const externalUrl = device?.image.kind === "url" ? device.image.url : undefined;
  const src = blobUrl ?? externalUrl;
  // Ladefehler gilt nur für die jeweilige Quelle.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const failed = !!src && failedSrc === src;
  const box = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden bg-surface-2 text-accent/80",
    size === "thumb" && "size-16 rounded-xl",
    size === "card" && "aspect-[4/3] w-full rounded-xl",
    size === "hero" && "aspect-[16/10] w-full rounded-2xl",
    className,
  );

  if (!device) {
    return (
      <div className={box} aria-label="Kein Gerät">
        <ImageOff className="size-6 text-muted" />
      </div>
    );
  }

  if (device.image.kind !== "illustration" && src && !failed) {
    return (
      <div className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Foto: ${device.name}`}
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
          loading="lazy"
        />
        {device.image.kind === "url" && size !== "thumb" && (
          <span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
            Quelle: {device.image.source}
          </span>
        )}
      </div>
    );
  }

  const loadError = device.image.kind !== "illustration" && (failed || (!src && device.image.kind === "url"));
  return (
    <div className={box}>
      <DeviceIllustration
        illustrationKey={illustrationKey ?? device.illustrationKey}
        title={device.name}
        className={size === "thumb" ? "size-14" : "h-4/5 w-4/5"}
      />
      {size !== "thumb" && (
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-muted">
          {loadError ? "Bild nicht ladbar – Illustration" : "Illustration – kein Produktfoto"}
        </span>
      )}
    </div>
  );
}
