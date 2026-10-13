"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { Card, EmptyState } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { db, repos } from "@/data";
import { sessionElapsedMs } from "@/data/repositories/sessions";
import { formatDate, formatDuration, formatKg, formatTime, formatWeekday } from "@/domain/format";
import { computeVolume } from "@/domain/metrics";

type Filter = "all" | "A" | "B";

export default function HistoryPage() {
  const [filter, setFilter] = React.useState<Filter>("all");
  const data = useLiveQuery(async () => {
    const sessions = await repos.sessions.listAll();
    const ses = await db.sessionExercises.toArray();
    const sets = await db.sets.toArray();
    return sessions.map((s) => {
      const exercises = ses.filter((x) => x.sessionId === s.id).sort((a, b) => a.order - b.order);
      const mySets = sets.filter((x) => x.sessionId === s.id);
      return {
        session: s,
        exercises: exercises.map((se) => ({
          se,
          sets: mySets.filter((x) => x.sessionExerciseId === se.id).sort((a, b) => a.index - b.index),
        })),
        completedSets: mySets.filter((x) => x.completed).length,
        volume: computeVolume(mySets),
      };
    });
  }, []);

  if (!data) return <p className="py-10 text-center text-muted">Lädt …</p>;
  const list = data.filter((d) => filter === "all" || d.session.split === filter);

  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">Verlauf</h1>
      <Segmented
        label="Nach Training filtern"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Alle" },
          { value: "A", label: "Training A" },
          { value: "B", label: "Training B" },
        ]}
      />
      {list.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Noch keine Trainings">
            Abgeschlossene und abgebrochene Einheiten erscheinen hier chronologisch.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map(({ session: s, exercises, completedSets, volume }) => {
            const active = s.status === "in_progress" || s.status === "paused";
            return (
              <li key={s.id}>
                <Link href={active ? "/training/" : `/verlauf/detail/?id=${s.id}`} className="block">
                  <Card className="hover:border-accent/60">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-muted">
                          {formatWeekday(s.startedAt)}, {formatDate(s.startedAt)} · {formatTime(s.startedAt)}
                        </p>
                        <p className="text-lg font-semibold">Training {s.split}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <SessionStatusBadge status={s.status} />
                        <ChevronRight className="size-5 text-muted" aria-hidden />
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      Dauer {formatDuration(sessionElapsedMs(s))} · {completedSets} Sätze · Volumen{" "}
                      {formatKg(volume)}
                      {s.editedAt ? " · nachträglich korrigiert" : ""}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-sm">
                      {exercises.map(({ se, sets }) => {
                        const done = sets.filter((x) => x.completed);
                        return (
                          <li key={se.id} className="flex gap-2">
                            <span className="min-w-0 flex-1 truncate">
                              {se.snapshot.exerciseName}
                              {se.status === "skipped" ? " (übersprungen)" : ""}
                            </span>
                            <span className="tabular shrink-0 text-muted">
                              {done.length === 0
                                ? "–"
                                : done.map((x) => `${String(x.weightKg)}×${x.reps}`).join(", ")}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {s.notes && <p className="mt-2 border-t border-border pt-2 text-sm italic text-muted">{s.notes}</p>}
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
