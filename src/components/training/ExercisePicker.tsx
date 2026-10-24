"use client";
import * as React from "react";
import { DeviceImage } from "@/components/DeviceImage";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDeviceMap, useExerciseMap } from "@/hooks/useData";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/domain/types";

/** Auswahl einer Übung – nur aus den erlaubten Muskelgruppen des Splits. */
export function ExercisePicker({
  open,
  onOpenChange,
  title,
  description,
  allowedMuscleGroups,
  excludeIds = [],
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  allowedMuscleGroups: MuscleGroup[];
  excludeIds?: string[];
  onPick: (exerciseId: string) => void;
}) {
  const exercises = useExerciseMap();
  const devices = useDeviceMap();
  const [q, setQ] = React.useState("");
  const list = [...(exercises?.values() ?? [])]
    .filter((e) => !e.archivedAt && allowedMuscleGroups.includes(e.muscleGroup) && !excludeIds.includes(e.id))
    .filter((e) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      const d = devices?.get(e.deviceId);
      return `${e.name} ${e.variantLabel ?? ""} ${d?.name ?? ""} ${d?.model ?? ""}`.toLowerCase().includes(needle);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <label htmlFor="exercise-search" className="sr-only">
        Übung suchen
      </label>
      <Input
        id="exercise-search"
        placeholder="Übung oder Gerät suchen"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {allowedMuscleGroups.map((mg) => {
        const items = list.filter((e) => e.muscleGroup === mg);
        if (items.length === 0) return null;
        return (
          <div key={mg} className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-muted">{MUSCLE_GROUP_LABELS[mg]}</h3>
            <ul className="space-y-2">
              {items.map((e) => {
                const d = devices?.get(e.deviceId);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 p-2 text-left hover:border-accent/60"
                      onClick={() => {
                        onPick(e.id);
                        onOpenChange(false);
                      }}
                    >
                      <DeviceImage device={d} illustrationKey={e.illustrationKey} size="thumb" />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {e.name}
                          {e.variantLabel ? ` (${e.variantLabel})` : ""}
                        </span>
                        <span className="block truncate text-sm text-muted">{d?.name ?? "Kein Gerät"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {list.length === 0 && <p className="mt-4 text-sm text-muted">Keine passende Übung gefunden.</p>}
    </Dialog>
  );
}
