"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, Pause, Play, Plus, Timer, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { ExerciseCard } from "@/components/training/ExerciseCard";
import { ExercisePicker } from "@/components/training/ExercisePicker";
import { RestTimer } from "@/components/training/RestTimer";
import { db, repos } from "@/data";
import { hasSetData, sessionElapsedMs } from "@/data/repositories/sessions";
import { formatClock, formatTime } from "@/domain/format";
import { SPLIT_MUSCLE_GROUPS, type SessionExercise, type WorkoutSession } from "@/domain/types";
import { useActiveSession, useDeviceMap, useExerciseMap, useNow, useSettings } from "@/hooks/useData";

export default function TrainingPage() {
  const session = useActiveSession();
  if (session === undefined) return <p className="py-10 text-center text-muted">Lädt …</p>;
  if (session === null) {
    return (
      <EmptyState
        title="Kein laufendes Training"
        action={
          <Button asChild variant="primary">
            <Link href="/">Zur Startseite</Link>
          </Button>
        }
      >
        Starte Training A oder B auf der Startseite.
      </EmptyState>
    );
  }
  return <ActiveTraining session={session} />;
}

function ElapsedClock({ session }: { session: WorkoutSession }) {
  const now = useNow(1000);
  return <span className="tabular">{formatClock(sessionElapsedMs(session, now))}</span>;
}

function ActiveTraining({ session }: { session: WorkoutSession }) {
  const router = useRouter();
  const exercisesList = useLiveQuery(() => repos.sessions.exercises(session.id), [session.id]);
  const sets = useLiveQuery(() => db.sets.where("sessionId").equals(session.id).toArray(), [session.id]);
  const devices = useDeviceMap();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const [notes, setNotes] = React.useState(session.notes);
  const [finishOpen, setFinishOpen] = React.useState(false);
  const [abortOpen, setAbortOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);
  const paused = session.status === "paused";
  const allowed = SPLIT_MUSCLE_GROUPS[session.split];

  // Notizen automatisch speichern
  React.useEffect(() => {
    if (notes === session.notes) return;
    const t = setTimeout(() => repos.sessions.updateNotes(session.id, notes), 500);
    return () => clearTimeout(t);
  }, [notes, session.id, session.notes]);

  const onSetCompleted = React.useCallback(
    (se: SessionExercise) => {
      if (!settings?.restTimerEnabled) return;
      const secs = se.snapshot.restSeconds ?? settings.defaultRestSeconds;
      if (secs > 0) void repos.sessions.startRestTimer(session.id, secs);
    },
    [settings, session.id],
  );

  if (!exercisesList || !sets || !devices || !exercises || !settings) {
    return <p className="py-10 text-center text-muted">Lädt …</p>;
  }

  const completedSets = sets.filter((s) => s.completed).length;
  const openWithValues = sets.filter((s) => !s.completed && (s.weightKg !== null || s.reps !== null)).length;
  const doneExercises = exercisesList.filter((se) => sets.some((s) => s.sessionExerciseId === se.id && s.completed)).length;

  async function finish(kind: "complete" | "abort") {
    if (finishing) return;
    setFinishing(true);
    try {
      await repos.sessions.updateNotes(session.id, notes);
      const ok = kind === "complete" ? await repos.sessions.complete(session.id) : await repos.sessions.abort(session.id);
      if (ok) router.push(`/verlauf/detail/?id=${session.id}`);
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Gestartet {formatTime(session.startedAt)}</p>
          <h1 className="text-xl font-semibold leading-tight">{session.templateName}</h1>
          <div className="mt-1 flex items-center gap-2">
            {paused ? (
              <Badge tone="warning">
                <Pause aria-hidden /> Pausiert
              </Badge>
            ) : (
              <Badge tone="accent">
                <Timer aria-hidden /> Läuft
              </Badge>
            )}
            <span className="text-sm text-muted">
              Dauer <ElapsedClock session={session} />
            </span>
          </div>
        </div>
        <Button
          variant="danger-outline"
          size="sm"
          onClick={() => setAbortOpen(true)}
          aria-label="Training abbrechen"
        >
          <XCircle aria-hidden /> Abbrechen
        </Button>
      </div>

      {paused && (
        <div className="mb-3 rounded-2xl border border-warning/50 p-3 text-sm">
          Training pausiert. Die Pausenzeit zählt nicht zur Trainingsdauer.{" "}
          <Button size="sm" variant="primary" className="mt-2 w-full" onClick={() => repos.sessions.resume(session.id)}>
            <Play aria-hidden /> Fortsetzen
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {exercisesList.map((se, i) => (
          <ExerciseCard
            key={se.id}
            se={se}
            sets={sets.filter((s) => s.sessionExerciseId === se.id)}
            device={devices.get(se.deviceId)}
            exercises={exercises}
            settings={settings}
            allowedMuscleGroups={allowed}
            mode="live"
            isFirst={i === 0}
            isLast={i === exercisesList.length - 1}
                siblings={exercisesList
                  .filter((x) => x.id !== se.id)
                  .map((x) => ({
                    se: x,
                    setCount: sets.filter((st) => st.sessionExerciseId === x.id && hasSetData(st)).length,
                  }))}
            onSetCompleted={onSetCompleted}
          />
        ))}
      </div>

      <Button variant="outline" className="mt-4 w-full" onClick={() => setAddOpen(true)}>
        <Plus aria-hidden /> Übung hinzufügen
      </Button>

      <div className="mt-6">
        <Label htmlFor="session-notes">Trainingsnotiz</Label>
        <Textarea
          id="session-notes"
          value={notes}
          placeholder="z. B. Tagesform, Besonderheiten"
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Fixe Aktionsleiste */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-2 px-4 py-3">
          <RestTimer session={session} />
          <div className="flex gap-2">
            {paused ? (
              <Button size="lg" onClick={() => repos.sessions.resume(session.id)} aria-label="Training fortsetzen">
                <Play aria-hidden />
              </Button>
            ) : (
              <Button size="lg" onClick={() => repos.sessions.pause(session.id)} aria-label="Training pausieren">
                <Pause aria-hidden />
              </Button>
            )}
            <Button size="lg" variant="primary" className="flex-1" onClick={() => setFinishOpen(true)}>
              <CheckCircle2 aria-hidden /> Training abschliessen
            </Button>
          </div>
          <p className="text-center text-xs text-muted">Eingaben werden automatisch gespeichert.</p>
        </div>
      </div>

      <ExercisePicker
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Übung hinzufügen"
        description="Wird nur dieser Einheit hinzugefügt. Die Vorlage bleibt unverändert."
        allowedMuscleGroups={allowed}
        onPick={(id) => repos.sessions.addExercise(session.id, id)}
      />

      <Dialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        title="Training abschliessen?"
        description={`${completedSets} abgeschlossene Sätze in ${doneExercises} von ${exercisesList.length} Übungen.`}
        footer={
          <>
            <Button onClick={() => setFinishOpen(false)}>Weiter trainieren</Button>
            <Button variant="primary" disabled={finishing} onClick={() => finish("complete")}>
              Abschliessen
            </Button>
          </>
        }
      >
        {openWithValues > 0 && (
          <p className="rounded-xl border border-warning/50 p-3 text-sm">
            {openWithValues} Satz/Sätze mit Werten sind noch nicht als abgeschlossen markiert. Sie werden als „offen“
            gespeichert und fliessen nicht in Volumen oder Bestleistungen ein.
          </p>
        )}
        {completedSets === 0 && (
          <p className="mt-2 rounded-xl border border-warning/50 p-3 text-sm">
            Es ist noch kein Satz abgeschlossen. Wenn du das Training nicht durchgeführt hast, brich es lieber ab.
          </p>
        )}
      </Dialog>

      <ConfirmDialog
        open={abortOpen}
        onOpenChange={setAbortOpen}
        title="Training abbrechen?"
        description="Die Einheit wird als „Abgebrochen“ gekennzeichnet und gespeichert. Ihre Sätze fliessen nicht in Fortschritt und Bestleistungen ein. Du kannst sie im Verlauf löschen."
        confirmLabel="Training abbrechen"
        danger
        onConfirm={() => finish("abort")}
      />
    </div>
  );
}
