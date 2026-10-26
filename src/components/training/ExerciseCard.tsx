"use client";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  History,
  MoreHorizontal,
  Plus,
  Repeat,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import * as React from "react";
import { DeviceImage } from "@/components/DeviceImage";
import { ExerciseSettingsDialog } from "@/components/ExerciseSettingsDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { repos } from "@/data";
import { settingsToText } from "@/data/repositories/exercises";
import { hasSetData, SetsWouldBeLostError } from "@/data/repositories/sessions";
import { formatDate, formatKg } from "@/domain/format";
import {
  MUSCLE_GROUP_LABELS,
  type Device,
  type Exercise,
  type MuscleGroup,
  type SessionExercise,
  type SetEntry,
  type UserSettings,
} from "@/domain/types";
import { basisKey, basisKeyLabel } from "@/domain/weightBasis";
import { cn } from "@/lib/utils";
import { ExercisePicker } from "./ExercisePicker";
import { SetRow } from "./SetRow";

/** Bewegungsrichtung als Text + Pfeilsymbol (nicht nur über Farbe/Bild). */
const DIRECTION_HINTS: Record<string, string> = {
  "hip-adduction": "→ ← Beine zusammen",
  "hip-abduction": "← → Beine auseinander",
};

type PendingSwitch = { exerciseId: string; reason: "variant" | "replace" };

export function ExerciseCard({
  se,
  sets,
  device,
  exercises,
  settings,
  allowedMuscleGroups,
  mode,
  isFirst,
  isLast,
  onSetCompleted,
  siblings = [],
}: {
  se: SessionExercise;
  sets: SetEntry[];
  device: Device | undefined;
  exercises: Map<string, Exercise>;
  settings: UserSettings;
  allowedMuscleGroups: MuscleGroup[];
  mode: "live" | "edit";
  isFirst: boolean;
  isLast: boolean;
  onSetCompleted?: (se: SessionExercise) => void;
  /** Andere Übungen derselben Einheit (für „Sätze tauschen“), inkl. Anzahl erfasster Sätze. */
  siblings?: { se: SessionExercise; setCount: number }[];
}) {
  const live = mode === "live";
  const last = useLiveQuery(
    async () => (live ? await repos.sessions.lastPerformance(se.exerciseId, se.deviceId, se.sessionId) : null),
    [se.exerciseId, se.deviceId, se.sessionId, live],
  );
  const liveSetting = useLiveQuery(
    async () => (live ? await repos.exercises.getSetting(se.exerciseId, se.deviceId) : undefined),
    [se.exerciseId, se.deviceId, live],
  );
  const settingsText = live && liveSetting ? settingsToText(liveSetting) : se.snapshot.settingsText;

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState<"replace" | "add-variant" | null>(null);
  const [pending, setPending] = React.useState<PendingSwitch | null>(null);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [swapOpen, setSwapOpen] = React.useState(false);
  const [swapTarget, setSwapTarget] = React.useState<{ se: SessionExercise; setCount: number } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [info, setInfo] = React.useState<string | null>(null);

  const sorted = [...sets].sort((a, b) => a.index - b.index);
  const hasData = sorted.some(hasSetData);
  const skipped = se.status === "skipped";
  const completedCount = sorted.filter((s) => s.completed).length;
  const lastCompleted = last?.sets.filter((s) => s.completed) ?? [];
  const isPlates = se.snapshot.loadingType === "plate_loaded";
  const direction = DIRECTION_HINTS[exercises.get(se.exerciseId)?.illustrationKey ?? ""];

  async function requestSwitch(exerciseId: string, reason: PendingSwitch["reason"]) {
    if (!hasData) {
      await repos.sessions.switchExercise(se.id, exerciseId, "replace");
      return;
    }
    setPending({ exerciseId, reason });
  }

  async function addSet() {
    if (busy) return;
    setBusy(true);
    try {
      await repos.sessions.addSet(se.id);
    } finally {
      setBusy(false);
    }
  }

  const title = `${se.snapshot.exerciseName}${se.snapshot.variantLabel ? ` (${se.snapshot.variantLabel})` : ""}`;
  const variantOptions = [se.exerciseId, ...se.alternativeExerciseIds]
    .map((id) => exercises.get(id))
    .filter((e): e is Exercise => !!e)
    // Feste Reihenfolge, damit die Knöpfe beim Umschalten nicht die Position wechseln
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));

  return (
    <article
      aria-labelledby={`title-${se.id}`}
      className={cn("rounded-2xl border border-border bg-surface p-3 sm:p-4", skipped && "opacity-70")}
    >
      <header className="flex gap-3">
        <DeviceImage
          device={device}
          illustrationKey={exercises.get(se.exerciseId)?.illustrationKey}
          size="thumb"
          className="size-20 sm:size-24"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 id={`title-${se.id}`} className="text-lg font-semibold leading-tight">
                {title}
              </h3>
              <p className="truncate text-sm text-muted">
                {se.snapshot.deviceName}
                {se.snapshot.deviceModel ? ` · ${se.snapshot.deviceModel}` : ""}
              </p>
            </div>
            <Button size="icon-sm" variant="ghost" aria-label={`Optionen für ${title}`} onClick={() => setMenuOpen(true)}>
              <MoreHorizontal />
            </Button>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge>{MUSCLE_GROUP_LABELS[se.snapshot.muscleGroup]}</Badge>
            <Badge tone="accent">
              Ziel: {se.snapshot.targetSets} × {se.snapshot.targetRepsMin}
              {se.snapshot.targetRepsMax !== se.snapshot.targetRepsMin ? `–${se.snapshot.targetRepsMax}` : ""}
            </Badge>
            {isPlates && <Badge tone="warning">Scheiben</Badge>}
            {direction && <Badge tone="accent">{direction}</Badge>}
            {skipped && <Badge tone="warning">Übersprungen</Badge>}
            {!skipped && completedCount > 0 && (
              <Badge tone="success">
                {completedCount}/{sorted.length} Sätze ✓
              </Badge>
            )}
          </div>
        </div>
      </header>

      {settingsText && (
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span className="text-muted">Einstellung: </span>
          {settingsText}
        </p>
      )}

      {live && variantOptions.length > 1 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">Gerätevariante</p>
          <Segmented
            label="Gerätevariante wählen"
            value={se.exerciseId}
            options={variantOptions.map((e) => ({
              value: e.id,
              // Gemeinsamen Präfix („Beinpresse – “, „Latzug – “) für kurze Beschriftungen entfernen
              label: e.name.includes(" – ") ? e.name.slice(e.name.indexOf(" – ") + 3) : e.name,
            }))}
            onChange={(id) => id !== se.exerciseId && requestSwitch(id, "variant")}
          />
        </div>
      )}

      {live && isPlates && !skipped && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">Eingabe Scheibengewicht</p>
          <Segmented
            label="Eingabemodus Scheibengewicht"
            value={se.weightMode === "plates_calc" ? "plates_calc" : "plates_total"}
            options={[
              { value: "plates_total", label: "Direkteingabe" },
              { value: "plates_calc", label: "Scheibenrechner" },
            ]}
            onChange={(m) => repos.sessions.setWeightMode(se.id, m)}
          />
          <p className="mt-1 text-xs text-muted">
            Dokumentiert wird das aufgelegte Scheibengewicht
            {device?.includeStartWeight && device.startWeightKg !== undefined
              ? ` inkl. verifiziertem Startgewicht (${formatKg(device.startWeightKg)})`
              : " – ohne Schlitten- oder Startgewicht"}
            .
          </p>
        </div>
      )}

      {live && !skipped && (
        <div className="mt-3 rounded-lg border border-border px-3 py-2 text-sm">
          <p className="flex items-center gap-1 text-muted">
            <History className="size-4" aria-hidden /> Letztes Mal
            {last ? ` · ${formatDate(last.session.startedAt)} · Training ${last.session.split}` : ""}
          </p>
          {last === undefined ? (
            <p className="text-muted">…</p>
          ) : lastCompleted.length === 0 ? (
            <p>Noch keine abgeschlossene Durchführung an diesem Gerät.</p>
          ) : (
            <>
              <ul className="tabular mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {lastCompleted.map((s, i) => (
                  <li key={s.id}>
                    {i + 1}. {formatKg(s.weightKg)} × {s.reps}
                    {s.isWarmup ? " (Aufw.)" : ""}
                  </li>
                ))}
              </ul>
              {isPlates && (
                <p className="mt-1 text-xs text-muted">{basisKeyLabel(basisKey(lastCompleted[0].weightBasis))}</p>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="-ml-2 mt-1 text-accent"
                onClick={async () => {
                  const n = await repos.sessions.applyLastValues(se.id);
                  setInfo(
                    n > 0
                      ? `${n} Satz${n === 1 ? "" : "e"} als Vorschlag übernommen – noch nicht abgeschlossen.`
                      : "Keine passenden Werte (andere Berechnungsgrundlage oder Sätze bereits abgeschlossen).",
                  );
                }}
              >
                <Wand2 aria-hidden /> Als Vorschlag übernehmen
              </Button>
            </>
          )}
          {info && (
            <p className="mt-1 text-xs text-muted" role="status">
              {info}
            </p>
          )}
        </div>
      )}

      {skipped ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted">Diese Übung wird in dieser Einheit übersprungen.</p>
          <Button size="sm" onClick={() => repos.sessions.setExerciseStatus(se.id, "active")}>
            <Undo2 aria-hidden /> Wieder aufnehmen
          </Button>
        </div>
      ) : (
        <>
          <ol className="mt-3 space-y-2">
            {sorted.map((s, i) => {
              const ph = lastCompleted[i];
              return (
                <SetRow
                  key={s.id}
                  set={s}
                  device={device}
                  plateSizes={settings.availablePlatesKg}
                  placeholder={ph ? { weight: ph.weightBasis.mode === "block" ? ph.weightKg : ph.weightBasis.platesKg, reps: ph.reps } : undefined}
                  canCopyPrevious={i > 0}
                  onCompleted={() => onSetCompleted?.(se)}
                />
              );
            })}
          </ol>
          {sorted.length === 0 && <p className="mt-3 text-sm text-muted">Keine Sätze erfasst.</p>}
          <Button className="mt-2 w-full" variant="outline" onClick={addSet} disabled={busy}>
            <Plus aria-hidden /> Satz hinzufügen
          </Button>
        </>
      )}

      {/* Optionen */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen} title={title}>
        <div className="grid gap-2">
          {live && (
            <Button onClick={() => (setMenuOpen(false), setSettingsOpen(true))}>
              <SlidersHorizontal aria-hidden /> Geräteeinstellungen bearbeiten
            </Button>
          )}
          {live && !skipped && (
            <Button
              onClick={async () => {
                setMenuOpen(false);
                await repos.sessions.setExerciseStatus(se.id, "skipped");
              }}
            >
              <SkipForward aria-hidden /> Übung überspringen
            </Button>
          )}
          {live && (
            <Button onClick={() => (setMenuOpen(false), setPickerOpen("replace"))}>
              <Repeat aria-hidden /> Übung ersetzen
            </Button>
          )}
          {live && se.alternativeExerciseIds.length > 0 && (
            <Button onClick={() => (setMenuOpen(false), setPickerOpen("add-variant"))}>
              <Plus aria-hidden /> Andere Variante zusätzlich anlegen
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={isFirst} onClick={() => repos.sessions.moveExercise(se.id, -1)}>
              <ArrowUp aria-hidden /> Nach oben
            </Button>
            <Button disabled={isLast} onClick={() => repos.sessions.moveExercise(se.id, 1)}>
              <ArrowDown aria-hidden /> Nach unten
            </Button>
          </div>
          {siblings.length > 0 && (
            <Button onClick={() => (setMenuOpen(false), setSwapOpen(true))}>
              <ArrowLeftRight aria-hidden /> Sätze mit anderer Übung tauschen …
            </Button>
          )}
          <Button variant="danger-outline" onClick={() => (setMenuOpen(false), setRemoveOpen(true))}>
            <Trash2 aria-hidden /> Aus dieser Einheit entfernen
          </Button>
        </div>
      </Dialog>

      <ExerciseSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        exerciseId={se.exerciseId}
        deviceId={se.deviceId}
        title={title}
      />

      <ExercisePicker
        open={pickerOpen !== null}
        onOpenChange={(o) => !o && setPickerOpen(null)}
        title={pickerOpen === "add-variant" ? "Variante zusätzlich anlegen" : "Übung ersetzen"}
        description="Nur Übungen der Muskelgruppen dieses Trainings."
        allowedMuscleGroups={
          pickerOpen === "add-variant"
            ? (variantOptions.map((e) => e.muscleGroup) as MuscleGroup[])
            : allowedMuscleGroups
        }
        excludeIds={
          pickerOpen === "add-variant"
            ? [...exercises.keys()].filter((id) => !se.alternativeExerciseIds.includes(id))
            : [se.exerciseId]
        }
        onPick={async (id) => {
          if (pickerOpen === "add-variant") {
            await repos.sessions.switchExercise(se.id, id, "add");
          } else {
            await requestSwitch(id, "replace");
          }
        }}
      />

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Bereits erfasste Sätze"
        description={`Für „${title}“ sind schon Werte erfasst. Sie werden nie stillschweigend einem anderen Gerät zugeordnet. Wie möchtest du fortfahren?`}
      >
        <div className="grid gap-2">
          <Button
            variant="primary"
            onClick={async () => {
              if (!pending) return;
              await repos.sessions.switchExercise(se.id, pending.exerciseId, "add");
              setPending(null);
            }}
          >
            Bisherige Übung behalten und zusätzliche Übung anlegen
          </Button>
          <Button
            variant="danger-outline"
            onClick={async () => {
              if (!pending) return;
              try {
                await repos.sessions.switchExercise(se.id, pending.exerciseId, "replace", { discardSets: true });
              } catch (e) {
                if (!(e instanceof SetsWouldBeLostError)) throw e;
              }
              setPending(null);
            }}
          >
            Position ersetzen und erfasste Sätze verwerfen
          </Button>
          <Button onClick={() => setPending(null)}>Abbrechen</Button>
        </div>
      </Dialog>

      <Dialog
        open={swapOpen}
        onOpenChange={setSwapOpen}
        title="Sätze tauschen mit …"
        description={`Korrektur, falls Werte bei der falschen Übung erfasst wurden. Alle Sätze von „${title}“ wechseln zur gewählten Übung und umgekehrt.`}
      >
        <ul className="grid gap-2">
          {[...siblings]
            .sort(
              (x, y) =>
                Number(se.alternativeExerciseIds.includes(y.se.exerciseId)) -
                  Number(se.alternativeExerciseIds.includes(x.se.exerciseId)) ||
                Number(y.se.snapshot.muscleGroup === se.snapshot.muscleGroup) -
                  Number(x.se.snapshot.muscleGroup === se.snapshot.muscleGroup) ||
                x.se.order - y.se.order,
            )
            .map((sib) => (
              <li key={sib.se.id}>
                <Button
                  className="h-auto min-h-12 w-full justify-between py-2 text-left"
                  onClick={() => {
                    setSwapOpen(false);
                    setSwapTarget(sib);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{sib.se.snapshot.exerciseName}</span>
                    <span className="block truncate text-xs text-muted">{sib.se.snapshot.deviceName}</span>
                  </span>
                  <span className="shrink-0 text-sm text-muted">{sib.setCount} Sätze</span>
                </Button>
              </li>
            ))}
        </ul>
      </Dialog>

      <ConfirmDialog
        open={swapTarget !== null}
        onOpenChange={(o) => !o && setSwapTarget(null)}
        title="Sätze tauschen?"
        description={
          swapTarget
            ? `${sorted.filter(hasSetData).length} Satz/Sätze von „${title}“ ↔ ${swapTarget.setCount} Satz/Sätze von „${swapTarget.se.snapshot.exerciseName}“. Gewicht und Wiederholungen bleiben; die Berechnungsgrundlage wird an das jeweilige Gerät angepasst (Gewichtsblock bzw. aufgelegtes Scheibengewicht ohne Startgewicht). Fortschritt und Bestleistungen werden neu berechnet.`
            : ""
        }
        confirmLabel="Sätze tauschen"
        onConfirm={async () => {
          if (swapTarget) await repos.sessions.swapSets(se.id, swapTarget.se.id);
          setSwapTarget(null);
        }}
      />

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Übung entfernen?"
        description={
          hasData
            ? `„${title}“ und alle erfassten Sätze werden aus dieser Einheit gelöscht.`
            : `„${title}“ wird aus dieser Einheit entfernt. Die Vorlage bleibt unverändert.`
        }
        confirmLabel="Entfernen"
        danger
        onConfirm={() => repos.sessions.removeExercise(se.id)}
      />
    </article>
  );
}
