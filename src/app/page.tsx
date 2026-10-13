"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Pause, Play } from "lucide-react";
import Link from "next/link";
import { StartTrainingButton } from "@/components/StartTrainingButton";
import { Button } from "@/components/ui/button";
import { Badge, Card, SectionTitle } from "@/components/ui/card";
import { db, repos } from "@/data";
import { sessionElapsedMs } from "@/data/repositories/sessions";
import { compareToPrevious } from "@/domain/metrics";
import { formatDate, formatDuration, formatKg, formatTime, startOfWeek } from "@/domain/format";
import { suggestNextSplit } from "@/domain/metrics";
import { useActiveSession, useNow, useSettings } from "@/hooks/useData";

function useHomeData() {
  return useLiveQuery(async () => {
    const templates = await repos.templates.list();
    const counts: Record<string, number> = {};
    for (const t of templates) counts[t.id] = (await repos.templates.slots(t.id)).filter((s) => s.active).length;
    const sessions = await repos.sessions.listAll();
    const completed = sessions.filter((s) => s.status === "completed");
    const lastCompleted = completed[0];
    const weekStart = startOfWeek().toISOString();
    const thisWeek = completed.filter((s) => s.startedAt >= weekStart).length;

    let lastSummary: { sets: number; exercises: number } | null = null;
    const progress: {
      exerciseId: string;
      name: string;
      top: number | null;
      delta: number | null;
      volumeDelta: number | null;
    }[] = [];
    if (lastCompleted) {
      const ses = await repos.sessions.exercises(lastCompleted.id);
      const sets = await db.sets.where("sessionId").equals(lastCompleted.id).toArray();
      lastSummary = {
        sets: sets.filter((s) => s.completed).length,
        exercises: ses.filter((se) => sets.some((s) => s.sessionExerciseId === se.id && s.completed)).length,
      };
      for (const se of ses) {
        const series = await repos.progress.seriesForExercise(se.exerciseId);
        for (const sr of series) {
          if (sr.key.deviceId !== se.deviceId) continue;
          const idx = sr.points.findIndex((p) => p.sessionId === lastCompleted.id);
          if (idx < 0) continue;
          const cmp = compareToPrevious(sr.points[idx], sr.points[idx - 1]);
          progress.push({
            exerciseId: se.exerciseId,
            name: se.snapshot.exerciseName,
            top: sr.points[idx].topWeight,
            delta: cmp?.topWeightDelta ?? null,
            volumeDelta: cmp?.volumeDelta ?? null,
          });
        }
      }
    }
    return { templates, counts, lastCompleted, thisWeek, lastSummary, progress, total: completed.length };
  }, []);
}

function Delta({ value, unit = "kg" }: { value: number | null; unit?: string }) {
  if (value === null) return <span className="text-xs text-muted">erstes Mal</span>;
  if (value === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted">
        <Minus className="size-3" aria-hidden /> gleich
      </span>
    );
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-success" : "text-warning"}`}>
      {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
      {up ? "+" : "−"}
      {formatKg(Math.abs(value)).replace(" kg", "")} {unit}
    </span>
  );
}

export default function HomePage() {
  const data = useHomeData();
  const active = useActiveSession();
  const settings = useSettings();
  const now = useNow(30000);

  if (!data || active === undefined) return <p className="py-10 text-center text-muted">Lädt …</p>;
  const suggestion = data.lastCompleted ? suggestNextSplit(data.lastCompleted.split) : null;
  const daysSinceBackup = settings?.lastBackupAt
    ? Math.floor((now - new Date(settings.lastBackupAt).getTime()) / 86400000)
    : null;

  return (
    <div>
      <h1 className="sr-only">Start</h1>

      {active && (
        <Card className="mb-4 border-accent/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm text-muted">
                {active.status === "paused" ? (
                  <Badge tone="warning">
                    <Pause aria-hidden /> Pausiert
                  </Badge>
                ) : (
                  <Badge tone="accent">Läuft</Badge>
                )}
                seit {formatTime(active.startedAt)}
              </p>
              <p className="mt-1 text-lg font-semibold">{active.templateName}</p>
              <p className="text-sm text-muted">Dauer {formatDuration(sessionElapsedMs(active, now))}</p>
            </div>
          </div>
          <Button asChild variant="primary" size="lg" className="mt-3 w-full">
            <Link href="/training/">
              <Play aria-hidden /> Training fortsetzen
            </Link>
          </Button>
        </Card>
      )}

      <SectionTitle>Training starten</SectionTitle>
      <div className="space-y-3">
        {data.templates.map((t) => (
          <StartTrainingButton
            key={t.id}
            template={t}
            suggested={suggestion === t.split}
            exerciseCount={data.counts[t.id] ?? 0}
          />
        ))}
      </div>
      {suggestion && data.lastCompleted && (
        <p className="mt-2 text-xs text-muted">
          Vorschlag, weil zuletzt Training {data.lastCompleted.split} abgeschlossen wurde. Du kannst frei wählen.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm text-muted">Diese Woche</p>
          <p className="tabular text-3xl font-semibold">{data.thisWeek}</p>
          <p className="text-xs text-muted">abgeschlossene Trainings (Mo–So)</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Letztes Training</p>
          {data.lastCompleted ? (
            <>
              <p className="text-lg font-semibold">Training {data.lastCompleted.split}</p>
              <p className="text-xs text-muted">
                {formatDate(data.lastCompleted.startedAt)}, {formatTime(data.lastCompleted.startedAt)}
                {data.lastSummary ? ` · ${data.lastSummary.sets} Sätze` : ""}
              </p>
              <Link
                href={`/verlauf/detail/?id=${data.lastCompleted.id}`}
                className="mt-1 inline-flex items-center gap-1 text-sm text-accent"
              >
                Details <ArrowRight className="size-4" aria-hidden />
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm">Noch keines abgeschlossen.</p>
          )}
        </Card>
      </div>

      <SectionTitle
        action={
          <Link href="/fortschritt/" className="text-sm text-accent">
            Alle
          </Link>
        }
      >
        Letzte Fortschritte
      </SectionTitle>
      {data.progress.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
          Nach deinem ersten abgeschlossenen Training siehst du hier den Vergleich zur vorherigen Durchführung.
        </p>
      ) : (
        <Card className="p-0">
          <p className="px-4 pt-3 text-xs text-muted">
            Höchstes Arbeitsgewicht im letzten Training vs. vorherige Durchführung derselben Übung am selben Gerät.
          </p>
          <ul className="divide-y divide-border">
            {data.progress.map((p) => (
              <li key={p.exerciseId + p.name}>
                <Link
                  href={`/fortschritt/?uebung=${p.exerciseId}`}
                  className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-surface-2"
                >
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tabular font-medium">{formatKg(p.top)}</span>
                    <Delta value={p.delta} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 rounded-2xl border border-border p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4 text-warning" aria-hidden /> Daten nur auf diesem Gerät
        </p>
        <p className="mt-1 text-muted">
          Alle Trainings werden lokal in diesem Browser gespeichert – nicht in der Cloud. Wenn Browserdaten gelöscht
          werden, sind sie weg.{" "}
          {daysSinceBackup === null
            ? "Du hast noch kein Backup erstellt."
            : `Letztes Backup vor ${daysSinceBackup} Tag${daysSinceBackup === 1 ? "" : "en"}.`}
        </p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link href="/einstellungen/#backup">Backup erstellen</Link>
        </Button>
      </div>
    </div>
  );
}
