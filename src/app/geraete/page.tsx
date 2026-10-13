"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { DeviceImage } from "@/components/DeviceImage";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { repos } from "@/data";
import { LOADING_TYPE_LABELS, MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/domain/types";

export default function DevicesPage() {
  const [q, setQ] = React.useState("");
  const [mg, setMg] = React.useState<MuscleGroup | "all">("all");
  const [showArchived, setShowArchived] = React.useState(false);
  const devices = useLiveQuery(() => repos.devices.list({ includeArchived: true }), []);
  const exercises = useLiveQuery(() => repos.exercises.list(), []);

  if (!devices || !exercises) return <p className="py-10 text-center text-muted">Lädt …</p>;
  const needle = q.trim().toLowerCase();
  const list = devices
    .filter((d) => showArchived || !d.archivedAt)
    .filter((d) => mg === "all" || d.muscleGroup === mg)
    .filter((d) => !needle || `${d.name} ${d.model ?? ""} ${d.series ?? ""}`.toLowerCase().includes(needle));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Geräte</h1>
        <Button asChild variant="primary" size="sm">
          <Link href="/geraete/bearbeiten/">
            <Plus aria-hidden /> Gerät
          </Link>
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <label htmlFor="device-search" className="sr-only">
            Nach Gerätename oder Modell suchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted" aria-hidden />
          <Input
            id="device-search"
            className="pl-10"
            placeholder="Name oder Modell suchen"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label htmlFor="mg-filter" className="sr-only">
          Muskelgruppe filtern
        </label>
        <Select id="mg-filter" value={mg} onChange={(e) => setMg(e.target.value as MuscleGroup | "all")}>
          <option value="all">Alle Muskelgruppen</option>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_GROUP_LABELS[m]}
            </option>
          ))}
        </Select>
      </div>
      <Checkbox
        className="mt-1"
        label="Archivierte Geräte anzeigen"
        checked={showArchived}
        onChange={(e) => setShowArchived(e.target.checked)}
      />

      {list.length === 0 ? (
        <EmptyState title="Keine Geräte gefunden">Passe Suche oder Filter an.</EmptyState>
      ) : (
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {list.map((d) => {
            const used = exercises.filter((e) => e.deviceId === d.id);
            return (
              <li key={d.id}>
                <Link href={`/geraete/bearbeiten/?id=${d.id}`} className="block h-full">
                  <Card className="h-full p-3 hover:border-accent/60">
                    <DeviceImage device={d} size="card" />
                    <p className="mt-2 font-semibold">{d.name}</p>
                    <p className="text-sm text-muted">
                      {d.model ? `${d.model}${d.series ? ` · ${d.series}` : ""}` : "Konkretes Modell noch nicht hinterlegt"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge>{MUSCLE_GROUP_LABELS[d.muscleGroup]}</Badge>
                      <Badge tone={d.loadingType === "plate_loaded" ? "warning" : "neutral"}>
                        {LOADING_TYPE_LABELS[d.loadingType]}
                      </Badge>
                      {d.archivedAt && <Badge tone="danger">Archiviert</Badge>}
                    </div>
                    {used.length > 0 && (
                      <p className="mt-2 text-xs text-muted">Übungen: {used.map((e) => e.name).join(", ")}</p>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
