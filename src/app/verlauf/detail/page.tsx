"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { DeviceImage } from "@/components/DeviceImage";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { ExerciseCard } from "@/components/training/ExerciseCard";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Label, Textarea } from "@/components/ui/input";
import { db, repos } from "@/data";
import { sessionElapsedMs } from "@/data/repositories/sessions";
import { formatDate, formatDateTime, formatDuration, formatKg, formatTime } from "@/domain/format";
import { computeVolume } from "@/domain/metrics";
import { MUSCLE_GROUP_LABELS, SPLIT_MUSCLE_GROUPS, type WorkoutSession } from "@/domain/types";
import { describeBasis } from "@/domain/weightBasis";
import { useDeviceMap, useExerciseMap, useLive, useSettings } from "@/hooks/useData";
import { useQueryParam } from "@/hooks/useQueryParam";

export default function DetailPage() {
  return (
    <React.Suspense fallback={<p className="py-10 text-center text-muted">Lädt …</p>}>
      <Detail />
    </React.Suspense>
  );
}

function Detail() {
  const id = useQueryParam("id");
  const session = useLive(() => (id ? repos.sessions.get(id) : undefined), [id]);
  if (session === undefined) return <p className="py-10 text-center text-muted">Lädt …</p>;
  if (session === null) {
    return (
      <EmptyState
        title="Training nicht gefunden"
        action={
          <Button asChild>
            <Link href="/verlauf/">Zum Verlauf</Link>
          </Button>
        }
      >
        Es wurde möglicherweise gelöscht.
      </EmptyState>
    );
  }
  return <SessionDetail session={session} />;
}

function SessionDetail({ session }: { session: WorkoutSession }) {
  const router = useRouter();
  const ses = useLiveQuery(() => repos.sessions.exercises(session.id), [session.id]);
  const sets = useLiveQuery(() => db.sets.where("sessionId").equals(session.id).toArray(), [session.id]);
  const devices = useDeviceMap();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const [editing, setEditing] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [notes, setNotes] = React.useState(session.notes);
  const active = session.status === "in_progress" || session.status === "paused";

  if (!ses || !sets || !devices || !exercises || !settings) {
    return <p className="py-10 text-center text-muted">Lädt …</p>;
  }

  const volume = computeVolume(sets, { includeWarmup: settings.includeWarmupInVolume });

  return (
    <div>
      <Link href="/verlauf/" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted">
        <ArrowLeft className="size-4" aria-hidden /> Verlauf
      </Link>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-muted">
            {formatDate(session.startedAt)} · {formatTime(session.startedAt)}
            {session.endedAt ? `–${formatTime(session.endedAt)}` : ""}
          </p>
          <h1 className="text-2xl font-semibold">{session.templateName}</h1>
        </div>
        <SessionStatusBadge status={session.status} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Card className="p-3">
          <p className="text-xs text-muted">Dauer</p>
          <p className="tabular font-semibold">{formatDuration(sessionElapsedMs(session))}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted">Sätze ✓</p>
          <p className="tabular font-semibold">{sets.filter((s) => s.completed).length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted">Volumen</p>
          <p className="tabular font-semibold">{formatKg(volume)}</p>
        </Card>
      </div>
      <p className="mt-1 text-xs text-muted">
        Volumen = Σ Gewicht × Wiederholungen aller abgeschlossenen Arbeitssätze
        {settings.includeWarmupInVolume ? " inkl. Aufwärmsätze" : " (ohne Aufwärmsätze)"}. Achtung: Summe über
        verschiedene Geräte – nur als grobe Orientierung.
      </p>
      {session.status === "aborted" && (
        <p className="mt-3 rounded-xl border border-danger/50 p-3 text-sm">
          Diese Einheit wurde abgebrochen. Ihre Sätze fliessen nicht in Fortschritt und Bestleistungen ein.
        </p>
      )}
      {session.editedAt && (
        <p className="mt-2 text-xs text-muted">Nachträglich korrigiert am {formatDateTime(session.editedAt)}.</p>
      )}

      {active ? (
        <Button asChild variant="primary" className="mt-4 w-full">
          <Link href="/training/">Zum laufenden Training</Link>
        </Button>
      ) : (
        <div className="mt-4 flex gap-2">
          <Button variant={editing ? "primary" : "secondary"} className="flex-1" onClick={() => setEditing((e) => !e)}>
            <Pencil aria-hidden /> {editing ? "Korrektur beenden" : "Korrigieren"}
          </Button>
          <Button variant="danger-outline" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden /> Löschen
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {ses.map((se, i) => {
          const mySets = sets.filter((s) => s.sessionExerciseId === se.id).sort((a, b) => a.index - b.index);
          if (editing) {
            return (
              <ExerciseCard
                key={se.id}
                se={se}
                sets={mySets}
                device={devices.get(se.deviceId)}
                exercises={exercises}
                settings={settings}
                allowedMuscleGroups={SPLIT_MUSCLE_GROUPS[session.split]}
                mode="edit"
                isFirst={i === 0}
                isLast={i === ses.length - 1}
              />
            );
          }
          const device = devices.get(se.deviceId);
          return (
            <Card key={se.id}>
              <div className="flex gap-3">
                <DeviceImage device={device} size="thumb" />
                <div className="min-w-0">
                  <h2 className="font-semibold">
                    {se.snapshot.exerciseName}
                    {se.snapshot.variantLabel ? ` (${se.snapshot.variantLabel})` : ""}
                  </h2>
                  <p className="truncate text-sm text-muted">
                    {se.snapshot.deviceName}
                    {device?.archivedAt ? " (archiviert)" : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge>{MUSCLE_GROUP_LABELS[se.snapshot.muscleGroup]}</Badge>
                    {se.status === "skipped" && <Badge tone="warning">Übersprungen</Badge>}
                  </div>
                </div>
              </div>
              {se.snapshot.settingsText && (
                <p className="mt-2 text-xs text-muted">Einstellung: {se.snapshot.settingsText}</p>
              )}
              {mySets.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Keine Sätze erfasst.</p>
              ) : (
                <table className="tabular mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1 font-medium">Satz</th>
                      <th className="py-1 font-medium">Gewicht</th>
                      <th className="py-1 font-medium">Wdh.</th>
                      <th className="py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySets.map((s) => (
                      <tr key={s.id} className="border-t border-border align-top">
                        <td className="py-1.5">
                          {s.index + 1}
                          {s.isWarmup ? " (Aufw.)" : ""}
                        </td>
                        <td className="py-1.5">
                          {formatKg(s.weightKg)}
                          {s.weightBasis.mode !== "block" && (
                            <span className="block text-xs text-muted">{describeBasis(s.weightBasis)}</span>
                          )}
                        </td>
                        <td className="py-1.5">{s.reps ?? "–"}</td>
                        <td className="py-1.5">
                          {s.completed ? "✓ abgeschlossen" : "○ offen"}
                          {s.note && <span className="block text-xs italic text-muted">{s.note}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-4">
        <Label htmlFor="detail-notes">Trainingsnotiz</Label>
        {editing ? (
          <Textarea
            id="detail-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== session.notes && repos.sessions.updateNotes(session.id, notes)}
          />
        ) : (
          <p id="detail-notes" className="text-sm">
            {session.notes || <span className="text-muted">Keine Notiz.</span>}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Training endgültig löschen?"
        description={`${session.templateName} vom ${formatDate(session.startedAt)} wird mit allen Sätzen gelöscht. Das kann nicht rückgängig gemacht werden.`}
        confirmLabel="Endgültig löschen"
        danger
        onConfirm={async () => {
          await repos.sessions.deleteSession(session.id);
          router.push("/verlauf/");
        }}
      />
    </div>
  );
}
