"use client";
import { Check, CopyPlus, Flame, MessageSquare, Scale, Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { repos } from "@/data";
import { formatKg, weightToInput } from "@/domain/format";
import { parseReps, parseWeight } from "@/domain/parse";
import { documentedWeight, isUnbalanced } from "@/domain/plates";
import type { Device, SetEntry, WeightBasis } from "@/domain/types";
import { cn } from "@/lib/utils";
import { PlateCalculatorDialog } from "./PlateCalculator";

const SAVE_DELAY = 400;

/** Eingabewert für das Gewichtsfeld: bei Scheiben das Scheibengewicht, sonst die Kennzahl. */
function weightFieldValue(set: SetEntry): number | null {
  if (set.weightBasis.mode === "block") return set.weightKg;
  return set.weightBasis.platesKg;
}

export function SetRow({
  set,
  device,
  placeholder,
  plateSizes,
  canCopyPrevious,
  onCompleted,
}: {
  set: SetEntry;
  device: Device | undefined;
  placeholder?: { weight?: number | null; reps?: number | null };
  plateSizes: number[];
  canCopyPrevious: boolean;
  onCompleted?: () => void;
}) {
  const basis = set.weightBasis;
  const [weightStr, setWeightStr] = React.useState(() => weightToInput(weightFieldValue(set)));
  const [repsStr, setRepsStr] = React.useState(() => (set.reps === null ? "" : String(set.reps)));
  const [noteOpen, setNoteOpen] = React.useState(!!set.note);
  const [noteStr, setNoteStr] = React.useState(set.note ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [calcOpen, setCalcOpen] = React.useState(false);
  const focused = React.useRef<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Externe Änderungen (z. B. „Vorherigen übernehmen“) übernehmen, solange nicht getippt wird.
  const fieldWeight = weightFieldValue(set);
  React.useEffect(() => {
    if (focused.current !== "weight") setWeightStr(weightToInput(fieldWeight));
  }, [fieldWeight]);
  React.useEffect(() => {
    if (focused.current !== "reps") setRepsStr(set.reps === null ? "" : String(set.reps));
  }, [set.reps]);

  const weightLabel = basis.mode === "block" ? "Gewicht" : "Scheibengewicht gesamt";
  const startIncluded = basis.mode !== "block" && basis.includesStartWeight ? basis.startWeightKg : undefined;

  function buildWeightPatch(value: number | null): { weightKg: number | null; weightBasis?: WeightBasis } {
    if (basis.mode === "block") return { weightKg: value };
    return {
      weightKg: value === null ? null : documentedWeight(value, basis.startWeightKg, basis.includesStartWeight),
      weightBasis: { ...basis, platesKg: value } as WeightBasis,
    };
  }

  async function save(patch: Parameters<typeof repos.sessions.updateSet>[1]) {
    try {
      await repos.sessions.updateSet(set.id, patch);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      return false;
    }
  }

  function scheduleSave(next: { weight?: string; reps?: string }) {
    if (timer.current) clearTimeout(timer.current);
    const w = parseWeight(next.weight ?? weightStr);
    const r = parseReps(next.reps ?? repsStr);
    if (!w.ok) return setError(w.error);
    if (!r.ok) return setError(r.error);
    setError(null);
    timer.current = setTimeout(() => {
      timer.current = null;
      const patch = { ...buildWeightPatch(w.value), reps: r.value };
      // Ein abgeschlossener Satz, dem ein Wert entfernt wird, wird wieder „offen“.
      void save(set.completed && (w.value === null || !r.value) ? { ...patch, completed: false } : patch);
    }, SAVE_DELAY);
  }

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function toggleComplete() {
    if (busy) return;
    setBusy(true);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    try {
      if (set.completed) {
        await save({ completed: false });
        return;
      }
      const w = parseWeight(weightStr);
      const r = parseReps(repsStr);
      if (!w.ok) return setError(w.error);
      if (!r.ok) return setError(r.error);
      const ok = await save({ ...buildWeightPatch(w.value), reps: r.value, completed: true });
      if (ok) onCompleted?.();
    } finally {
      setBusy(false);
    }
  }

  const weightId = `w-${set.id}`;
  const repsId = `r-${set.id}`;
  const unbalanced =
    basis.mode === "plates_calc" && isUnbalanced({ left: basis.left, right: basis.right, symmetric: basis.symmetric });

  return (
    <li
      className={cn(
        "rounded-xl border p-2",
        set.completed ? "border-accent/50 bg-accent/5" : "border-border bg-surface",
      )}
      aria-label={`Satz ${set.index + 1}${set.completed ? ", abgeschlossen" : ", offen"}${set.isWarmup ? ", Aufwärmsatz" : ""}`}
    >
      <div className="flex items-end gap-2">
        <div className="flex w-9 flex-col items-center pb-2">
          <span className="text-xs text-muted">Satz</span>
          <span className="tabular text-lg font-semibold">{set.index + 1}</span>
        </div>

        <div className="min-w-0 flex-1">
          <label htmlFor={weightId} className="mb-0.5 block truncate text-xs text-muted">
            {weightLabel} (kg)
          </label>
          {basis.mode === "plates_calc" ? (
            <Button
              id={weightId}
              variant="outline"
              className="h-12 w-full justify-between px-3"
              onClick={() => setCalcOpen(true)}
              aria-label={`Scheibenrechner öffnen, aktuell ${formatKg(basis.platesKg)}`}
            >
              <span className="tabular text-lg">{basis.platesKg === null ? "–" : weightToInput(basis.platesKg)}</span>
              <Scale aria-hidden />
            </Button>
          ) : (
            <Input
              id={weightId}
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              className="tabular text-lg"
              value={weightStr}
              placeholder={placeholder?.weight != null ? String(placeholder.weight) : "0"}
              aria-invalid={!!error}
              onFocus={() => (focused.current = "weight")}
              onBlur={() => (focused.current = null)}
              onChange={(e) => {
                setWeightStr(e.target.value);
                scheduleSave({ weight: e.target.value });
              }}
            />
          )}
        </div>

        <div className="w-20 shrink-0">
          <label htmlFor={repsId} className="mb-0.5 block text-xs text-muted">
            Wdh.
          </label>
          <Input
            id={repsId}
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            autoComplete="off"
            className="tabular text-lg"
            value={repsStr}
            placeholder={placeholder?.reps != null ? String(placeholder.reps) : "0"}
            aria-invalid={!!error}
            onFocus={() => (focused.current = "reps")}
            onBlur={() => (focused.current = null)}
            onChange={(e) => {
              setRepsStr(e.target.value);
              scheduleSave({ reps: e.target.value });
            }}
          />
        </div>

        <Button
          size="icon"
          variant={set.completed ? "primary" : "outline"}
          onClick={toggleComplete}
          disabled={busy}
          aria-pressed={set.completed}
          aria-label={set.completed ? `Satz ${set.index + 1} wieder öffnen` : `Satz ${set.index + 1} abschliessen`}
          className="shrink-0"
        >
          <Check />
        </Button>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1 pl-10">
        <span className={cn("mr-1 text-xs font-medium", set.completed ? "text-accent" : "text-muted")}>
          {set.completed ? "✓ Abgeschlossen" : "Offen"}
        </span>
        {canCopyPrevious && !set.completed && (
          <Button size="sm" variant="ghost" className="px-2 text-muted" onClick={() => repos.sessions.copyPreviousSet(set.id)}>
            <CopyPlus aria-hidden /> Wie vorheriger
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={set.isWarmup}
          className={cn("px-2", set.isWarmup ? "text-warning" : "text-muted")}
          onClick={() => save({ isWarmup: !set.isWarmup })}
        >
          <Flame aria-hidden /> {set.isWarmup ? "Aufwärmsatz ✓" : "Aufwärmsatz"}
        </Button>
        <Button size="sm" variant="ghost" className="px-2 text-muted" onClick={() => setNoteOpen((o) => !o)} aria-expanded={noteOpen}>
          <MessageSquare aria-hidden /> Notiz
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-auto text-muted hover:text-danger"
          aria-label={`Satz ${set.index + 1} entfernen`}
          onClick={() => repos.sessions.removeSet(set.id)}
        >
          <Trash2 />
        </Button>
      </div>

      {startIncluded !== undefined && (
        <p className="mt-1 pl-10 text-xs text-muted">
          Dokumentiert: {formatKg(set.weightKg)} (inkl. Startgewicht {formatKg(startIncluded)})
        </p>
      )}
      {unbalanced && (
        <p className="mt-1 pl-10 text-xs font-medium text-warning">⚠ Ungleiche Beladung</p>
      )}

      {noteOpen && (
        <div className="mt-2 pl-10">
          <label htmlFor={`n-${set.id}`} className="sr-only">
            Notiz zu Satz {set.index + 1}
          </label>
          <Input
            id={`n-${set.id}`}
            value={noteStr}
            maxLength={200}
            placeholder="Kurze Notiz, z. B. „letzte Wdh. mit Hilfe“"
            onChange={(e) => setNoteStr(e.target.value)}
            onBlur={() => {
              if ((set.note ?? "") !== noteStr.trim()) void save({ note: noteStr });
            }}
          />
        </div>
      )}

      {error && (
        <p className="mt-1 pl-10 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {basis.mode === "plates_calc" && calcOpen && (
        <PlateCalculatorDialog
          open={calcOpen}
          onOpenChange={setCalcOpen}
          sizes={device?.availablePlatesKg?.length ? device.availablePlatesKg : plateSizes}
          initial={{ left: basis.left, right: basis.right, symmetric: basis.symmetric }}
          startWeightKg={basis.startWeightKg}
          includeStartWeight={basis.includesStartWeight}
          onApply={(r) =>
            void save({
              weightKg: documentedWeight(r.platesKg, basis.startWeightKg, basis.includesStartWeight),
              weightBasis: { ...basis, left: r.left, right: r.right, symmetric: r.symmetric, platesKg: r.platesKg },
              ...(r.platesKg === 0 && set.completed ? { completed: false } : {}),
            })
          }
        />
      )}
    </li>
  );
}
